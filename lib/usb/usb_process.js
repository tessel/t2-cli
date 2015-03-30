var stream = require('stream')
  , async = require('async')
  , protocol = require('usb-daemon-parser')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter;
  ;

var MAX_PACKET_SIZE = 255;
var MAX_BUFFER_SIZE = 4096;

// A process is running remotely on the Tessel and data is piped in over USB
function USBProcess(id, daemon) {
  var self = this;
  this.id = id;
  // 4 remote process streams
  this.control = new stream.Writable;
  this.control.credit = 0;
  this.control.backPressure = new Buffer(0);
  this.stdin = new stream.Writable;
  this.stdin.credit = 0;
  this.stdin.backPressure = new Buffer(0);
  this.stdout = new stream.Readable;
  this.stdout.credit = 0;
  this.stderr = new stream.Readable;
  this.stderr.credit = 0;
  // Status of whether this process is killed or active
  this.active = true;
  // Code to be set upon death
  this.exitCode;

  var self = this;

  this.stdout._read = function() {};
  this.stderr._read = function() {};

  // This puts the stream into 'flowing mode' 
  // so that the stream emits ('end') events without 'data' listeners
  this.stdout.resume();
  this.stderr.resume();

  this.stdout.signal = function(signalToSend) {
    switch(signalToSend) {
      case 'KILL':
        self.kill(9);
        break;
    }
  }

  // When we receive a stderr write message, we'll want to push it
  self.on('write', function(packet) {
    // Push the suggested data into the suggested stream
    packet.stream.push(packet.data);

    var ackFunc = (packet.stream == self.stdout ? protocol.stdoutAck : protocol.stderrAck);

    self._readableAckHelper(packet.stream , ackFunc, packet.data.length);
  });

  // Once the process is killed
  self.once('death', function(data) {
    self.active = false;
    // Set the exit code
    self.exitCode = data.arg;
    // Close the input streams
    self.control.end();
    self.stdin.end();
    // Clean up remote resources
    self.close();
  });

  this.close = function() {
    // Write the close command
    daemon.write(protocol.closeProcess(self.id));
    self.once('close', function() {

      // End the output streams
      self.stdout.push(null);
      self.stderr.push(null);
    })
  };

  this.kill = function(signal) {
    daemon.write(protocol.killProcess(self.id, signal));
  }

  this.on('controlAck', function(packet) {
    self._writableAckHelper(self.control, packet);
  });

  this.on('stdinAck', function(packet) {
    self._writableAckHelper(self.stdin, packet);
  });

  this._writableAckHelper = function(stream, packet) {
    // Check if the pipe was previously clogged
    var wasBackedUp = !stream.credit;
    // Add the amount of new credit to the stream
    stream.credit += packet.data.readUIntLE(0, packet.dataLength);
    // If the stream is no longer clogged
    if (wasBackedUp && stream.credit > 0) {
      // Emit the drain event
      stream.emit('drain');
    }
  };

  this.control.on('drain', function() {
    var toWrite = self.control.backPressure.slice(0, self.control.credit);
    self.control.backPressure = self.control.backPressure.slice(self.control.credit);
    self.control._write(toWrite);;
  });

  this.stdin.on('drain', function() {
    var toWrite = self.stdin.backPressure.slice(0, self.stdin.credit);
    self.stdin.backPressure = self.stdin.backPressure.slice(self.stdin.credit);
    self.stdin._write(toWrite);
  });

  // Intercepting write to the command stream
  this.control._write = function(chunk, enc, callback) {
    self.bashCommand = chunk;
    var complete = true;
    // Backpressure as needed based on the credit on the remote daemon
    var newChunk = self._backPressureAsNeeded(chunk, self.control);

    // If the returned chunk is different
    if (!chunk.equals(newChunk)) {
      // Note that we won't be sending the entire buffer
      complete = false;
      // Set the chunk to be sent
      chunk = newChunk;
    }

    // If all of the data was absorbed into the backpressure buffer
    if (!chunk.length) {
      // Call the callback
      callback && callback();
      // Let the caller know that we didn't send all the data
      return complete;
    }

    // Subtract the number of bytes from from the amount of credit on the stream
    self.control.credit -= chunk.length;

    // End the stream so no more data can be written to it
    self.control.end();

    // Write the data
    self._writableHelper(chunk, protocol.controlWrite, function complete(err) {
      // Tell the daemon that we have finished writing to the control stream
      daemon.write(protocol.controlClose(self.id));
      // Call the callback
      callback && callback(err);
    });

    return complete;
  };

  this._backPressureAsNeeded = function(chunk, stream) {
    // The number of bytes to write to the stream
    var toWrite = stream.credit;
    // The number of bytes to back pressure
    var toBuffer = 0;

    // If we are attempting to write more bytes than the socket can handle
    if (chunk.length > stream.credit) {
      // We'll need to buffer the remainder
      toBuffer = chunk.length - toWrite;
      // Create a new buffer to hold the bytes
      var buf = new Buffer(toBuffer);
      // Copy the bytes into it
      chunk.copy(buf, 0, toWrite, chunk.length);
      // Concatenate this with the rest of the backpressured data
      stream.backPressure = Buffer.concat([stream.backPressure, buf]);
      // Slice the chunk that will be sent
      chunk = chunk.slice(0, toWrite);
    }

    return chunk;
  }

  // Intercepting write to the stdin stream
  this.stdin._write = function(chunk, enc, callback) {
    var complete = true;
    var newChunk = self._backPressureAsNeeded(chunk, self.stdin);

    if (!chunk.equals(newChunk)) {
      complete = false;
      chunk = newChunk;
    }

    // Subtract the number of bytes from from the amount of credit on the stream
    self.stdin.credit -= chunk.length;
    // Write the data to the remote stdin
    self._writableHelper(chunk, protocol.stdinWrite, callback);

    return complete;
  }

  // When the stdin pipe closes
  this.stdin.on('finish', function() {
    // Tell the remote daemon that we are done
    daemon.write(protocol.stdinClose(self.id));
  });

  /* Helper Function that packetizes buffers larger than the max buffer size, sends
  each packet, waits for ack, and continues until all the data has been sent
  */
  this._writableHelper = function(chunk, genFunc, callback) {
    // Get the start and end indicies for all packets
    var indices = self._packetize(MAX_PACKET_SIZE, chunk);
    // For each data packet
    async.eachSeries(indices, function tranferPacket(index, cb) {
      // Slice out the data packet
      var buffer = chunk.slice(index.start, index.end);
      // Send the header for our control write
      daemon.write(genFunc(self.id, buffer.length));
      // Send over the data to the control stream
      daemon.write(buffer);
      // Write the next piece
      cb();
    },
    function(err) {
      callback && callback(err);
    });
  }

  // Turn large buffers into packets the remote USB daemon can manage
  this._packetize = function(chunkSizes, inputBuffer) {
    // Figure out the number of full chunks
    var chunks = Math.ceil(inputBuffer.length / chunkSizes);
    // Create an array of indices of buffer slices
    var indices = new Array(chunks);
    // For each chunk
    for (var i = 0; i < chunks; i++) {
      // Calculate start
      var start = i * chunkSizes;
      // Calculate end
      var end = start + chunkSizes;
      // If the end is past the length of the buffer
      if (end > inputBuffer.length) {
        // Set it to the end of the buffer
        end = inputBuffer.length
      }

      // Store those indices
      indices[i] = {start: start, end: end};
    }
    // Return all the indices once complete
    return indices;
  }

  this.stdout.ack = function(numToAck) {
    self._readableAckHelper(self.stdout, protocol.stdoutAck, numToAck);
  }

  this.stderr.ack = function(numToAck) {
    self._readableAckHelper(self.stderr, protocol.stderrAck, numToAck);
  }

  this._readableAckHelper = function(stream, ackFunc, numToAck) {
    stream.credit += numToAck;
    var b = new Buffer(4);
    b.writeUInt32LE(numToAck, 0);
    daemon.write(ackFunc(self.id, b));
    daemon.write(b);
  }

  // Tell the remote daemon that this process was created
  daemon.write(protocol.newProcess(self.id));
  // Tell the remote daemon that we can start receiving outbound data
  self.stdout.ack(MAX_BUFFER_SIZE);
  self.stderr.ack(MAX_BUFFER_SIZE);

}

util.inherits(USBProcess, EventEmitter);

module.exports = USBProcess;