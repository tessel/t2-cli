var Tessel = require('./tessel')
  , commands = require('./commands')
  , logs = require('../logs')
  , Promise = require('bluebird')
  ;

Tessel.prototype.findAvailableNetworks = function(callback) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logs.info('Scanning for available networks...');
    self.connection.exec(commands.scanWiFi(), function(err, remoteProcess) {
      if (err) return reject(err);

      var resultsJSON = '';

      remoteProcess.stderr.on('data', function(d) {
        logs.err(d.toString());
      });

      // Gather the results
      remoteProcess.stdout.on('data', function(d) {
        resultsJSON += d;
      });

      // Wait for the transfer to finish...
      remoteProcess.once('close', function() {
        var networks;
        var someFound = false;

        // Parse the response
        try {
          networks = JSON.parse(resultsJSON).results;
        }
        catch(err) {
          self.connection.end();
          // Throw any unfortunate errors
          if (err) return reject(err);
        }

        // Sort by signal strength
        networks.sort(compareBySignal)

        // Remove networks without SSIDs
        networks.forEach(function(network, index) {
          if (!network.ssid) {
            networks.splice(index,1);
          }
        });

        self.connection.end(function() {
          // Return the networks
          return resolve(networks);
        });
      });
    });
  });
}

function compareBySignal(a,b) {
  if ((a.quality/a.quality_max) > (b.quality/b.quality_max))
     return -1;
  if ((a.quality/a.quality_max) < (b.quality/b.quality_max))
    return 1;
  return 0;
}

Tessel.prototype.getIPAddress = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (self.connection.connectionType === "LAN") {
      // Return the IP Address
      resolve(self.connection.ip)
    }

    self.connection.exec(commands.connectedNetworkStatus(), function (err, streams) {
      if (err) reject(err);

      var resultsJSON = '';

      // Gather the results
      streams.stdout.on('data', function(d) {
        resultsJSON += d;
      });

      // Wait for the transfer to finish...
      streams.stdout.once('end', function() {
        var status;
        var someFound = false;

        // Parse the response
        try {
          status = JSON.parse(resultsJSON);
        }
        catch(err) {
          self.connection.end(function() {
            callback && callback(err);
          });
        }

        // We've finished, close the connection
        self.connection.end(function() {
          // Resolve with address
          resolve(status['ipv4-address'][0].address);
        });
      });
    });
  });
}

Tessel.prototype.connectToNetwork = function(opts) {
  var self = this;
  var ssid = opts.ssid;
  var password = opts.password;

  return new Promise(function(resolve, reject) {
    if (!ssid || !password) {
      return reject(new Error("Invalid credentials. Must set ssid and password"));
    }

    logs.info("Setting SSID:", ssid, "and password:", password);
    self.connection.exec(commands.setNetworkSSID(ssid), function(err, remoteProcess) {
      if (err) return reject(err);
      self.connection.exec(commands.setNetworkPassword(password), function(err, remoteProcess) {
        if (err) return reject(err);
        self.connection.exec(commands.commitWirelessCredentials(), function(err, remoteProcess) {
          if (err) return reject(err);
          remoteProcess.once('close', function() {
            self.connection.exec(commands.reconnectWifi(), function(err, remoteProcess) {
              if (err) return reject(err);
              remoteProcess.once('close', function() {
                logs.info("Credentials set!");
                self.connection.end(function() {
                  return resolve();
                });
              });
            });
          });
        });
      });
    });
  });
}

Tessel.prototype.resetMDNS = function(callback) {
  var self = this;

  // Tell the general MDNS daemon to restart
  self.connection.exec(commands.callMDNSDaemon('restart'), function(err, remoteProcess) {
    // If there was an error report it
    if (err) return callback && callback(err);
    remoteProcess.stderr.pipe(process.stderr);

    // When that completes
    remoteProcess.once('close', function() {
      // Tell the Tessel MDNS advertising agent to restart
      self.connection.exec(commands.callTesselMDNS('restart'), function(err, remoteProcess) {
        // Report any errors
        if (err) return callback && callback(err);
        remoteProcess.stderr.pipe(process.stderr);

        // Call the callback once this completes
        callback && remoteProcess.once('close', callback);
      });
    });
  });
}
