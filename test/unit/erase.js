// Test dependencies are required and exposed in common/bootstrap.js

exports['Tessel.prototype.erase'] = {
  setUp: function(done) {

    this.erase = sinon.spy(Tessel.prototype, 'eraseScript');
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.erase.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
    done();
  },

  eraseAsUsual: function(test) {
    var self = this;

    test.expect(10);

    var expected = [commands.stopRunningScript(), commands.disablePushedScript(), commands.deleteFolder(Tessel.REMOTE_PUSH_PATH)];
    var commandNumber = 0;

    // Test that we received the proper command
    self.tessel._rps.on('control', function(command) {
      var receivedCommands = command.toString().split(' ');
      // Test that the command has the proper number of args
      test.equal(receivedCommands.length, expected[commandNumber].length);

      // And the proper args in each place
      for (var i = 0; i < receivedCommands.length; i++) {
        test.equal(receivedCommands[i], expected[commandNumber][i]);
      }

      commandNumber++;

      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    self.tessel.eraseScript()
      .then(function() {
        // This test completed satisfactorily
        test.done();
      })
      .catch(function() {
        test.fail('Error thrown on proper flash erase');
      });
  },

  noCodeInFlash: function(test) {
    var self = this;

    test.expect(1);

    // Attempt to erase the script
    self.tessel.eraseScript()
      // If it completes without issue
      .then(function() {
        // Fail the test
        test.fail('Error should have been returned on useless flash erase');
      })
      // If it fails (as it should)
      .catch(function(err) {
        test.ok(err);
        // Pass the test
        test.done();
      });

    // Write the error message we get when there is no code in flash
    self.tessel._rps.stderr.push('Command failed: Not found');

    // End the process once the error has time to propogate
    setImmediate(function() {
      self.tessel._rps.emit('close');
    });
  }
};
