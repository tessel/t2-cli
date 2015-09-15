var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs'),
  Promise = require('bluebird');

Tessel.prototype.findAvailableNetworks = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    logs.info('Scanning for available networks...');
    return self.connection.exec(commands.scanWiFi())
      .then(function(remoteProcess) {
        var err = '';
        var resultsJSON = '';

        // Gather errors and results
        remoteProcess.stderr.on('data', function(d) {
          err += d.toString();
        });
        remoteProcess.stdout.on('data', function(d) {
          resultsJSON += d.toString();
        });

        // Wait for the transfer to finish...
        remoteProcess.once('close', function() {
          if (err.length) {
            reject(new Error(err));
          }
          var networks;

          try {
            networks = JSON.parse(resultsJSON).results;
          } catch (err) {
            self.connection.end();
            return reject(err);
          }

          // Sort by signal strength
          networks.sort(compareBySignal);

          // Remove networks without SSIDs
          networks.forEach(function(network, index) {
            if (!network.ssid) {
              networks.splice(index, 1);
            }
          });

          return self.connection.end()
            .then(function() {
              // Return the networks
              return resolve(networks);
            });
        });
      });
  });
};

Tessel.prototype.getWifiInfo = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    return self.connection.exec(commands.getWifiInfo())
      .then(function(remoteProcess) {
        var err = '';
        var resultsJSON = '';

        remoteProcess.stderr.on('data', function(d) {
          err += d.toString();
        });
        remoteProcess.stdout.on('data', function(d) {
          resultsJSON += d.toString();
        });

        remoteProcess.once('close', function() {
          var network;
          if (err.length) {
            return reject(new Error(err));
          }

          try {
            network = JSON.parse(resultsJSON);
          } catch (err) {
            return self.connection.end()
              .then(function() {
                reject(err);
              });
          }

          if (network.ssid === undefined) {
            var msg = self.name + ' is not connected to Wi-Fi (run "tessel wifi -l" to see available networks)';
            return reject(new Error(msg));
          }

          return self.connection.exec(commands.getIPAddress())
            .then(function(rp) {
              var err = '';
              var result = '';

              rp.stderr.on('data', function(d) {
                err += d.toString();
              });
              rp.stdout.on('data', function(d) {
                result += d.toString();
              });

              rp.once('close', function() {
                if (err.length) {
                  reject(new Error(err));
                }

                try {
                  network.ips = result.split('\n');
                } catch (err) {
                  return self.connection.end()
                    .then(function() {
                      reject(err);
                    });
                }

                return self.connection.end()
                  .then(function() {
                    return resolve(network);
                  });
              });
            });
        });
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

  return new Promise(function(resolve) {
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
              remoteProcess.once('close', function() {
                logs.info('Credentials set!');
                // End the connection
                return self.connection.end()
                  .then(resolve);
              });
            });
        });
      });
  });
};

Tessel.prototype.resetMDNS = function() {
  var self = this;

  return new Promise(function(resolve) {
    // Tell the general MDNS daemon to restart
    return self.connection.exec(commands.callMDNSDaemon('restart'))
      .then(function(remoteProcess) {
        // Write any errors to the console
        remoteProcess.stderr.pipe(process.stderr);

        // When that completes
        remoteProcess.once('close', function() {
          // Tell the Tessel MDNS advertising agent to restart
          return self.connection.exec(commands.callTesselMDNS('restart'))
            .then(function(remoteProcess) {
              // Write any errors to the console
              remoteProcess.stderr.pipe(process.stderr);
              // Resolve upon completion
              remoteProcess.once('close', resolve);
            });
        });
      });
  });
};
