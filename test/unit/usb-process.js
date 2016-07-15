// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['USBProcess death'] = {
  setUp: function(done) {
    this.context = sinon.sandbox.create();

    // Create a simulated USB Daemon (just a writable stream)
    this.fakeConnection = new stream.Duplex();
    this.fakeConnection._write = function() {};
    this.fakeConnection._read = function() {};
    this.fakeConnection.serialNumber = 1;

    // Register our fake connection with the daemon
    Daemon.register(this.fakeConnection);

    this.parser = Daemon.entries[this.fakeConnection.serialNumber].parser;

    done();
  },
  tearDown: function(done) {
    // Make sure we start each test with no registered connections
    Daemon.entries = {};
    this.context.restore();
    done();
  },
  // Creates a USB Process, then kills it
  // Ensures an error code is provided with close
  exitWithError: function(test) {
    test.expect(2);
    var testStatusCode = 9;

    // Create a new process
    Daemon.openProcess(this.fakeConnection, (err, p) => {
      // Ensure there was no error
      test.ifError(err);

      // Capture the close event
      p.once('close', function(exitedWithError) {
        // Ensure the error flag was set
        test.equal(exitedWithError, true);
        // Finish up
        test.done();
      });

      // Tell the daemon that the process was killed remotely
      this.parser.emit('EXIT-STATUS', {
        pid: p.id,
        arg: testStatusCode
      });

      // Tell the daemon that the process resources were cleaned up
      this.parser.emit('ACK-CLOSE', {
        pid: p.id
      });
    });
  },
  exitedWithoutError: function(test) {
    test.expect(2);
    var testStatusCode = 0;

    // Create a new process
    Daemon.openProcess(this.fakeConnection, (err, p) => {
      // Ensure there was no error
      test.ifError(err);

      // Capture the close event
      p.once('close', function(exitedWithError) {
        // Ensure the error flag was not set
        test.equal(exitedWithError, false);
        // Finish up
        test.done();
      });

      // Tell the daemon that the process was killed remotely
      this.parser.emit('EXIT-STATUS', {
        pid: p.id,
        arg: testStatusCode
      });

      // Tell the daemon that the process resources were cleaned up
      this.parser.emit('ACK-CLOSE', {
        pid: p.id
      });
    });
  }
};
