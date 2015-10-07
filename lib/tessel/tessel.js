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
        connection.authorized = true;
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

Tessel.prototype.receive = function(remote) {
  var error = '';
  var received = new Buffer(0);

  remote.stderr.on('data', function(buffer) {
    error += buffer.toString();
  });

  remote.stdout.on('data', function(buffer) {
    received = Buffer.concat([received, buffer]);
  });

  return new Promise(function(resolve, reject) {
    remote.once('close', function() {
      if (error) {
        return reject(new Error(error));
      } else {
        return resolve(received);
      }
    });
  });
};

Tessel.prototype.simpleExec = function(command) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Stop processes and delete everything in the folder
    return self.connection.exec(command)
      .then(function(remoteProcess) {
        return self.receive(remoteProcess).then(function(received) {
          return resolve(received.toString());
        }).catch(reject);
      });
  });
};

Tessel.PUSH_PATH = '/app/';
Tessel.RUN_PATH = '/tmp/remote-script/';

module.exports = Tessel;

require('./provision');
require('./name');
require('./deploy');
require('./erase');
require('./wifi');
require('./update');
