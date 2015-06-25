/*
  Constructor function for Tessel objects
    param connection: the Connection object that represents the physical comm bus
*/
function Tessel(connection) {
  // Set the connection var so we have an abstract interface to relay comms
  this.connection = connection;
  // The human readable name of the device
  this.name = undefined;
  // The unique serial number of the device
  this.serialNumber = undefined;

  var endConnection = function() {
    // Kill all of this Tessel's remote processes
    this.connection.end(function() {
      // Exit the process
      process.on('exit', function() {
        process.exit(1);
      });
    });
  }.bind(this);

  // Once we get a SIGINT from the console
  process.once('SIGINT', endConnection);

  this.close = function() {
    process.removeListener('SIGINT', endConnection);
  };
}

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
