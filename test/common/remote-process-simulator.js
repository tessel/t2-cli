var stream = require('stream');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function RemoteProcessSimulator() {
  this.stdin = new stream.Writable();
  this.stdout = new stream.Readable();
  this.stderr = new stream.Readable();

  this.stdout._read = function() {};
  this.stderr._read = function() {};
}

util.inherits(RemoteProcessSimulator, EventEmitter);

module.exports = RemoteProcessSimulator;
