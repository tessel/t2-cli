var stream = require('stream'),
  protocol = require('usb-daemon-parser'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter;

var MAX_PACKET_SIZE = 255;
var MAX_BUFFER_SIZE = 4096;

// A process is running remotely on the Tessel and data is piped in over USB
function USBProcess(id, daemon) {
  var self = this;
  this.id = id;
  // 4 remote process streams
  this.control = new stream.Writable();
  this.control.credit = 0;
  this.control.backPressure = new Array(0);
  this.stdin = new stream.Writable();
  this.stdin.credit = 0;
  this.stdin.backPressure = new Array(0);
  this.stdout = new stream.Readable();
  this.stdout.credit = 0;
  this.stderr = new stream.Readable();
  this.stderr.credit = 0;
  // Status of whether this process is killed or active
  this.active = true;
  // Code to be set upon death
  this.exitCode = null;

  this.stdout._read = function() {};
  this.stderr._read = function() {};

  // This puts the stream into 'flowing mode'
  // so that the stream emits ('end') events without 'data' listeners
  this.stdout.resume();
  this.stderr.resume();

  this.stdout.signal = function(signalToSend) {
    // RWQ: Does this need to a `switch`?
    switch (signalToSend) {
      case 'KILL':
        self.kill(9);
        break;
    }
  };

  // When we receive a stderr write message, we'll want to push it
  self.on('write', function(packet) {
    // Push the suggested data into the suggested stream
    packet.stream.push(packet.data);

    var ackFunc = packet.stream === self.stdout ? protocol.stdoutAck : protocol.stderrAck;

    self._readableAckHelper(packet.stream, ackFunc, packet.data.length);
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
    });
  };

  this.kill = function(signal) {
    daemon.write(protocol.killProcess(self.id, signal));
  };

  this.control.on('drain', function() {
    self._drainBackPressure(self.control, protocol.controlWrite);
  });

  this.stdin.on('drain', function() {
    self._drainBackPressure(self.stdin, protocol.stdinWrite);
  });

  this.control._write = function(chunk, enc, callback) {
    // Add this chunk to the backpressure array
    self.control.backPressure.push({
      buffer: chunk,
      callback: function controlSent() {
        // Tell the daemon that we have finished writing to the control stream
        daemon.write(protocol.controlClose(self.id));
        // Call the callback
        if (typeof callback === 'function') {
          callback();
        }
      }
    });

    if (self.control.credit) {
      self._drainBackPressure(self.control, protocol.controlWrite);
    }
  };

  // Intercepting write to the stdin stream
  this.stdin._write = function(chunk, enc, callback) {
    // Add this chunk to the backpressure array
    self.stdin.backPressure.push({
      buffer: chunk,
      callback: callback
    });
    if (self.stdin.credit) {
      self._drainBackPressure(self.stdin, protocol.stdinWrite);
    }
  };

  this._drainBackPressure = function(stream, genFunc) {
    // If we can write data to the remote pipe and we have data to write
    while (stream.credit && stream.backPressure.length) {
      // Get the first entry
      var entry = stream.backPressure[0];
      // Set the data to write to the daemon
      var chunk = entry.buffer;

      // If we are attempting to write more bytes than the socket can handle
      if (chunk.length > stream.credit) {
        // Slice the chunk that will be sent
        chunk = chunk.slice(0, stream.credit);
      }

      // Cut that off the front of the remaining bytes in the entry
      entry.buffer = entry.buffer.slice(chunk.length);

      // Split the chunk into smaller packets
      var indices = self._packetize(MAX_PACKET_SIZE, chunk);

      // For each packet
      indices.forEach(function(index) {
        // Slice out the data packet
        var buffer = chunk.slice(index.start, index.end);
        // Send the header for our control write
        daemon.write(genFunc(self.id, buffer.length));
        // Send over the data to the control stream
        daemon.write(buffer);
      });

      // If we sent all of the remaining bytes of this write
      if (entry.buffer.length === 0) {
        // Remove it from back pressure
        stream.backPressure.shift();
        // Call the callback if applicable
        if (typeof entry.callback === 'function') {
          entry.callback();
        }
      }
    }
  };

  // When the stdin pipe closes
  this.stdin.on('finish', function() {
    // Tell the remote daemon that we are done
    daemon.write(protocol.stdinClose(self.id));
  });

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
        end = inputBuffer.length;
      }

      // Store those indices
      indices[i] = {
        start: start,
        end: end
      };
    }
    // Return all the indices once complete
    return indices;
  };

  this.stdout.ack = function(numToAck) {
    self._readableAckHelper(self.stdout, protocol.stdoutAck, numToAck);
  };

  this.stderr.ack = function(numToAck) {
    self._readableAckHelper(self.stderr, protocol.stderrAck, numToAck);
  };

  this._readableAckHelper = function(stream, ackFunc, numToAck) {
    stream.credit += numToAck;
    var b = new Buffer(4);
    b.writeUInt32LE(numToAck, 0);
    daemon.write(ackFunc(self.id, b));
    daemon.write(b);
  };

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

  // Tell the remote daemon that this process was created
  daemon.write(protocol.newProcess(self.id));
  // Tell the remote daemon that we can start receiving outbound data
  self.stdout.ack(MAX_BUFFER_SIZE);
  self.stderr.ack(MAX_BUFFER_SIZE);

}

util.inherits(USBProcess, EventEmitter);

module.exports = USBProcess;
