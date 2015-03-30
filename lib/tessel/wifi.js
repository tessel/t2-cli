var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  , Promise = require('bluebird')
  ;

Tessel.prototype.findAvailableNetworks = function(callback) {
  var self = this;
  return new Promise(function(resolve, reject) {
    tessel.logs.info('Scanning for available networks...');
    self.connection.exec(commands.scanWiFi(), function(err, streams) {
      if (err) return reject(err);

      var resultsJSON = '';

      // Gather the results
      streams.stdin.on('data', function(d) {
        resultsJSON += d;
      });

      // Wait for the transfer to finish...
      streams.stdin.once('finish', function() {
        var networks;
        var someFound = false;

        // Parse the response
        try {
          networks = JSON.parse(resultsJSON).results;
        }
        catch(err) {
          streams.stdin.close();
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
        // Close our stream and ssh connection
        streams.stdin.close();

        self.connection.end();
        // Return the networks
        return resolve(networks);
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
      streams.stdin.on('data', function(d) {
        resultsJSON += d;
      });

      // Wait for the transfer to finish...
      streams.stdin.once('finish', function() {
        var status;
        var someFound = false;

        // Parse the response
        try {
          status = JSON.parse(resultsJSON);
        }
        catch(err) {
          streams.stdin.close();
          self.connection.end();
          callback && callback(err);
        }

        // We've finished, close the connection
        streams.stdin.close();
        self.connection.end();
        // Resolve with address
        resolve(status['ipv4-address'][0].address);
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

    self.connection.exec(commands.connectToNetwork(ssid, password), function(err, streams) {
      if (err) return reject(err);

      streams.stdin.once('close', function() {
        tessel.logs.info("Credentials set!");
        self.connection.end();
        return resolve();
      });
    });
  });

}
