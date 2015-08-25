var RemoteProcessSimulator = require('./remote-process-simulator');
var Tessel = require('../../lib/tessel/tessel');

function TesselSimulator(connectionType) {
  var simConnection = {
    exec: function(command) {
      return new Promise(function(resolve) {
        if (!Array.isArray(command)) {
          throw new Error('Invalid command passed to exec.');
        }

        tessel._rps.control.write(command.join(' '));

        resolve(tessel._rps);
      });
    },
    end: function() {
      return new Promise(function(resolve) {
        resolve();
      });
    },
    connectionType: connectionType || 'USB',
  };

  var tessel = new Tessel(simConnection);
  tessel._rps = new RemoteProcessSimulator();

  return tessel;
}

Tessel.prototype.mockClose = function() {
  this.close();
  process.removeAllListeners('exit');
  process.removeAllListeners('SIGINT');
};

module.exports = TesselSimulator;
