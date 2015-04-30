var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , debug = require('debug')('parser')
  , Writable = require('stream').Writable
  ;

var CMD_RESET = 0x00;
var CMD_OPEN = 0x01;
var CMD_CLOSE = 0x02;
var CMD_KILL = 0x03;
var CMD_EXIT_STATUS = 0x05;
var CMD_CLOSE_ACK = 0x06;

var CMD_WRITE_CONTROL = 0x10;
var CMD_WRITE_STDIN = 0x11;
var CMD_WRITE_STDOUT = 0x12;
var CMD_WRITE_STDERR = 0x13;

var CMD_ACK_CONTROL = 0x20;
var CMD_ACK_STDIN = 0x21;
var CMD_ACK_STDOUT = 0x22;
var CMD_ACK_STDERR = 0x23;

var CMD_CLOSE_CONTROL = 0x30;
var CMD_CLOSE_STDIN = 0x31;
var CMD_CLOSE_STDOUT = 0x32;
var CMD_CLOSE_STDERR = 0x33;

var HEADER_LENGTH = 4;

function createHeader(command, processId, arg, len) {
  if (processId < 0) {
    throw new Error("Invalid process ID: " + processId);
  } 

  return new Buffer([command, processId, arg, len]);
}

module.exports.newProcess = function(id) {
  return createHeader(CMD_OPEN, id, 0, 0);
}

module.exports.killProcess = function(id, code) {
  return createHeader(CMD_KILL, id, code, 0);
}

module.exports.closeProcess = function(id) {
  return createHeader(CMD_CLOSE, id, 0, 0);
}

module.exports.controlWrite = function(id, length) {
  return createHeader(CMD_WRITE_CONTROL, id, 0, length);
}

module.exports.stdinWrite = function(id, length) {
  return createHeader(CMD_WRITE_STDIN, id, 0, length);
}

module.exports.controlClose = function(id) {
  return createHeader(CMD_CLOSE_CONTROL, id, 0, 0);
}
module.exports.stdinClose = function(id) {
  return createHeader(CMD_CLOSE_STDIN, id, 0, 0);
}

var ProtocolStates = {
  "ready" : 0,
  "headerFill" : 1,
  "headerComplete" : 2,
  "dataFill" : 3,
  "dataComplete": 4,
}

function Parser() {
  Writable.call(this);
  // Buffer to fill with incoming header data
  this.workingHeader = new Buffer(HEADER_LENGTH);
  // Set once working header is filled and the header is parsed
  this.parsedHeader;
  // Buffer to fill with body data
  this.workingPayload = new Buffer(0);
  // Index within header or body
  this.index = 0;
  // Current State
  this.state = ProtocolStates.ready;
}

util.inherits(Parser, EventEmitter);
util.inherits(Parser, Writable);

Parser.prototype._write = function(data, enc, cb) {
  var self = this;
  debug("incoming data", data, "in state", self.state);

  // Iterate through each byte
  for (var i = 0; i < data.length; i++) {
    var byte = data[i];
    // Super Fun State Machine (SFSM)
    switch(self.state) {
      // We are ready to start filling a new header
      case ProtocolStates.ready:
        debug("Ready State", byte.toString(16));
        // Add the byte to the header
        self.workingHeader[self.index++] = byte;
        // Change the state to header filling
        self.state = ProtocolStates.headerFill;
        // Break
        break;
      // We are in the process of filling a header
      case ProtocolStates.headerFill:
        debug("Header Fill State", byte.toString(16));
        // Add the byte to the header
        self.workingHeader[self.index++] = byte;

        // If this is the last byte of the header
        if (self.index == 4) {
          // Update our state
          self.state = ProtocolStates.headerComplete;
        }
        // If this isn't the last byte
        else {
          // Continue interating
          break;
        }
      // We just filled up a header
      case ProtocolStates.headerComplete:
        debug("Header Complete State", self.workingHeader);
        // Parse the header for relevant data
        self.parsedHeader = self._parseHeader(self.workingHeader);
        // Reset index so that we start at the beginning of the next buf
        self.index = 0;
        // If we will be expecting a payload
        if (self.parsedHeader.dataLength) {
          // Move to the data fill state
          self.state = ProtocolStates.dataFill;
          // Get our payload buffer ready
          self.workingPayload = new Buffer(self.parsedHeader.dataLength);
        }
        // If we won't be expecting a payload
        else {
          // Emit the event and relevant data for this header
          self.emit(self.parsedHeader.eventName, self.parsedHeader);
          // Go back to ready after this
          self.state = ProtocolStates.ready;
          // Reset our header
          self.workingHeader = new Buffer(HEADER_LENGTH);
        }

        break;
      // We are in the process of filling data
      case ProtocolStates.dataFill:
        // Add the byte to the payload
        self.parsedHeader.data[self.index++] = byte;

        // If we have received all the expected data bytes
        if (self.index == self.parsedHeader.dataLength) {
          // Set the state to complete
          self.state = ProtocolStates.dataComplete;
        }
        else {
          break;
        }

      // We have finished accounting for all of the payload bytes
      case ProtocolStates.dataComplete:
        debug("Data Complete State", self.parsedHeader);
        // Emit the event
        self.emit(self.parsedHeader.eventName, self.parsedHeader);

        // Reset all of our data
        self.workingPayload = new Buffer(0);
        self.parsedHeader = undefined;
        self.workingHeader = new Buffer(HEADER_LENGTH);
        self.index = 0;
        self.state = ProtocolStates.ready;
        break;
      default:
        throw new Error("Invalid state reaching in USB protocol parser!: " + self.state);
    }
  };

  cb();
}

Parser.prototype._parseHeader = function(headerBuffer) {
  // Create the object to be passed back with values given by buffer
  var parsedHeader = {
    command: headerBuffer[0],
    pid: headerBuffer[1],
    arg: headerBuffer[2],
    dataLength: headerBuffer[3],
    data: new Buffer(headerBuffer[3]),
    eventName: 'unnamed',
  };

  // Fill out the rest of parsed header based on the commands
  switch (parsedHeader.command) {
    case CMD_EXIT_STATUS:
      parsedHeader.eventName = 'EXIT-STATUS';
      break;
    case CMD_ACK_CONTROL:
      parsedHeader.eventName = 'ACK-CONTROL';
      break;
    case CMD_ACK_STDIN:
      parsedHeader.eventName = 'ACK-STDIN';
      break;
    case CMD_CLOSE_ACK:
      parsedHeader.eventName = 'ACK-CLOSE';
      break;
    case CMD_WRITE_STDOUT:
      parsedHeader.eventName = 'WRITE-STDOUT';
      break;
    case CMD_WRITE_STDERR:
      parsedHeader.eventName = 'WRITE-STDERR';
      break;
    case CMD_CLOSE_CONTROL:
      parsedHeader.eventName = 'CLOSE-CONTROL';
      break;
    case CMD_CLOSE_STDIN:
      parsedHeader.eventName = 'CLOSE-STDIN';
      break;
    case CMD_CLOSE_STDOUT:
      parsedHeader.eventName = 'CLOSE-STDOUT';
      break;
    case CMD_CLOSE_STDERR:
      parsedHeader.eventName = 'CLOSE-STDERR';
      break;
    default:
      throw new Error("Invalid Command received:" + parsedHeader.command);
  }

  return parsedHeader;
}
module.exports.Parser = Parser;