var RemoteProcessSimulator = require('./remote-process-simulator');
var Tessel = require('../../lib/tessel/tessel');

function TesselSimulator(options) {

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
    close: function() {
      return new Promise(function(resolve) {
        resolve();
      });
    }

  };
  if (!options) {
    options = {};
  }
  var tessel = new Tessel(simConnection);
  tessel._rps = new RemoteProcessSimulator();
  tessel.name = options.name || 'a';
  tessel.serialNumber = tessel.setSerialNumber(options);
  tessel.onnectionType = options.type || 'LAN';
  tessel.authorized = options.authorized !== undefined ? options.authorized : true;

  return tessel;
}
Tessel.prototype.setSerialNumber = function(options) {
  if (options && options.type === 'USB') {
    return options.serialNumber;
  } else {
    return false;
  }
};
Tessel.prototype.mockClose = function() {
  this.close();
  process.removeAllListeners('exit');
  process.removeAllListeners('SIGINT');
};

module.exports = TesselSimulator;
