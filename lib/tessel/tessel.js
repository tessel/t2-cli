/*
  Constructor function for Tessel objects
    param connection: the Connection object that represents the physical comm bus
*/
function Tessel(connection) {
  var self = this;

  if (connection === undefined) {
    throw new Error('Cannot create a Tessel with an undefined connection type');
  }

  self.usbConnection = undefined;
  self.lanConnection = undefined;


  self.close = function() {
    // If this tessel has been closed already
    if (self.closed) {
      // Just resolve
      return Promise.resolve();
      // Otherwise
    } else {
      // Mark as having been closed
      self.closed = true;
    }

    // Kill all of this Tessel's remote processes
    return self.connection.end();
  };

  self.addConnection = function(connection) {
    // Set the connection var so we have an abstract interface to relay comms
    switch (connection.connectionType) {
      case 'USB':
        self.usbConnection = connection;
        break;
      case 'LAN':
        self.lanConnection = connection;
        break;
      default:
        throw new Error('Invalid connection provided! Must be USB or LAN.');
    }
  };

  // Add this physical connection to the Tessel
  self.addConnection(connection);
  // The human readable name of the device
  self.name = undefined;
  // The unique serial number of the device
  self.serialNumber = undefined;
  // Whether or not this connection has been ended
  self.closed = false;
}

Object.defineProperty(Tessel.prototype, 'connection', {
  get: function() {
    // If we have an authorized LAN connection, prefer that
    if (this.lanConnection && this.lanConnection.authorized) {
      return this.lanConnection;
    }
    // If we have a USB connection, prefer that next
    else if (this.usbConnection) {
      return this.usbConnection;
    }
    // Worse case, we just have a non authorized LAN connection
    else if (this.lanConnection) {
      return this.lanConnection;
    }
  }
});

Tessel.prototype.simpleExec = function(command) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Stop processes and delete everything in the folder
    return self.connection.exec(command)
      .then(function(remoteProcess) {

        // Buffer to store incoming error data
        var errBuf = new Buffer(0);
        // If we receive error data
        remoteProcess.stderr.on('data', function(e) {
          // Concatenate the data
          errBuf = Buffer.concat([errBuf, e]);
        });

        // Buffer to store incoming stdout data
        var dataBuf = new Buffer(0);
        // If we receive stdout data
        remoteProcess.stdout.on('data', function(d) {
          // Concatenate the data
          dataBuf = Buffer.concat([dataBuf, d]);
        });

        // Once the process completes
        remoteProcess.once('close', function() {
          // Check if an error occurred
          if (errBuf.length) {
            return reject(new Error(errBuf.toString()));
          }
          // Assume it worked if there was no error
          else {
            resolve(dataBuf.toString());
          }
        });
      });
  });
};

Tessel.PUSH_PATH = '/app';
Tessel.RUN_PATH = '/tmp/remote-script';

module.exports = Tessel;

require('./provision');
require('./name');
require('./deploy');
require('./erase');
require('./wifi');
require('./update');
