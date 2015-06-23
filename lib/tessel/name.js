var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

var defaultNamePrefix = 'Tessel-';

Tessel.prototype.getName = function(callback) {
  var self = this;
  // Ask for the hostname from the remote device
  self.connection.exec(commands.getHostname(), function(err, remoteProc) {
    // Handle any errors that may have occurred
    if (Tessel._commonErrorHandler(err)) {
      return;
    }
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
      // Call the callback
      if (typeof callback === 'function') {
        callback(null, self.name);
      }
    });
  });
};

Tessel.prototype.setName = function(name, callback) {
  var self = this;

  if (!Tessel.isValidName(name)) {
    return;
  }

  // Write the new hostname to the device
  self.connection.exec(commands.setHostname(name), function(err, remoteProc) {
    // Handle any errors that may have occurred
    if (Tessel._commonErrorHandler(err)) {
      return;
    }
    // Pipe stderr of the remote process to this Node process stderr
    remoteProc.stderr.pipe(process.stderr);
    // Once the process completes
    remoteProc.once('close', function() {
      // Commit the new hostname
      self.connection.exec(commands.commitHostname(), function(err, remoteProc) {
        // Handle any errors that may have occurred
        if (Tessel._commonErrorHandler(err)) {
          return;
        }
        // Pipe stderr of the remote process to this Node process stderr
        remoteProc.stderr.pipe(process.stderr);
        // When the process completes the name has been set
        remoteProc.once('close', function() {
          // Write the new name to the kernel hostname as well (so it reports the proper name in the terminal)
          self.connection.exec(commands.openStdinToFile('/proc/sys/kernel/hostname'), function(err, remoteProc) {
            // Handle any errors that may have occurred
            if (Tessel._commonErrorHandler(err)) {
              return;
            }
            // Pipe stderr of the remote process to this Node process stderr
            // call it when this process finishes
            remoteProc.once('close', function() {
              // Reset MDNS so it advertises with the new name
              self.resetMDNS(callback);
            });
            // Write the new name to the stdin
            remoteProc.stdin.end(name);
          });
        });
      });
    });
  });
};

Tessel.prototype.rename = function(opts, callback) {
  var self = this;

  // If we are resetting this name to default
  if (opts.reset) {
    // Get the mac address from the device
    self._getMACAddress(function(err, addr) {
      // Handle any errors that may have occurred
      if (Tessel._commonErrorHandler(err)) {
        return;
      }

      // Set the name with the default prefix
      var defaultName = defaultNamePrefix + addr;

      // Recursively call this function with the new name
      self.setName(defaultName, function(err) {
        // Handle any errors that may have occurred
        if (Tessel._commonErrorHandler(err)) {
          return;
        }

        logs.info('Reset the name of the device to', defaultName);

        // And a callback was provided
        if (typeof callback === 'function') {
          // Call that callback
          callback();
        }
      });
    });
  } else {

    if (!Tessel.isValidName(opts.newName)) {
      return;
    }

    self.getName(function(err, oldName) {
      // Handle any errors that may have occurred
      if (Tessel._commonErrorHandler(err)) {
        return;
      }
      // Don't set the new name if it's the same as the old name
      if (oldName === opts.newName) {
        logs.warn('Name of device is already', oldName);
        // And a callback was provided
        if (typeof callback === 'function') {
          // Call the callback
          callback();
        }
        return;
      }
      // Set the name with the provided arg
      self.setName(opts.newName, function(err) {
        // Handle any errors that may have occurred
        if (Tessel._commonErrorHandler(err)) {
          return;
        }
        // Report the change
        logs.info('Changed name of device', oldName, 'to', opts.newName);
        // And if a callback was provided
        if (typeof callback === 'function') {
          // Call the callback with no error
          callback();
        }
      });
    });
  }
};

Tessel.prototype._getMACAddress = function(callback) {
  var self = this;

  // Fetch details about the eth0 interface
  self.connection.exec(commands.getInterface('eth0'), function(err, remoteProc) {
    // Handle any errors that may have occurred
    if (Tessel._commonErrorHandler(err)) {
      return;
    }

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

      // And a callback was provided
      if (typeof callback === 'function') {
        // Provide the callback the error
        callback(null, macAddr);
      }
    });

    // When we receive data on stdout
    remoteProc.stdout.on('data', function(data) {
      // add it to the contatenated string
      info += data.toString();
    });
  });
};
