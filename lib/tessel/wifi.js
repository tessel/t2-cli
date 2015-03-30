var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  , Promise = require('bluebird')
  ;

Tessel.prototype.findAvailableNetworks = function(callback) {
  var self = this;
  return new Promise(function(resolve, reject) {
    tessel.logs.info('Scanning for available networks...');
    self.connection.exec(commands.scanWiFi(), function(err, remoteProcess) {
      if (err) return reject(err);

      var resultsJSON = '';

      remoteProcess.stderr.on('data', function(d) {
        tessel.logs.err(d.toString());
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

    tessel.logs.info("Setting SSID:", ssid, "and password:", password);
    self.connection.exec(commands.setNetworkSSID(ssid), function(err, streams) {
      if (err) return reject(err);
      self.connection.exec(commands.setNetworkPassword(password), function(err, streams) {
        if (err) return reject(err);
        self.connection.exec(commands.commitWirelessCredentials(), function(err, streams) {
          if (err) return reject(err);
          streams.stdout.once('end', function() {
            self.connection.exec(commands.reconnectWifi(), function(err, streams) {
              if (err) return reject(err);
              streams.stdout.once('end', function() {
                tessel.logs.info("Credentials set!");
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
