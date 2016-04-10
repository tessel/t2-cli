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
    })
    .catch(function checkNoSuchDeviceError(err) {
      if (/No such wireless device/.test(err.message)) {
        return Promise.reject(new Error('Unable to find wireless networks while wifi is disabled. Run "t2 wifi --on" before trying again.'));
      }
      return Promise.reject(err);
    });
};

Tessel.prototype.getWifiInfo = function() {
  return this.simpleExec(commands.getWifiInfo())
    .then((resultsJSON) => {
      try {
        var network = JSON.parse(resultsJSON);

        if (network.ssid === undefined) {
          var msg = `${this.name} is not connected to Wi-Fi (run "t2 wifi -l" to see available networks)`;
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
    })
    .catch((err) => {
      if (err.toString().includes('Not found')) {
        var msg = `${this.name} is not connected to Wi-Fi (run "t2 wifi -l" to see available networks)`;
        return Promise.reject(msg);
      } else {
        return Promise.reject(err);
      }
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
  var status = 'Wifi Connected.';

  if (password && !security) {
    security = 'psk2';
  }

  status += ` SSID: ${ssid}`;

  if (password && security) {
    status += `, password: ${password}, security: ${security}`;
  } else if (!password && (!security || security === 'none')) {
    security = 'none';
  }

  var setSSID = () => this.simpleExec(commands.setNetworkSSID(ssid));

  var setNetworkPassword = () => this.simpleExec(commands.setNetworkPassword(password));

  var setNetworkSecurity = () => this.simpleExec(commands.setNetworkEncryption(security));

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
  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.turnOnWifi(enable))
      .then(() => this.simpleExec(commands.commitWirelessCredentials()))
      .then(() => this.simpleExec(commands.reconnectWifi()))
      .then(() => {
        var settle = (rejection) => {
          if (rejection) {
            reject(rejection);
          } else {
            logs.info('Wifi', enable ? 'Enabled.' : 'Disabled.');
            resolve();
          }
        };
        /*
        To explain the following "magic number"...

        The `tries` limit is set to 10 as an arbitrarily chosen minimum and maximum restriction.
        This could actually be increased to ~33, which is the approximate number of tries
        that could potentially be made in 12 seconds (the delay period (2) + timeout period (10)).
        This was determined by counting the number of complete tries made against a
        known invalid ssid, within a 12 second period. I ran the measurement code 10 times
        and the rounded average count was 33 tries.

        `tries` shouldn't be set lower than 10, as each wifi info request takes approximately 340ms.
        This was determined by measuring the time between each attempt against a known invalid
        ssid (with no tries limit). 340 is the rounded average of 10 complete operations, including
        only the lowest number of measurements; ie. if one operation made 35 tries, and nine
        operatons made 30 tries, then the only the first 30 were included in the result set.

        The result is a maximum of 3.4s before verification is treated as a failure.
        This is slightly more than the previous delay + one operation, but substantially less than
        the full 10 second timeout, with a higher likelihood of success (that is, zero failures were
        observed when using a valid ssid + password + security).
        */
        var tries = 10;
        var pollForWifiSignal = () => {
          this.connection.exec(commands.getWifiInfo(), (err, remoteProcess) => {
            if (err) {
              return reject(err);
            }
            this.receive(remoteProcess, (err, result) => {
              if (err) {
                if (err.toString().includes('Not found')) {
                  return pollForWifiSignal();
                } else {
                  return reject(err);
                }
              }
              if (result.toString().includes('signal')) {
                settle();
              } else {
                tries--;

                if (tries) {
                  pollForWifiSignal();
                } else {
                  settle('Unable to verify connection. Please ensure you have entered the correct network credentials.');
                }
              }
            });
          });
        };

        if (enable) {
          pollForWifiSignal();
        } else {
          settle();
        }
      });
  });
};
