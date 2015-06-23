var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');

exports['Tessel.prototype.erase'] = {
  setUp: function(done) {

    this.erase = sinon.spy(Tessel.prototype, 'eraseScript');
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.close();
    this.erase.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
    done();
  },

  eraseAsUsual: function(test) {
    var self = this;

    test.expect(3);

    // Test that we received the proper command
    self.tessel._rps.once('control', function(command) {
      var receivedCommands = command.toString().split(' ');
      var expected = commands.stopRunningScript();
      // Test that the command has the proper number of args
      test.equal(receivedCommands.length, expected.length);

      // And the proper args in each place
      for (var i = 0; i < receivedCommands.length; i++) {
        test.equal(receivedCommands[i], expected[i]);
      }

    });

    self.tessel.eraseScript()
      .then(function() {
        // This test completed satisfactorily
        test.done();
      })
      .catch(function() {
        test.fail('Error thrown on proper flash erase');
      });

    self.tessel._rps.emit('close');
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
