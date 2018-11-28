// System Objects
const path = require('path');

// Third Party Dependencies
const colors = require('colors');

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

Object.defineProperties(Tessel.prototype, {
  connection: {
    get() {

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
  },

  displayName: {
    configurable: true,
    get() {
      return this.name === 'your Tessel' ?
        this.name : colors.magenta(this.name);
    },
  },
});

Tessel.prototype.receive = function(remote, callback) {
  var error = '';
  var received = Buffer.alloc(0);

  remote.stderr.on('data', function(buffer) {
    error += buffer.toString();
  });

  remote.stdout.on('data', function(buffer) {
    received = Buffer.concat([received, buffer]);
  });

  remote.once('close', function(exitCode) {
    remote.stderr.removeAllListeners();
    remote.stdout.removeAllListeners();

    if (error) {
      return callback(new Error(error), exitCode);
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

Tessel.REMOTE_APP_PATH = '/app/';
Tessel.REMOTE_TMP_PATH = '/tmp/';
Tessel.REMOTE_SCRIPT_PATH = '/remote-script/';
Tessel.REMOTE_RUN_PATH = path.posix.join(Tessel.REMOTE_TMP_PATH, Tessel.REMOTE_SCRIPT_PATH);

module.exports = Tessel;

require('./access-point');
require('./deploy');
require('./erase');
require('./name');
require('./provision');
require('./update');
require('./version');
require('./wifi');
require('./restore');
require('./reboot');
