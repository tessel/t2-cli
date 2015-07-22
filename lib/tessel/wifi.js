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

          // Parse the response
          try {
            networks = JSON.parse(resultsJSON).results;
          } catch (err) {
            self.connection.end();
            // Throw any unfortunate errors
            if (err) {
              return reject(err);
            }
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
