'use strict';

// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var log = require('../log');
var Tessel = require('./tessel');


Tessel.prototype.findAvailableNetworks = function() {
  var listed = {};

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

          if (!listed[networkInfo.ssid]) {
            listed[networkInfo.ssid] = true;
            // Add this parsed network to our array
            networks.push(networkInfo);
          }
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
  const parsed = /(\d.*)(?:\/)(\d.*)/.exec(expr);
  const nexpr = +expr;
  const isNumber = parsed === null && typeof nexpr === 'number' && !Number.isNaN(nexpr);

  // If the expression doesn't match "\d.*/\d.*",
  // but IS a number, then return the number. Otherwise,
  // evaluate the expression as division. ToNumber is
  // applied implicitly. If the expression didn't parse
  // safely, return 0.
  return isNumber ? nexpr : (parsed && parsed.length === 3 ? parsed[1] / parsed[2] : 0);
}

function compareBySignal(a, b) {
  const ae = safeQualityExprEvaluation(a.quality);
  const be = safeQualityExprEvaluation(b.quality);

  if (ae > be) {
    return -1;
  } else if (ae < be) {
    return 1;
  } else {
    return 0;
  }
}

Tessel.prototype.connectToNetwork = function(options) {
  const ssid = options.ssid;
  const password = options.password;

  let security = options.security;
  let enable = true;

  if (password && !security) {
    security = 'psk2';
  }

  let configured = 'Wifi Configured.';
  let configuration = `SSID: ${ssid}`;

  if (password && security) {
    let passToDisplay;

    if (options.showpassword) {
      passToDisplay = password;
    } else {
      let rpass = /(^[a-z0-9])(.*?)([a-z0-9])$/ig;
      passToDisplay = password.replace(rpass, (w, f, m, l) => `${f}${'*'.repeat(m.length)}${l}`);
    }

    configuration += `, password: ${passToDisplay}, security: ${security}`;
  }

  if (!password && !security) {
    security = 'none';
  }

  const setSSID = () => {
    let resolution = Promise.resolve();

    if (password) {
      resolution = this.simpleExec(commands.setNetworkPassword(password));
    }

    return resolution.then(
      () => this.simpleExec(commands.setNetworkSSID(ssid))
    );
  };
  const setNetworkSecurity = () => this.simpleExec(commands.setNetworkEncryption(security));
  const turnWifiOn = () => this.setWiFiState({
    enable
  });

  return setSSID()
    .then(setNetworkSecurity)
    .then(turnWifiOn)
    .then(() => {
      log.info(`${configured} (${configuration})`);
      log.info(`Wifi Connected.`);
    });
};

Tessel.prototype.resetMDNS = function() {
  return this.simpleExec(commands.callMDNSDaemon('restart'))
    .then(() => this.simpleExec(commands.callTesselMDNS('restart')));
};

Tessel.prototype.setWiFiState = function(state) {
  if (!state) {
    return Promise.reject(new Error('Missing Wifi State: (empty).'));
  }

  if (typeof state.enable === 'undefined') {
    return Promise.reject(new Error('Missing Wifi State: property "enable" not provided.'));
  }

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.turnOnWifi(state.enable))
      .then(() => this.simpleExec(commands.commitWirelessCredentials()))
      .then(() => {
        return this.simpleExec(commands.reconnectWifi())
          .then((result) => {
            // check if the actual wifi radio (wireless.radio0) is disabled
            if (result.includes("'radio0' is disabled")) {
              return this.simpleExec(commands.turnRadioOn())
                .then(() => this.simpleExec(commands.commitWirelessCredentials()))
                .then(() => this.simpleExec(commands.reconnectWifi()))
                .catch(reject);
            }
          });
      })
      .then(() => {
        const enabledOrDisabled = state.enable ? 'Enabled' : 'Disabled';
        const settle = (rejection) => {
          if (rejection) {
            reject(rejection);
          } else {
            log.info(`Wifi ${enabledOrDisabled}.`);
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
        let tries = 10;
        const pollForWifiSignal = () => {
          this.connection.exec(commands.getWifiInfo(), (error, remoteProcess) => {
            if (error) {
              return reject(error);
            }
            this.receive(remoteProcess, (error, result) => {
              if (error) {
                if (error.toString().includes('Not found') && tries) {
                  tries--;
                  return pollForWifiSignal();
                } else {
                  return reject(error);
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

        if (state.enable) {
          pollForWifiSignal();
        } else {
          settle();
        }
      });
  });
};
