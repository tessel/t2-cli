var stream = require('stream');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function RemoteProcessSimulator() {
  this.stdin = new stream.Writable();
  this.control = new stream.Writable();
  this.stdout = new stream.Readable();
  this.stderr = new stream.Readable();

  this.stdout._read = function() {};
  this.stderr._read = function() {};

  this.control._write = function(command, enc, cb) {
    // Emit commands for validation in tests
    this.emit('control', command);
    // Call the callback so we can receive more
    cb();
  }.bind(this);

  this.stdin._write = function(data, enc, cb) {
    // Emit incoming data for validation in tests
    this.emit('stdin', data);
    // Call the callback so we can receive more
    cb();
  }.bind(this);
}

util.inherits(RemoteProcessSimulator, EventEmitter);

module.exports = RemoteProcessSimulator;
