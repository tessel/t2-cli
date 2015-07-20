var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

var defaultNamePrefix = 'Tessel-';

Tessel.isValidName = function(value) {
  // Regex to test whether a string is a valid Linux hostname
  // http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
  var rvalidHostName = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
  return value && typeof value === 'string' && rvalidHostName.test(value);
};

Tessel.prototype.getName = function() {
  var self = this;
  return new Promise(function(resolve) {
    // Ask for the hostname from the remote device
    return self.connection.exec(commands.getHostname())
      .then(function(remoteProc) {
        // Var to hold the state of the name
        var name = '';
        // Print any errors to the console
        remoteProc.stderr.pipe(process.stderr);

        // When we receive data
        remoteProc.stdout.on('data', function(d) {
          // Add it to the name string
          name += d.toString();
        });

        // When the process completes
        remoteProc.stdout.once('end', function() {
          // Remove any trailing newlines and set the internal variable
          self.name = name.replace(/^\s+|\s+$/g, '');
          // Return the name
          return resolve(self.name);
        });
      });
  });
};

Tessel.prototype.setName = function(name) {
  var self = this;

  return new Promise(function(resolve, reject) {
    if (!Tessel.isValidName(name)) {
      return reject('Invalid name.');
    }
    // Write the new hostname to the device
    return self.connection.exec(commands.setHostname(name))
      .then(function(remoteProc) {
        // Pipe stderr of the remote process to this Node process stderr
        remoteProc.stderr.pipe(process.stderr);
        // Once the process completes
        remoteProc.once('close', function() {
          // Commit the new hostname
          return self.connection.exec(commands.commitHostname())
            .then(function(remoteProc) {
              // Pipe stderr of the remote process to this Node process stderr
              remoteProc.stderr.pipe(process.stderr);
              // When the process completes the name has been set
              remoteProc.once('close', function() {
                // Write the new name to the kernel hostname as well (so it reports the proper name in the terminal)
                return self.connection.exec(commands.openStdinToFile('/proc/sys/kernel/hostname'))
                  .then(function(remoteProc) {
                    // Pipe stderr of the remote process to this Node process stderr
                    // call it when this process finishes
                    remoteProc.once('close', function() {
                      // Reset MDNS so it advertises with the new name
                      return self.resetMDNS()
                        .then(resolve);
                    });
                    // Write the new name to the stdin
                    remoteProc.stdin.end(name);
                  });
              });
            });
        });
      });
  });
};

Tessel.prototype.rename = function(opts) {
  var self = this;
  return new Promise(function(resolve, reject) {

    // If we are resetting this name to default
    if (opts.reset) {
      // Get the mac address from the device
      return self._getMACAddress()
        .then(function(addr) {

          // Create the name with the default prefix
          var defaultName = defaultNamePrefix + addr;

          // Set the new name
          return self.setName(defaultName)
            .then(function() {
              logs.info('Reset the name of the device to', defaultName);
              resolve();
            });
        });
    } else {

      if (!Tessel.isValidName(opts.newName)) {
        return reject('Invalid name');
      }

      self.getName()
        .then(function(oldName) {
          // Don't set the new name if it's the same as the old name
          if (oldName === opts.newName) {
            logs.warn('Name of device is already', oldName);
            // Finish the process
            return resolve();
          } else {
            // Set the name with the provided arg
            return self.setName(opts.newName)
              .then(function() {
                logs.info('Changed name of device', oldName, 'to', opts.newName);
                resolve();
              });
          }
        });
    }
  });
};

Tessel.prototype._getMACAddress = function() {
  var self = this;
  return new Promise(function(resolve) {
    // Fetch details about the eth0 interface
    return self.connection.exec(commands.getInterface('eth0'))
      .then(function(remoteProc) {

        // Report any issues
        remoteProc.stderr.pipe(process.stderr);

        // Var to store incoming chunks of interface information
        var info = '';

        // Once we finish receiving data
        remoteProc.once('close', function() {

          // Capture the mac address out of the info using a regexp
          // Fun fact: lookbehinds aren't supported in JS
          var macAddr = info.match(/(?:HWaddr )(.*)/)[1];

          // Remove any newlines
          macAddr = macAddr.replace(/^\s+|\s+$/g, '');

          // Remove colons, for ex 02:A3:03:3B:47:04 -> 02A3033B4704
          macAddr = macAddr.replace(/:/g, '');

          // Return the mac addres
          resolve(macAddr);
        });

        // When we receive data on stdout
        remoteProc.stdout.on('data', function(data) {
          // add it to the contatenated string
          info += data.toString();
        });
      });
  });
};
