// Built-ins
var EventEmitter = require('events').EventEmitter;
var stream = require('stream');
var util = require('util');

// Third Party
var protocol = require('usb-daemon-parser');

// Internal
var log = require('../log');

function debug(message) {
  log.debug(`(usb-process) ${message}`);
}

// The largest packet allowed is 255 bytes
// We make the data 251 bytes so we can concat
// the 4 header bytes to it and use only 1 packet
var MAX_DATA_PACKET_SIZE = 4092;
// The size of the back pressure buffers
var MAX_BUFFER_SIZE = 32768;

// A process is running remotely on the Tessel and data is piped in over USB
function USBProcess(id, daemon) {
  // The numerical identifer for this process
  this.id = id;

  /*
  active && !closed = Process is running as usual
  !active && !closed = Process has been sent a signal but not completely closed (resources freed)
  !active && closed = Process has stopped running and has already been destroyed
  */
  // Status of whether this process is running
  this.active = true;
  // Status of whether this process was cleaned up
  this.closed = false;
  // Boolean of whether this process has been forcibly killed
  this.forceKill = false;
  // Code to be set upon process death
  this.exitedWithError = false;
  // Some processes, like `sysupgrade` will not be close-able
  // because OpenWRT does not have the spidaemon active.
  // In these cases, just close without trying to send kill signal
  this.waitForClose = true;

  // 4 remote process streams
  this.control = new RemoteWritableStream(this, daemon, protocol.controlWrite, protocol.controlClose);
  this.stdin = new RemoteWritableStream(this, daemon, protocol.stdinWrite, protocol.stdinClose);
  this.stdout = new RemoteReadableStream(this, daemon, protocol.stdoutAck);
  this.stderr = new RemoteReadableStream(this, daemon, protocol.stderrAck);

  // Once the process is killed
  this.once('death', (data) => {
    // This process is no longer running
    this.active = false;
    // Close the input streams because the remote proc can't handle data
    this.control.end();
    this.stdin.end();

    // Close the process
    this.closeProcessIfReady();

    // Check for a non-zero exit code
    var exitCode = parseInt(data.arg);
    debug(`Death for "${this.commandString}" with exit code: ${exitCode}`);
    if (exitCode !== 0 && !this.forceKill) {
      this.exitedWithError = true;
    }
  });

  // Tell the USBDaemon to close the remote process
  this.close = () => {
    // Write the close command
    daemon.write(protocol.closeProcess(this.id));

    // Mark this process as closed
    this.closed = true;
  };

  // Send a signal to the remote process
  this.kill = (signal) => {
    // Mark our boolean
    this.forceKill = true;

    // If we should wait for close (most processes should)
    if (this.waitForClose) {
      // Write the signal command
      daemon.write(protocol.killProcess(this.id, signal));
    } else {
      // Mark the process as inactive and closed
      this.active = false;
      this.closed = true;
      // Emit the close event
      setImmediate(() => this.emit('close'));
    }
  };

  // Checks if this process is ready to be closed
  // and closes it if it can
  this.closeProcessIfReady = () => {
    // If this process hasn't been closed before
    // and all of the streams are closed
    if (!this.active && !this.closed && this.stdout.closed && this.stderr.closed) {
      // Close this process
      this.close();
    }
  };

  // When any of the streams complete, check if the process is ready to close
  this.stdout.once('end', () => this.closeProcessIfReady());
  this.stderr.once('end', () => this.closeProcessIfReady());

  // This function is primarily intended for compatibility with the ssh2 stream API
  this.stdout.signal = (signalToSend) => {
    switch (signalToSend) {
      case 'KILL':
        this.kill(9);
        break;
      case 'SIGINT':
        this.kill(2);
        break;
    }
  };

  // Tell the remote daemon that this process was created
  daemon.write(protocol.newProcess(this.id));
  // Tell the remote daemon that we can start receiving outbound data
  this.stdout.ack(MAX_BUFFER_SIZE);
  this.stderr.ack(MAX_BUFFER_SIZE);
}

util.inherits(USBProcess, EventEmitter);

// A wrapper on the Node Writable Stream to encapsulate stdin & control stream functionality
function RemoteWritableStream(process, daemon, writeHeaderFunc, closeHeaderFunc) {
  // Inherit from Writable Streams
  stream.Writable.call(this);
  // The id of the process that this is a stream of
  this.process = process;
  // The daemon to write data to
  this.daemon = daemon;
  // The amount of credit allocated to the stream (backpressure)
  this.credit = 0;
  // An array of backpressure entries
  this.backPressure = new Array(0);
  // A flag indicating whether this stream has passed EOF
  this.closed = false;

  // The function to generate the header necessary for a write
  this.writeHeaderFunc = writeHeaderFunc;
  // The function to generate the header necessary to close the stream
  this.closeHeaderFunc = closeHeaderFunc;
  // When the drain event is called, continue draining back pressured packets
  this.on('drain', () => this._drainBackPressure());
  // When the stream has finished
  this.once('finish', () => {
    // If the parent process is not already closed
    if (!this.process.closed) {
      // Tell the remote daemon that we are done
      this.daemon.write(closeHeaderFunc(this.process.id));
    }
    // Mark the flag for this stream
    this.closed = true;
  });
}

util.inherits(RemoteWritableStream, stream.Writable);

// The underlying function for .write calls on the Node stream
RemoteWritableStream.prototype._write = function(chunk, enc, callback) {
  // Purely for debugging purposes
  // If this is a control Stream
  if (this.writeHeaderFunc === protocol.controlWrite) {
    // Save the string we're writing for debugging
    this.process.commandString = chunk.toString();
    debug(`Opening process for: ${this.process.commandString}`);
  }

  // Add this chunk to the backpressure array
  this.backPressure.push({
    buffer: chunk,
    callback: callback
  });
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
  // If we can write data to the remote pipe and we have data to write
  while (this.credit && this.backPressure.length) {
    // Get the first entry
    var entry = this.backPressure[0];
    // Set the data to write to the daemon
    var chunk = entry.buffer;

    // If we are attempting to write more bytes than the socket can handle
    if (chunk.length > this.credit) {
      // Slice the chunk that will be sent
      chunk = chunk.slice(0, this.credit);
    }

    // Cut that off the front of the remaining bytes in the entry
    entry.buffer = entry.buffer.slice(chunk.length);

    // Split the chunk into smaller packets
    var indices = this._packetize(MAX_DATA_PACKET_SIZE, chunk);

    // For each packet
    indices.forEach((index) => {
      // Slice out the data packet
      var buffer = chunk.slice(index.start, index.end);
      // Create a header for the write
      var header = this.writeHeaderFunc(this.process.id, buffer.length);
      // Compact our header and data into one packet
      var compact_buffer = Buffer.concat([header, buffer]);
      // Send over the data to the control stream
      this.daemon.write(compact_buffer);
    });

    // If we sent all of the remaining bytes of this write
    if (entry.buffer.length === 0) {
      // Remove it from back pressure
      this.backPressure.shift();
      // Call the callback if provided
      if (typeof entry.callback === 'function') {
        entry.callback();
      }
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

// A wrapper on the Node Readable Stream to encapsulate stdout & stderr stream functionality
function RemoteReadableStream(process, daemon, ackHeaderFunc) {
  // Inherit from Readable Streams
  stream.Readable.call(this);
  // The id of the process of this stream
  this.process = process;
  // The daemon to write data to
  this.daemon = daemon;
  // The function we use to generate acknowledgement packets
  this.ackHeaderFunc = ackHeaderFunc;
  // The amount of backpressure credit on this stream
  this.credit = 0;
  // A flag indicating whether this stream was closed
  this.closed = false;

  // This puts the stream into 'flowing mode'
  // so that the stream emits ('end') events without 'data' listeners
  this.resume();

  // When we receive data from the daemon, we handle it
  this.on('incoming', (data) => this.handleIncoming(data));
}

util.inherits(RemoteReadableStream, stream.Readable);

RemoteReadableStream.prototype._read = function() {};

// A function to handle data coming in from the remote daemon
RemoteReadableStream.prototype.handleIncoming = function(data) {
  // Write it to the stream
  this.push(data);
  // Give the USBDaemon more credit
  this.ack(data.length);
};

// A function to give more credit to the remote daemon so it can write more data
RemoteReadableStream.prototype.ack = function(numToAck) {
  // Add the number to the credit count
  this.credit += numToAck;
  // Allocate a buffer for the data
  var ackAmountBuf = new Buffer(4);
  // Write the number as an unsigned 32 but int into the buffer
  ackAmountBuf.writeUInt32LE(numToAck, 0);
  // Create a header for this ack
  var header = this.ackHeaderFunc(this.process.id, ackAmountBuf);
  // Combine the header and the ack amount
  var packet = Buffer.concat([header, ackAmountBuf]);
  // Write the entire packet
  this.daemon.write(packet);
};

// A function to close the stream
RemoteReadableStream.prototype.close = function() {
  // Close the Node stream
  this.push(null);
  // Set the flag
  this.closed = true;
};

module.exports = USBProcess;
