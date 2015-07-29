/*
  Constructor function for Tessel objects
    param connection: the Connection object that represents the physical comm bus
*/
function Tessel(connection) {
  var self = this;

  if (connection === undefined) {
    throw new Error('Cannot create a Tessel with an undefined connection type');
  }
  // Set the connection var so we have an abstract interface to relay comms
  self.connections = [connection];
  // The human readable name of the device
  self.name = undefined;
  // The unique serial number of the device
  self.serialNumber = undefined;
  // Whether or not this connection has been ended
  self.closed = false;

  var endConnection = function() {
    if (self.closed) {
      return;
    } else {
      self.closed = true;
    }
    return new Promise(function(resolve, reject) {
      // Kill all of this Tessel's remote processes
      // return self.connection.end()
      //   .then(function() {
      //     // Exit the process
      //     process.on('exit', function(code) {
      //       process.exit(code);
      //     });

          resolve();
        // })
        // .catch(reject);
    });
  };

  // Once we get a SIGINT from the console
  process.once('SIGINT', endConnection);

  self.close = function() {
    // Remove the SIGINT listener because it's not needed anymore
    if (!self.closed) {
      process.removeListener('SIGINT', endConnection);
    }
    // End the connection
    return endConnection();
  };
}

Object.defineProperty(Tessel.prototype, 'connection', {
  get: function() {
    var index = -1;

    for (var i = 0; i < this.connections.length; i++) {
      if (index === -1 && this.connections[i].connectionType === 'USB') {
        index = i;
      }
      if (this.connections[i].connectionType === 'LAN' &&
        this.connections[i].authorized) {
        index = i;
      }
    }

    // There were no connections to filter, default
    // the index to 0, which will return `undefined`
    if (index === -1) {
      index = 0;
    }
    return this.connections[index];
  }
});

module.exports = Tessel;

require('./provision');
require('./name');
require('./deploy');
require('./erase');
require('./wifi');
require('./update');
