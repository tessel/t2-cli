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
    return self.connection.exec(commands.setNetworkSSID(ssid))
      .then(function() {
        // Then set the password
        return self.connection.exec(commands.setNetworkPassword(password));
      })
      .then(function() {
        // Then make sure wireless is enabled
        return self.connection.exec(commands.turnOnWifi(true));
      })
      .then(function() {
        // Then set the new credientials
        return self.connection.exec(commands.commitWirelessCredentials());
      })
      .then(function(remoteProcess) {
        // Once the credentials have been comitted
        remoteProcess.once('close', function() {
          // Restart the wifi
          return self.connection.exec(commands.reconnectWifi())
            .then(function(remoteProcess) {
              // Once the wifi restart process closes
              return self.receive(remoteProcess).then(function() {
                logs.info('Credentials set. Checking connection...');
                self.connection.exec(commands.ubusListen())
                .then(function(remoteProcess) {
                  remoteProcess.stdout.on("data", function (data) {
                    if(data.toString().indexOf("ifup") > -1) {
                      logs.info("Successfully connected!");
                      // End the connection
                      return self.connection.end()
                        .then(resolve);
                    }
                  });
                  remoteProcess.stderr.on("data", function (data) {
                    logs.info("Error connecting:", data.toString());
                    // End the connection
                    return self.connection.end()
                      .then(resolve);
                  });
                  setTimeout(function () {
                    logs.info("Timed out waiting to verify connection. Run `t2 wifi` to manually verify connection. If not connected, ensure you have entered the correct network credentials.");
                    // End the connection
                    return self.connection.end()
                      .then(resolve);
                  }, 10000);
                });
              });
            });
        });
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
