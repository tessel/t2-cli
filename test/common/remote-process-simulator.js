// Test dependencies are required and exposed in common/bootstrap.js

function RemoteProcessSimulator() {
  var self = this;
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

  function stdinRecorder(command, enc, cb) {
    // Emit new data
    self.emit('stdin', command);
    // Call the callback so we can receive more
    cb();
  }

  this.stdin._write = stdinRecorder;

  // If a process tries to end stdin
  this.stdin.on('finish', function() {
    // Create a new writable
    self.stdin = new stream.Writable();
    // Keep recording what gets written
    self.stdin._write = stdinRecorder;
  });

  this.close = () => {
    this.emit('close');
  };
}

util.inherits(RemoteProcessSimulator, Emitter);

module.exports = RemoteProcessSimulator;
