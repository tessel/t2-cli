var stream = require('stream'),
  async = require('async'),
  protocol = require('usb-daemon-parser'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter
  ;

// The largest packet we can send over USB
var MAX_PACKET_SIZE = 255;
// The size of the back pressure buffers
var MAX_BUFFER_SIZE = 4096;

// A process is running remotely on the Tessel and data is piped in over USB
function USBProcess(id, daemon) {
  var self = this;
  // The numerical identifer for this process
  this.id = id;
  // Status of whether this process is killed or active
  this.active = true;
  // 4 remote process streams
  this.control = new RemoteWritableStream(id, daemon, protocol.controlWrite, protocol.controlClose);
  this.stdin = new RemoteWritableStream(id, daemon, protocol.stdinWrite, protocol.stdinClose);
  this.stdout = new RemoteReadableStream(id, daemon, protocol.stdoutAck);
  this.stderr = new RemoteReadableStream(id, daemon, protocol.stderrAck);

  // Once the process is killed
  self.once('death', function(data) {
    // Close the input streams because the remote proc can't handle data
    self.control.end();
    self.stdin.end();

    // Mark this process as inactive
    self.active = false;

    // Close the process
    self.closeProcessIfReady();

    // Check for a non-zero exit code
    var exitCode = data.arg;
    if (exitCode != 0) {
      throw new Error("Error upon remote process exit: " + exitCode);
    }
  });

  // Tell the USBDaemon to close the remote process
  self.close = function() {
    // Write the close command
    daemon.write(protocol.closeProcess(self.id));
  };

  // Send a signal to the remote process
  self.kill = function(signal) {
    // Write the signal command
    daemon.write(protocol.killProcess(self.id, signal));
  }

  // Checks if this process is ready to be closed
  // and closes it if it can
  self.closeProcessIfReady = function() {
    // If this process hasn't been closed before
    // and all of the streams are closed
    if (!self.active && self.stdout.closed && self.stderr.closed) {
      // Close this process
      self.close();
    }
  };

  // When any of the streams complete, check if the process is ready to close
  self.stdout.once('end', self.closeProcessIfReady);
  self.stderr.once('end', self.closeProcessIfReady);

  // This function is primarily intended for compatibility with the ssh2 stream API
  self.stdout.signal = function(signalToSend) {
    switch(signalToSend) {
      case 'KILL':
        self.kill(9);
        break;
      case 'SIGINT':
        self.kill(2);
    }
  }

  // Tell the remote daemon that this process was created
  daemon.write(protocol.newProcess(self.id));
  // Tell the remote daemon that we can start receiving outbound data
  self.stdout.ack(MAX_BUFFER_SIZE);
  self.stderr.ack(MAX_BUFFER_SIZE);
}

util.inherits(USBProcess, EventEmitter);

// A wrapper on the Node Writable Stream to encapsulate stdin & control stream functionality
function RemoteWritableStream(id, daemon, writeHeaderFunc, closeHeaderFunc) {
  var self = this;
  // Inherit from Writable Streams
  stream.Writable.call(self);
  // The id of the process that this is a stream of
  self.id = id;
  // The daemon to write data to
  self.daemon = daemon;
  // The amount of credit allocated to the stream (backpressure)
  self.credit = 0;
  // An array of backpressure entries
  self.backPressure = new Array(0);
  // A flag indicating whether this stream has passed EOF
  self.closed = false;

  // The function to generate the header necessary for a write
  self.writeHeaderFunc = writeHeaderFunc;
  // The function to generate the header necessary to close the stream
  self.closeHeaderFunc = closeHeaderFunc;
  // When the drain event is called, continue draining back pressured packets
  self.on('drain', self._drainBackPressure);
  // When the stream has finished
  self.once('finish', function closeRemote() {
    // Tell the remote daemon that we are done
    self.daemon.write(closeHeaderFunc(self.id));
    // Mark the flag
    self.closed = true;
  });
}

util.inherits(RemoteWritableStream, stream.Writable);

// The underlying function for .write calls on the Node stream
RemoteWritableStream.prototype._write = function(chunk, enc, callback) {
  // Add this chunk to the backpressure array
  this.backPressure.push({buffer: chunk, callback: callback});
  // If there is credit on the pipe buffer
  if (this.credit) {
    // Send as much data as we can
    this._drainBackPressure();
  }
};

// The function to handle more credit becoming available on the remote stream
RemoteWritableStream.prototype.ack = function(data, dataLength) {
  // Check if the pipe was previously clogged
  var wasBackedUp = !this.credit;
  // Add the amount of new credit to the stream
  this.credit += data.readUIntLE(0, dataLength);
  // If the stream is no longer clogged
  if (wasBackedUp && this.credit > 0) {
    // Emit the drain event
    this.emit('drain');
  }
};

// A helper function to continue writing chunks from the back pressure array
// and calling the appropriate callback for each. It also ensures that no
// packets are larger than the maximum USB packet size and that this stream
// doesn't write more data to the remote process than it can handle
RemoteWritableStream.prototype._drainBackPressure = function() {
  var self = this;
  // If we can write data to the remote pipe and we have data to write
  while (self.credit && self.backPressure.length) {
    // Get the first entry
    var entry = self.backPressure[0];
    // Set the data to write to the daemon
    var chunk = entry.buffer;

    // If we are attempting to write more bytes than the socket can handle
    if (chunk.length > self.credit) {
      // Slice the chunk that will be sent
      chunk = chunk.slice(0, self.credit);
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
      self.daemon.write(self.writeHeaderFunc(self.id, buffer.length));
      // Send over the data to the control stream
      self.daemon.write(buffer);
    });

    // If we sent all of the remaining bytes of this write
    if (entry.buffer.length == 0) {
      // Remove it from back pressure
      self.backPressure.shift();
      // Call the callback if applicable
      entry.callback && entry.callback();
    }
  }
};

// Turn large buffers into packets the remote USB daemon can manage
RemoteWritableStream.prototype._packetize = function(chunkSizes, inputBuffer) {
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
};

// A wrapper on the Node Readable Stream to encapsulate stdout & stderr stream functionality
function RemoteReadableStream(id, daemon, ackHeaderFunc) {
  var self = this;
  // Inherit from Readable Streams
  stream.Readable.call(self);
  // The id of the process of this stream
  self.id = id;
  // The daemon to write data to
  self.daemon = daemon;
  // The function we use to generate acknowledgement packets
  self.ackHeaderFunc = ackHeaderFunc;
  // The amount of backpressure credit on this stream
  self.credit = 0;
  // A flag indicating whether this stream was closed
  self.closed = false;

  // This puts the stream into 'flowing mode' 
  // so that the stream emits ('end') events without 'data' listeners
  self.resume();

  // When we receive data from the daemon, we handle it
  self.on('incoming', self.handleIncoming);
}

util.inherits(RemoteReadableStream, stream.Readable);

RemoteReadableStream.prototype._read = function() {};

// A function to handle data coming in from the remote daemon
RemoteReadableStream.prototype.handleIncoming = function(data) {
  // Write it to the stream
  this.push(data);
  // Give the USBDaemon more credit
  this.ack(data.length);
}

// A function to give more credit to the remote daemon so it can write more data
RemoteReadableStream.prototype.ack = function(numToAck) {
  // Add the number to the credit count
  this.credit += numToAck;
  // Allocate a buffer for the data
  var b = new Buffer(4);
  // Write the number as an unsigned 32 but int into the buffer
  b.writeUInt32LE(numToAck, 0);
  // Write the header 
  this.daemon.write(this.ackHeaderFunc(this.id, b));
  // Write the data
  this.daemon.write(b);
};

// A function to close the stream
RemoteReadableStream.prototype.close = function() {
  // Close the Node stream
  this.push(null);
  // Set the flag
  this.closed = true;
};

module.exports = USBProcess;