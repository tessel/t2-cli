// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var logs = require('../logs');
var Tessel = require('./tessel');


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
  return this.simpleExec(commands.getWifiInfo())
    .then((resultsJSON) => {
      try {
        var network = JSON.parse(resultsJSON);

        if (network.ssid === undefined) {
          var msg = this.name + ' is not connected to Wi-Fi (run "tessel wifi -l" to see available networks)';
          return Promise.reject(msg);
        }
      } catch (err) {
        return Promise.reject(err);
      }

      return this.simpleExec(commands.getIPAddress())
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
  var ssid = opts.ssid;
  var password = opts.password;
  var security = opts.security;
  var status = 'Wifi connection successful.';

  if (password && !security) {
    security = 'psk2';
  }

  if (password && security) {
    status += ' SSID: ' + ssid + ', password ' + password + ', security mode: ' + security;
  } else if (!password && (!security || security === 'none')) {
    security = 'none';
    status += ' SSID: ' + ssid;
  }

  var setSSID = () => this.simpleExec(commands.setNetworkSSID(ssid));

  var setNetworkPassword = () => this.simpleExec(commands.setNetworkPassword(password));

  var setNetworkSecurity = () => this.connection.exec(commands.setNetworkEncryption(security));

  var turnWifiOn = () => this.setWiFiState(true);

  var logStatus = () => logs.info(status);

  var setup = () => {
    if (password) {
      return setSSID()
        .then(setNetworkPassword)
        .then(setNetworkSecurity);
    } else {
      return setSSID()
        .then(setNetworkSecurity);
    }
  };

  return setup()
    .then(turnWifiOn)
    .then(logStatus);
};

Tessel.prototype.resetMDNS = function() {
  return this.simpleExec(commands.callMDNSDaemon('restart'))
    .then(() => this.simpleExec(commands.callTesselMDNS('restart')));
};

Tessel.prototype.setWiFiState = function(enable) {
  return this.simpleExec(commands.turnOnWifi(enable))
    .then(() => this.simpleExec(commands.commitWirelessCredentials()))
    .then(() => this.simpleExec(commands.reconnectWifi()))
    .then(() => this.simpleExec(commands.ubusListen())
    .then((remoteProcess) => {
      if (enable) {
        this.receive(remoteProcess)
          .then(function(data) {
            if (data.indexOf('ifup') > -1) {
              logs.info('Successfully connected!');
            }
          })
          .catch(function(error) {
            logs.err('Error connecting:', error);
          });
        setTimeout(() => {
          logs.info("Timed out waiting to verify connection. Run `t2 wifi` to manually verify connection. If not connected, ensure you have entered the correct network credentials.");
          // End the connection
          return this.connection.end();
        }, 10000);
      } else {
        return this.connection.end();
      }
    })
    .then(() => logs.info('Wifi', enable ? 'Enabled.' : 'Disabled.'));
};
