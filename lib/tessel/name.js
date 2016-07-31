// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var log = require('../log');
var Tessel = require('./tessel');

var defaultNamePrefix = 'Tessel-';

Tessel.isValidName = function(value) {
  // Regex to test whether a string is a valid Linux hostname
  // http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
  var rvalidHostName = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
  return value && typeof value === 'string' && rvalidHostName.test(value);
};

Tessel.prototype.getName = function() {
  if (this.usbConnection && this.usbConnection.intf.altSetting === 1) {
    this.name = 'your Tessel';
    return Promise.resolve();
  }

  return this.simpleExec(commands.getHostname())
    .then((name) => {
      // Remove any trailing newlines and set the internal variable
      this.name = name.replace(/^\s+|\s+$/g, '');
      // Return the name
      return this.name;
    });
};

Tessel.prototype.setName = function(name) {
  return new Promise((resolve, reject) => {
    if (!Tessel.isValidName(name)) {
      return reject('Invalid name.');
    }
    // Write the new hostname to the device
    return this.simpleExec(commands.setHostname(name))
      .then(() => {
        // Commit the new hostname
        return this.simpleExec(commands.commitHostname());
      })
      .then(() => {
        // Write the new name to the kernel hostname as well (so it reports the proper name in the terminal)
        this.connection.exec(commands.openStdinToFile('/proc/sys/kernel/hostname'), (err, remoteProc) => {
          if (err) {
            return reject(err);
          } else {
            remoteProc.stdin.end(name);
          }
        });
      })
      // Reset MDNS so it advertises with the new name
      .then(() => {
        return this.resetMDNS()
          .then(resolve);
      })
      .catch(reject);
  });
};

Tessel.prototype.rename = function(opts) {
  return new Promise((resolve, reject) => {

    // If we are resetting this name to default
    if (opts.reset) {
      // Get the mac address from the device
      return this._getMACAddress()
        .then((addr) => {

          // Create the name with the default prefix
          var defaultName = defaultNamePrefix + addr;

          // Set the new name
          return this.setName(defaultName)
            .then(function() {
              log.info('Reset the name of the device to', defaultName);
              resolve();
            });
        });
    } else {

      if (!Tessel.isValidName(opts.newName)) {
        return reject('Invalid name');
      }

      this.getName()
        .then((oldName) => {
          // Don't set the new name if it's the same as the old name
          if (oldName === opts.newName) {
            log.warn('Name of device is already', oldName);
            // Finish the process
            return resolve();
          } else {
            // Set the name with the provided arg
            return this.setName(opts.newName)
              .then(function() {
                log.info('Changed name of device', oldName, 'to', opts.newName);
                resolve();
              });
          }
        });
    }
  });
};

Tessel.prototype._getMACAddress = function() {
  return this.simpleExec(commands.getInterface('eth0'))
    .then(function fetchedInterface(interfaceInfo) {
      // Capture the mac address out of the info using a regexp
      // Fun fact: lookbehinds aren't supported in JS
      var macAddr = interfaceInfo.match(/(?:HWaddr )(.*)/)[1];

      // Remove any newlines
      macAddr = macAddr.replace(/^\s+|\s+$/g, '');

      // Remove colons, for ex 02:A3:03:3B:47:04 -> 02A3033B4704
      return macAddr.replace(/:/g, '');
    });
};
