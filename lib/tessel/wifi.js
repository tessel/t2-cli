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
    .then(function wifiScanResults(result) {
      // For each string chunk
      return result.trim().split('\n\n').reduce((networks, entry) => {
        try {

          var ssidRegex = /ESSID: "(.*)"/;
          var qualityRegex = /Quality: (.*)/;
          var encryptionRegex = /Encryption: (.*)/;

          var networkInfo = {
            // Parse out the SSID
            ssid: ssidRegex.exec(entry)[1],
            // Parse out the quality of the connection
            quality: qualityRegex.exec(entry)[1],
            // Parse the security type - unused at the moment
            security: encryptionRegex.exec(entry)[1],
          };
          // Add this parsed network to our array
          networks.push(networkInfo);
        } catch (err) {
          // Suppress errors created by entries that cannot be parsed.
        }

        return networks;
      }, []).sort(compareBySignal);
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

function safeQualityExprEvaluation(expr) {
  var parsed = /(\d.*)(?:\/)(\d.*)/.exec(expr);
  var isNumber = parsed === null && typeof + expr === 'number' && !Number.isNaN(+expr);

  // If the expression doesn't match "\d.*/\d.*",
  // but IS a number, then return the number. Otherwise,
  // evaluate the expression as division. ToNumber is
  // applied implicitly. If the expression didn't parse
  // safely, return 0.
  return isNumber ? +expr : (parsed && parsed.length === 3 ? parsed[1] / parsed[2] : 0);
}

function compareBySignal(a, b) {
  var ae = safeQualityExprEvaluation(a.quality);
  var be = safeQualityExprEvaluation(b.quality);

  if (ae > be) {
    return -1;
  } else if (ae < be) {
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
  var logState = () => logs.info('Wifi', enable ? 'Enabled.' : 'Disabled.');

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.turnOnWifi(enable))
      .then(() => this.simpleExec(commands.commitWirelessCredentials()))
      .then(() => this.simpleExec(commands.reconnectWifi()))
      .then(() => new Promise((resolve) => setTimeout(resolve, 2000))) // delay to let wifi reconnection settle before fetching info
      .then(() => this.connection.exec(commands.getWifiInfo()))
      .then((remoteProcess) => {
        if (enable) {
          var result = {};
          var timeout = setTimeout(function() {
            result = {
              type: 'reject',
              message: 'Timed out waiting to verify connection. Run `t2 wifi` to manually verify connection. If not connected, ensure you have entered the correct network credentials.'
            };
            // End the connection
            remoteProcess.close();
          }, Tessel.__wifiConnectionTimeout);
          remoteProcess.stdout.once('data', function(data) {
            if (data.indexOf('signal') > -1) {
              logs.info('Successfully connected!');
              clearTimeout(timeout);
              result = {
                type: 'resolve',
                message: '' // resolve doesn't report messages
              };
              remoteProcess.close();
            } else {
              clearTimeout(timeout);
              result = {
                type: 'reject',
                message: 'Unable to connect. Please check your wifi credentials and try again.'
              };
              remoteProcess.close();
            }
          });
          remoteProcess.on('close', function() {
            if (result.type === 'reject') {
              reject(result.message);
            } else {
              logState();
              resolve();
            }
          });
        } else {
          this.connection.end();
          logState();
          resolve();
        }
      });
  });
};

Tessel.__wifiConnectionTimeout = 10000;
