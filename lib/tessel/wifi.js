var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

Tessel.prototype.findAvailableNetworks = function() {
  logs.info('Scanning for available networks...');
  return this.simpleExec(commands.scanWiFi())
    .then(function wifiScanResults(resultsJSON) {
      // Parse the response
      var networks = '';
      try {
        networks = JSON.parse(resultsJSON).results;
      } catch (err) {
        // Throw any unfortunate errors
        return Promise.reject(err);
      }

      // Sort by signal strength
      networks.sort(compareBySignal);

      // Remove networks without SSIDs
      networks.forEach(function(network, index) {
        if (!network.ssid) {
          networks.splice(index, 1);
        }
      });

      return networks;
    });
};

Tessel.prototype.getWifiInfo = function() {
  var self = this;
  return self.simpleExec(commands.getWifiInfo())
    .then(function fetchedWiFiInfo(resultsJSON) {
      try {
        var network = JSON.parse(resultsJSON);

        if (network.ssid === undefined) {
          var msg = self.name + ' is not connected to Wi-Fi (run "tessel wifi -l" to see available networks)';
          return Promise.reject(msg);
        }
      } catch (err) {
        return Promise.reject(err);
      }

      return self.simpleExec(commands.getIPAddress())
        .then(function(ipResults) {
          network.ips = ipResults.split('\n');
          return Promise.resolve(network);
        });
    });
};

function compareBySignal(a, b) {
  if ((a.quality / a.quality_max) > (b.quality / b.quality_max)) {
    return -1;
  } else if ((a.quality / a.quality_max) < (b.quality / b.quality_max)) {
    return 1;
  } else {
    return 0;
  }
}

Tessel.prototype.connectToNetwork = function(opts) {
  var self = this;
  var ssid = opts.ssid;
  var password = opts.password;

  return new Promise(function(resolve, reject) {
    if (!ssid || !password) {
      return reject(new Error('Invalid credentials. Must set ssid and password'));
    }

    logs.info('Setting SSID:', ssid, 'and password:', password);

    // Set the network SSID
    return self.simpleExec(commands.setNetworkSSID(ssid))
      .then(function() {
        // Then set the password
        return self.simpleExec(commands.setNetworkPassword(password));
      })
      .then(function() {
        // Then make sure wireless is enabled
        return self.setWiFiState(true);
      })
      .then(function() {
        // Then set the new credientials
        logs.info('Credentials set!');
        resolve();
      });
  });
};

Tessel.prototype.resetMDNS = function() {
  var self = this;

  return self.simpleExec(commands.callMDNSDaemon('restart'))
    .then(function restarted() {
      return self.simpleExec(commands.callTesselMDNS('restart'));
    });
};

Tessel.prototype.setWiFiState = function(enable) {
  var self = this;
  return self.simpleExec(commands.turnOnWifi(enable))
    .then(function stateSet() {
      return self.simpleExec(commands.commitWirelessCredentials());
    })
    .then(function committed() {
      return self.simpleExec(commands.reconnectWifi());
    })
    .then(function log() {
      logs.info('Wifi', enable ? 'Enabled.' : 'Disabled.');
    });
};
