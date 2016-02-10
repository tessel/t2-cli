/*
  Constructor function for Tessel objects
    param connection: the Connection object that represents the physical comm bus
*/
function Tessel(connection) {
  if (connection === undefined) {
    throw new Error('Cannot create a Tessel with an undefined connection type');
  }

  this.usbConnection = undefined;
  this.lanConnection = undefined;
  this.lanPrefer = false;


  this.close = () => {
    // If this tessel has been closed already
    if (this.closed) {
      // Just resolve
      return Promise.resolve();
      // Otherwise
    } else {
      // Mark as having been closed
      this.closed = true;
    }

    // Kill all of this Tessel's remote processes
    return this.connection.end();
  };

  this.addConnection = (connection) => {
    // Set the connection var so we have an abstract interface to relay comms
    switch (connection.connectionType) {
      case 'USB':
        connection.authorized = true;
        this.usbConnection = connection;
        break;
      case 'LAN':
        this.lanConnection = connection;
        break;
      default:
        throw new Error('Invalid connection provided! Must be USB or LAN.');
    }
  };

  this.setLANConnectionPreference = (preferLan) => {
    this.lanPrefer = preferLan;
  };

  // Add this physical connection to the Tessel
  this.addConnection(connection);
  // The human readable name of the device
  this.name = undefined;
  // The unique serial number of the device
  this.serialNumber = undefined;
  // Whether or not this connection has been ended
  this.closed = false;
}

Object.defineProperty(Tessel.prototype, 'connection', {
  get: function() {

    // If the user prefers LAN and we have an authorized LAN connection, prefer that
    if (this.lanPrefer && this.lanConnection && this.lanConnection.authorized) {
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

Tessel.prototype.receive = function(remote, callback) {
  var error = '';
  var received = new Buffer(0);

  remote.stderr.on('data', function(buffer) {
    error += buffer.toString();
  });

  remote.stdout.on('data', function(buffer) {
    received = Buffer.concat([received, buffer]);
  });

  remote.once('close', function() {
    if (error) {
      return callback(new Error(error));
    } else {
      return callback(null, received);
    }
  });
};

Tessel.prototype.simpleExec = function(command) {
  // Execute a new command
  return new Promise((resolve, reject) => {
    this.connection.exec(command, (err, remoteProcess) => {
      if (err) {
        return reject(err);
      }
      // Wait for the process to close
      this.receive(remoteProcess, (err, received) => {
        if (err) {
          return reject(err);
        } else {
          // Return stdout
          return resolve(received.toString());
        }
      });
    });
  });
};

Tessel.REMOTE_PUSH_PATH = '/app/';
Tessel.REMOTE_RUN_PATH = '/tmp/remote-script/';

module.exports = Tessel;

require('./access-point');
require('./deploy');
require('./erase');
require('./name');
require('./provision');
require('./update');
require('./wifi');
