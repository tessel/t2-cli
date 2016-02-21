// Test dependencies are required and exposed in common/bootstrap.js

function RemoteProcessSimulator() {
  this.stdin = new stream.Writable();
  this.control = new stream.Writable();
  this.stdout = new stream.Readable();
  this.stderr = new stream.Readable();

  this.stdout._read = function() {};
  this.stderr._read = function() {};

  this.control._write = (command, enc, cb) => {
    // Emit commands for validation in tests
    this.emit('control', command);
    // Call the callback so we can receive more
    cb();
  };

  var stdinRecorder = (command, enc, cb) => {
    // Emit new data
    this.emit('stdin', command);
    // Call the callback so we can receive more
    cb();
  };

  this.stdin._write = stdinRecorder;

  // If a process tries to end stdin
  this.stdin.on('finish', () => {
    // Create a new writable
    this.stdin = new stream.Writable();
    // Keep recording what gets written
    this.stdin._write = stdinRecorder;
  });

  this.close = () => {
    this.emit('close');
  };
}

util.inherits(RemoteProcessSimulator, Emitter);

module.exports = RemoteProcessSimulator;
