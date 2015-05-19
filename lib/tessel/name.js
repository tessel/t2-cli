var Tessel = require('./tessel')
  , commands = require('./commands')
  , logs = require('../logs')
  ;

var defaultNamePrefix = "Tessel-";

Tessel.prototype.getName = function(callback) {
  var self = this;

  // Ask for the hostname from the remote device
  self.connection.exec(commands.getHostname(), function(err, remoteProc) {
    if (err)  return callback && callback(err);
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
      self.name = name.replace(/^\s+|\s+$/g, "");
      // Call the callback
      callback && callback(null, self.name);
    });
  });
};

Tessel.prototype.setName = function(name, callback) {
  var self = this;

  // Regex to test whether a string is a valid Linux hostname
  // Picked up from http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
  var validHostnameRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

  // If the provided name isn't a string or a valid hostname
  if (typeof name != 'string' || !validHostnameRegex.test(name)) {
    // throw an error
    return callback && callback("Invalid name: " + name + ". The name must be a valid hostname string. See http://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names.");
  }

  // Write the new hostname to the device
  self.connection.exec(commands.setHostname(name), function(err, remoteProc) {
    if (err) return callback && callback(err);
    // Pipe stderr of the remote process to this Node process stderr
    remoteProc.stderr.pipe(process.stderr);
    // Once the process completes
    remoteProc.once('close', function() {
      // Commit the new hostname
      self.connection.exec(commands.commitHostname(), function(err, remoteProc) {
        if (err) return callback && callback(err);
        // Pipe stderr of the remote process to this Node process stderr
        remoteProc.stderr.pipe(process.stderr);
        // When the process completes the name has been set
        remoteProc.once('close', function() {
          // Write the new name to the kernel hostname as well (so it reports the proper name in the terminal)
          self.connection.exec(commands.openStdinToFile('/proc/sys/kernel/hostname'), function(err, remoteProc) {
            if (err) return callback && callback(err);
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
      if (err) return callback && callback(err);

      // Set the name with the default prefix
      var defaultName = defaultNamePrefix+ addr;

      // Recursively call this function with the new name
      self.setName(defaultName, function(err) {
        if (err) return callback && callback(err);

        logs.info('Reset the name of the device to', defaultName);

        callback && callback();
      });
    });
  }
  else {
    self.getName(function(err, oldName) {
      if (err) return callback && callback(err);
      // Don't set the new name if it's the same as the old name
      if (oldName == opts.newName) {
        logs.warn("Name of device is already", oldName);
        callback && callback();
      }
      // Set the name with the provided arg
      self.setName(opts.newName, function(err) {
        if (err) return callback && callback(err);

        logs.info("Changed name of device", oldName, "to", opts.newName);

        callback && callback();
      });
    });
  }
};

Tessel.prototype._getMACAddress = function(callback) {
  var self = this;

  // Fetch details about the eth0 interface
  self.connection.exec(commands.getInterface('eth0'), function(err, remoteProc) {
    if (err) return callback && callback(err);

    // Report any issues
    remoteProc.stderr.pipe(process.stderr);

    // Var to store incoming chunks of interface information
    var info = "";

    // Once we finish receiving data
    remoteProc.once('close', function() {

      // Capture the mac address out of the info using a regexp
      // Fun fact: lookbehinds aren't supported in JS
      var macAddr = info.match(/(?:HWaddr )(.*)/)[1];

      // Remove any newlines
      macAddr = macAddr.replace(/^\s+|\s+$/g, "");

      // Remove colons, for ex 02:A3:03:3B:47:04 -> 02A3033B4704
      macAddr = macAddr.replace(/:/g, '');

      // Call the callback
      callback && callback(null, macAddr);
    });

    // When we receive data on stdout
    remoteProc.stdout.on('data', function(data) {
      // add it to the contatenated string
      info += data.toString();
    });
  });
};
