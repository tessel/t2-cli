// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['Tessel.prototype.erase'] = {
  setUp(done) {

    this.erase = sinon.spy(Tessel.prototype, 'eraseScript');
    this.logWarn = sinon.stub(log, 'warn');
    this.logInfo = sinon.stub(log, 'info');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.erase.restore();
    this.logWarn.restore();
    this.logInfo.restore();
    done();
  },

  eraseAsUsual(test) {
    test.expect(10);

    var expected = [commands.app.stop(), commands.app.disable(), commands.deleteFolder(Tessel.REMOTE_APP_PATH)];
    var commandNumber = 0;

    // Test that we received the proper command
    this.tessel._rps.on('control', (command) => {
      var receivedCommands = command.toString().split(' ');
      // Test that the command has the proper number of args
      test.equal(receivedCommands.length, expected[commandNumber].length);

      // And the proper args in each place
      for (var i = 0; i < receivedCommands.length; i++) {
        test.equal(receivedCommands[i], expected[commandNumber][i]);
      }

      commandNumber++;

      setImmediate(() => {
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.eraseScript()
      .then(() => {
        // This test completed satisfactorily
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Error thrown on proper flash erase');
        test.done();
      });
  },

  noCodeInFlash(test) {
    test.expect(1);

    // Attempt to erase the script
    this.tessel.eraseScript()
      // If it completes without issue
      .then(() => {
        // Fail the test
        test.ok(false, 'Error should have been returned on useless flash erase');
        test.done();
      })
      // If it fails (as it should)
      .catch((err) => {
        test.ok(err.includes('No files have been pushed'));
        // Pass the test
        test.done();
      });

    // Write the error message we get when there is no code in flash
    this.tessel._rps.stderr.push('Command failed: Not found');

    // End the process once the error has time to propogate
    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  unexpectedError(test) {
    test.expect(1);

    // Attempt to erase the script
    this.tessel.eraseScript()
      // If it completes without issue
      .then(() => {
        // Fail the test
        test.ok(false, 'Error should have been returned on useless flash erase');
        test.done();
      })
      // If it fails (as it should)
      .catch((err) => {
        test.ok(err.includes('An unexpected error occurred'));
        // Pass the test
        test.done();
      });

    // Write the error message we get when there is no code in flash
    this.tessel._rps.stderr.push('Unexpected');

    // End the process once the error has time to propogate
    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  }
};
