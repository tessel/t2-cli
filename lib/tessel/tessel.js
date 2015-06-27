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

  var endConnection = function() {
    return new Promise(function(resolve, reject) {
      // Kill all of this Tessel's remote processes
      self.connection.end(function(err) {
        // Exit the process
        process.on('exit', function(code) {
          process.exit(code);
        });

        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  // Once we get a SIGINT from the console
  process.once('SIGINT', endConnection);

  self.close = function() {
    // Remove the SIGINT listener because it's not needed anymore
    process.removeListener('SIGINT', endConnection);
    // End the connection
    return endConnection();
  };
}

Object.defineProperty(Tessel.prototype, 'connection', {
  get: function() {
    for (var i = 0; i < this.connections.length; i++) {
      if (this.connections[i].connectionType === 'LAN') {
        return this.connections[i];
      }
    }

    return this.connections[0];
  },
  set: function(connection) {
    this.connections.push(connection);
  }
});

// Temporary function until we fully switch over to Promises
Tessel._commonErrorHandler = function(err, callback) {
  // If an error occurred
  if (err) {
    // And a callback was provided
    if (typeof callback === 'function') {
      // Provide the callback the error
      callback(err);
    }
    return true;
  }
  return false;
};


module.exports = Tessel;

require('./provision');
require('./name');
require('./deploy');
require('./erase');
require('./wifi');
