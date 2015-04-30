var stream = require('stream')
  , async = require('async')
  , protocol = require('./usb_daemon_protocol')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter;
  ;

var MAX_PACKET_SIZE = 64;

// A process is running remotely on the Tessel and data is piped in over USB
function USBProcess(id, daemon) {
  var self = this;
  this.id = id;
  // 4 remote process streams
  this.control = new stream.Writable;
  this.stdin = new stream.Writable;
  this.stdout = new stream.Readable;
  this.stderr = new stream.Readable;
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
  });

  // Once the process is killed
  self.once('death', function(data) {
    self.active = false;
    // Set the exit code
    self.exitCode = data.arg;
    // Close the input streams
    self.control.end();
    self.stdin.end();
    // End the output streams
    self.stdout.push(null);
    self.stderr.push(null);
    // Clean up remote resources
    self.close();
  });

  this.close = function() {
    // Write the close command
    daemon.write(protocol.closeProcess(self.id));
  };

  this.kill = function(signal) {
    daemon.write(protocol.killProcess(self.id, signal));
  }

  // Intercepting write to the command stream
  this.control._write = function(chunk, enc, callback) {
    self.bashCommand = chunk;
    // Write the data
    self._writableHelper(chunk, protocol.controlWrite, protocol.controlClose, 'controlAck', function complete(err) {
      // End the stream
      self.control.end();
      // Call the callback
      callback(err);
    });
  };

  // Intercepting write to the stdin stream
  this.stdin._write = function(chunk, enc, callback) {
    // Write the data to the remote stdin
    self._writableHelper(chunk, protocol.stdinWrite, protocol.stdinClose, 'stdinAck', callback);
  }

  // When the stdin pipe closes
  this.stdin.on('finish', function() {
    // Tell the remote daemon
    daemon.write(protocol.stdinClose(self.id));
  });

  /* Helper Function that packetizes buffers larger than the max buffer size, sends
  each packet, waits for ack, and continues until all the data has been sent
  */
  this._writableHelper = function(chunk, genFunc, closeFunc, ackEvent, callback) {
    // Get the start and end indicies for all packets
    var indices = self._packetize(MAX_PACKET_SIZE, chunk);
    // For each data packet
    async.eachSeries(indices, function tranferPacket(index, cb) {
      // Slice out the data packet
      var buffer = chunk.slice(index.start, index.end);
      // Send the header for our control write
      // console.log('in writable helper, going to send', genFunc(self.id, buffer.length));
      daemon.write(genFunc(self.id, buffer.length));
      // Send over the data to the control stream
      daemon.write(buffer);

      // Once we get acknowledgement that the command was received
      self.once(ackEvent, cb);
    },
    function(err) {
      callback(err);
    })
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
}

util.inherits(USBProcess, EventEmitter);

module.exports = USBProcess;