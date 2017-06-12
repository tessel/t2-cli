'use strict';

// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['Tessel.prototype.findAvailableNetworks'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.findAvailableNetworks = this.sandbox.spy(Tessel.prototype, 'findAvailableNetworks');
    this.tessel = TesselSimulator();

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  noNetworks(test) {
    test.expect(1);

    this.tessel.findAvailableNetworks()
      .then(function(networks) {
        test.equal(networks.length, 0);
        test.done();
      });

    var networks = '';

    this.tessel._rps.stdout.push(networks);

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  someNetworks(test) {
    test.expect(2);

    var networks =
      `Cell 01 - Address: 14:35:8B:11:30:F0
              ESSID: "technicallyHome"
              Mode: Master  Channel: 11
              Signal: -55 dBm  Quality: 55/70
              Encryption: mixed WPA/WPA2 PSK (TKIP, CCMP)

    Cell 02 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "Fried Chicken Sandwich"
              Mode: Master  Channel: 2
              Signal: -51 dBm  Quality: 59/70
              Encryption: WPA2 PSK (CCMP)

`;
    // Do not remove the blank line at the end of preceding string!!

    this.tessel.findAvailableNetworks()
      .then((found) => {
        test.equal(found.length, 2);
        test.equal(this.findAvailableNetworks.callCount, 1);
        test.done();
      });

    this.tessel._rps.stdout.push(networks);

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  dedupeNetworks(test) {
    test.expect(2);

    var networks =
      `Cell 01 - Address: 14:35:8B:11:30:F0
              ESSID: "technicallyHome"
              Mode: Master  Channel: 11
              Signal: -55 dBm  Quality: 55/70
              Encryption: mixed WPA/WPA2 PSK (TKIP, CCMP)

    Cell 02 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "Fried Chicken Sandwich"
              Mode: Master  Channel: 2
              Signal: -51 dBm  Quality: 59/70
              Encryption: WPA2 PSK (CCMP)

    Cell 03 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "Fried Chicken Sandwich"
              Mode: Master  Channel: 2
              Signal: -51 dBm  Quality: 59/70
              Encryption: WPA2 PSK (CCMP)

    Cell 04 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "Fried Chicken Sandwich"
              Mode: Master  Channel: 2
              Signal: -51 dBm  Quality: 59/70
              Encryption: WPA2 PSK (CCMP)

    Cell 05 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "Fried Chicken Sandwich"
              Mode: Master  Channel: 2
              Signal: -51 dBm  Quality: 59/70
              Encryption: WPA2 PSK (CCMP)

`;
    // Do not remove the blank line at the end of preceding string!!

    this.tessel.findAvailableNetworks()
      .then((found) => {
        test.equal(found.length, 2);
        test.equal(this.findAvailableNetworks.callCount, 1);
        test.done();
      });

    this.tessel._rps.stdout.push(networks);

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  compareSignalStrengths(test) {
    test.expect(6);


    var networks = `Cell 01 - Address: 14:35:8B:11:30:F0
              ESSID: "middle"
              Mode: Master  Channel: 11
              Signal: -55 dBm  Quality: 30/70
              Encryption: mixed WPA/WPA2 PSK (TKIP, CCMP)

    Cell 02 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "second worst"
              Mode: Master  Channel: 2
              Signal: -57 dBm  Quality: 5/70
              Encryption: WPA2 PSK (CCMP)

    Cell 03 - Address: 6C:70:9F:D9:7A:5C
            ESSID: "best"
            Mode: Master  Channel: 2
            Signal: -57 dBm  Quality: 60/70
            Encryption: WPA2 PSK (CCMP)

    Cell 04 - Address: 6C:70:9F:D9:7A:5C
            ESSID: "worst"
            Mode: Master  Channel: 2
            Signal: -56 dBm  Quality: 5/70
            Encryption: WPA2 PSK (CCMP)

`;
    // Do not remove the blank line at the end of preceding string!!

    this.tessel.findAvailableNetworks()
      .then((found) => {
        test.equal(found.length, 4);
        test.equal(this.findAvailableNetworks.callCount, 1);
        test.equal(found[0].ssid, 'best');
        test.equal(found[1].ssid, 'middle');
        test.equal(found[2].ssid, 'second worst');
        test.equal(found[3].ssid, 'worst');
        test.done();
      });

    this.tessel._rps.stdout.push(networks);

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  compareSignalStrengthSafe(test) {
    test.expect(8);

    // NOTE:
    // "Signal: -55 dBm  Quality: 30/"
    //
    // is INTENTIONAL!!!
    var networks = `Cell 01 - Address: 14:35:8B:11:30:F0
              ESSID: "worst"
              Mode: Master  Channel: 11
              Signal: -55 dBm  Quality: 30/
              Encryption: mixed WPA/WPA2 PSK (TKIP, CCMP)

    Cell 02 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "middle"
              Mode: Master  Channel: 2
              Signal: -57 dBm  Quality: 5/70
              Encryption: WPA2 PSK (CCMP)

    Cell 03 - Address: 6C:70:9F:D9:7A:5C
            ESSID: "best"
            Mode: Master  Channel: 2
            Signal: -57 dBm  Quality: 100
            Encryption: WPA2 PSK (CCMP)

`;
    // Do not remove the blank line at the end of preceding string!!

    this.tessel.findAvailableNetworks()
      .then((found) => {

        test.equal(found.length, 3);
        test.equal(this.findAvailableNetworks.callCount, 1);
        test.equal(found[0].ssid, 'best');
        test.equal(found[1].ssid, 'middle');
        test.equal(found[2].ssid, 'worst');

        test.equal(found[0].quality, '100');
        test.equal(found[1].quality, '5/70');
        test.equal(found[2].quality, '30/');

        test.done();
      });

    this.tessel._rps.stdout.push(networks);

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  rejectNoWirelessDevice(test) {
    test.expect(1);
    var errorMessage = 'Unknown error message';

    this.tessel._rps.on('control', (command) => {
      if (command.toString() === commands.scanWiFi().join(' ')) {
        setImmediate(() => {
          this.tessel._rps.stderr.emit('data', new Buffer(errorMessage));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.findAvailableNetworks()
      .then(() => {
        test.ok(false, 'findAvailableNetworks should reject');
        test.done();
      })
      .catch((error) => {
        test.equal(error.message, errorMessage);
        test.done();
      });
  },

  rejectUnknownError(test) {
    test.expect(1);

    this.tessel._rps.on('control', (command) => {
      if (command.toString() === commands.scanWiFi().join(' ')) {
        setImmediate(() => {
          this.tessel._rps.stderr.emit('data', new Buffer('No such wireless device'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.findAvailableNetworks()
      .then(() => {
        test.ok(false, 'findAvailableNetworks should reject');
        test.done();
      })
      .catch((error) => {
        test.equal(error.message, 'Unable to find wireless networks while wifi is disabled. Run "t2 wifi --on" before trying again.');
        test.done();
      });
  },
};

module.exports['Tessel.prototype.connectToNetwork'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.connectToNetwork = this.sandbox.spy(Tessel.prototype, 'connectToNetwork');
    this.setNetworkSSID = this.sandbox.spy(commands, 'setNetworkSSID');
    this.setNetworkPassword = this.sandbox.spy(commands, 'setNetworkPassword');
    this.setNetworkEncryption = this.sandbox.spy(commands, 'setNetworkEncryption');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.getWifiInfo = this.sandbox.spy(commands, 'getWifiInfo');
    this.tessel = TesselSimulator();

    done();
  },
  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },
  noPassword(test) {
    test.expect(8);
    var creds = {
      ssid: 'tank'
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.connectToNetwork(creds)
      .then(() => {
        test.equal(this.setNetworkSSID.callCount, 1);
        test.equal(this.setNetworkPassword.callCount, 0);
        test.equal(this.setNetworkEncryption.callCount, 1);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.ok(this.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setNetworkEncryption.lastCall.calledWith('none'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },
  properCredentials(test) {
    test.expect(9);
    var creds = {
      ssid: 'tank',
      password: 'fish'
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.connectToNetwork(creds)
      .then(() => {
        test.equal(this.setNetworkSSID.callCount, 1);
        test.equal(this.setNetworkPassword.callCount, 1);
        test.equal(this.setNetworkEncryption.callCount, 1);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.ok(this.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(this.setNetworkEncryption.lastCall.calledWith('psk2'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  properCredentialsWithSecurity(test) {
    test.expect(9);
    var creds = {
      ssid: 'tank',
      password: 'fish',
      security: 'wpa2'
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.connectToNetwork(creds)
      .then(() => {
        test.equal(this.setNetworkSSID.callCount, 1);
        test.equal(this.setNetworkPassword.callCount, 1);
        test.equal(this.setNetworkEncryption.callCount, 1);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.ok(this.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(this.setNetworkEncryption.lastCall.calledWith(creds.security));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  connectionFails(test) {
    test.expect(9);
    var creds = {
      ssid: 'tank',
      password: 'not_gonna_work'
    };
    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          // Is missing the "signal" status key
          this.tessel._rps.stderr.emit('data', new Buffer('Unable to connect to the network.'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stderr so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.connectToNetwork(creds)
      .then(function() {
        test.ok(false, 'Test should have rejected with an error.');
        test.done();
      })
      .catch(() => {
        test.equal(this.setNetworkSSID.callCount, 1);
        test.equal(this.setNetworkPassword.callCount, 1);
        test.equal(this.setNetworkEncryption.callCount, 1);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.ok(this.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(this.setNetworkEncryption.lastCall.calledWith('psk2'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      });
  },

  connectionUnverifiable(test) {
    test.expect(10);
    var creds = {
      ssid: 'tank',
      password: 'not_gonna_work'
    };
    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // console.log(this.tessel._rps);
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          // Is missing the "signal" status key
          this.tessel._rps.stdout.emit('data', new Buffer('{"frequency": 2422,"txpower": 20}'));
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.stderr.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stderr so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.stderr.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.connectToNetwork(creds)
      .then(function() {
        test.ok(false, 'Test should have rejected with an error.');
        test.done();
      })
      .catch((error) => {
        test.equal(error.includes('Unable to verify connection'), true);
        test.equal(this.setNetworkSSID.callCount, 1);
        test.equal(this.setNetworkPassword.callCount, 1);
        test.equal(this.setNetworkEncryption.callCount, 1);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.ok(this.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(this.setNetworkEncryption.lastCall.calledWith('psk2'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      });
  },
  // Sometimes the keyword for success (signal) is not in the first batch
  // of stdout data
  batchedResponse(test) {
    test.expect(9);
    var creds = {
      ssid: 'tank',
      password: 'should work'
    };

    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stderr so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          // First write some random data
          this.tessel._rps.stdout.emit('data', new Buffer('do not have success yet'));
          // then write the keyword we're looking for for success
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stderr so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.connectToNetwork(creds)
      .then(() => {
        test.equal(this.setNetworkSSID.callCount, 1);
        test.equal(this.setNetworkPassword.callCount, 1);
        test.equal(this.setNetworkEncryption.callCount, 1);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.ok(this.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(this.setNetworkEncryption.lastCall.calledWith('psk2'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch((error) => {
        test.ok(false, 'Should not have received an error with batched response', error);
        test.done();
      });
  }
};

module.exports['Tessel.prototype.setWifiState'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.tessel = TesselSimulator();
    this.simpleExec = this.sandbox.spy(this.tessel, 'simpleExec');
    this.turnOnWifi = this.sandbox.spy(commands, 'turnOnWifi');
    this.turnRadioOn = this.sandbox.spy(commands, 'turnRadioOn');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.getWifiInfo = this.sandbox.spy(commands, 'getWifiInfo');

    done();
  },
  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  setWifiStateMissingState(test) {
    test.expect(1);

    this.tessel.setWiFiState()
      .catch(error => {
        test.equal(error.toString(), 'Error: Missing Wifi State: (empty).');
        test.done();
      });
  },

  setWifiStateMissingStateEnable(test) {
    test.expect(1);

    this.tessel.setWiFiState({})
      .catch(error => {
        test.equal(error.toString(), 'Error: Missing Wifi State: property "enable" not provided.');
        test.done();
      });
  },

  setWifiStateTruthy(test) {
    test.expect(8);
    const state = {
      enable: true
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.setWiFiState(state)
      .then(() => {
        test.equal(this.simpleExec.calledThrice, true);
        test.equal(this.turnOnWifi.callCount, 1);
        test.deepEqual(this.turnOnWifi.lastCall.returnValue, ['uci', 'set', 'wireless.@wifi-iface[0].disabled=0']);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.info.callCount, 1);
        test.equal(this.info.lastCall.args[0].includes('Enabled'), true);
        test.equal(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },
  setWifiStateFalsy(test) {
    test.expect(8);
    const state = {
      enable: false
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}' && state.enable) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.setWiFiState(state)
      .then(() => {
        test.equal(this.simpleExec.calledThrice, true);
        test.equal(this.turnOnWifi.callCount, 1);
        test.deepEqual(this.turnOnWifi.lastCall.returnValue, ['uci', 'set', 'wireless.@wifi-iface[0].disabled=1']);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.info.calledOnce, true);
        test.equal(this.info.lastCall.args[0].includes('Disabled'), true);
        test.equal(this.getWifiInfo.callCount, 0);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },
  setWifiStateWhenRadioOff(test) {
    test.expect(9);
    const state = {
      enable: true
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}' && state.enable) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'wifi') {
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer(`'radio0' is disabled`));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.setWiFiState(state)
      .then(() => {
        test.equal(this.simpleExec.callCount, 6);
        test.equal(this.turnOnWifi.callCount, 1);
        test.equal(this.turnRadioOn.callCount, 1);
        test.deepEqual(this.turnOnWifi.lastCall.returnValue, ['uci', 'set', 'wireless.@wifi-iface[0].disabled=0']);
        test.equal(this.commitWirelessCredentials.callCount, 2);
        test.equal(this.reconnectWifi.callCount, 2);
        test.equal(this.info.calledOnce, true);
        test.equal(this.info.lastCall.args[0].includes('Enabled'), true);
        test.equal(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },
  setWifiStateError(test) {
    test.expect(9);
    const state = {
      enable: true
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}' && state.enable) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('signal'));
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'wifi') {
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer(`Some other error`));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.setWiFiState(state)
      .then(() => {
        test.equal(this.simpleExec.callCount, 3);
        test.equal(this.turnOnWifi.callCount, 1);
        test.equal(this.turnRadioOn.callCount, 0);
        test.deepEqual(this.turnOnWifi.lastCall.returnValue, ['uci', 'set', 'wireless.@wifi-iface[0].disabled=0']);
        test.equal(this.commitWirelessCredentials.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.info.calledOnce, true);
        test.equal(this.info.lastCall.args[0].includes('Enabled'), true);
        test.equal(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  setWifiStateNotFoundTimeout(test) {
    test.expect(2);

    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stderr so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stderr.emit('data', new Buffer('Not found'));
          this.tessel._rps.stderr.removeAllListeners();
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.stderr.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.setWiFiState({
        enable: true
      })
      .then(() => {
        test.ok(false, 'setWiFiState should reject error');
        test.done();
      })
      .catch((error) => {
        test.equal(error.toString(), 'Error: Not found');
        test.equal(this.getWifiInfo.callCount, 11);
        test.done();
      });
  },

  setWifiStateConnectionError(test) {
    test.expect(2);

    var originalExec = this.tessel.connection.exec;
    this.tessel.connection.exec = function(command, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }

      if (command.join(' ') === 'ubus call iwinfo info {"device":"wlan0"}') {
        return callback(new Error('Testing error'));
      }

      return originalExec(command, options, callback);
    };

    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        // Remove any listeners on stdout so we don't break anything when we write to it
        this.tessel._rps.stdout.removeAllListeners();
        this.tessel._rps.stderr.removeAllListeners();
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.setWiFiState({
        enable: true
      })
      .then(() => {
        test.ok(false, 'setWiFiState should reject error');
        test.done();
      })
      .catch((error) => {
        test.equal(error.toString(), 'Error: Testing error');
        test.equal(this.getWifiInfo.callCount, 1);
        test.done();
      });
  },

};

module.exports['Tessel.getWifiInfo'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.tessel = TesselSimulator();
    this.simpleExec = this.sandbox.spy(this.tessel, 'simpleExec');
    this.turnOnWifi = this.sandbox.spy(commands, 'turnOnWifi');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.getWifiInfo = this.sandbox.spy(commands, 'getWifiInfo');

    done();
  },
  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  getWifiInfoStandard(test) {
    test.expect(3);
    var ssid = 'testSSID';
    var ip = '192.168.0.1';

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === commands.getWifiInfo().join(' ')) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer(JSON.stringify({
            ssid: ssid
          })));
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === commands.getIPAddress().join(' ')) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer(ip));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getWifiInfo()
      .then((info) => {
        test.equal(info.ssid, ssid);
        test.equal(info.ips[0], ip);
        test.equal(this.getWifiInfo.callCount, 3);
        test.done();
      })
      .catch((error) => {
        test.ifError(error, 'fetching wifi info with should normally resolve.');
        test.done();
      });
  },

  getWifiInfoUndefinedSSID(test) {
    test.expect(2);

    this.tessel._rps.on('control', (command) => {
      if (command.toString() === commands.getWifiInfo().join(' ')) {
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer(JSON.stringify({
            noSSID: 'testing'
          })));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getWifiInfo()
      .then(() => {
        test.ok(false, 'get wifi info should reject');
        test.done();
      })
      .catch((error) => {
        test.ok(error.toString().includes('not connected to Wi-Fi (run "t2 wifi -l" to see available networks)'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      });
  },

  getWifiInfoJSONParseError(test) {
    test.expect(2);

    this.tessel._rps.on('control', (command) => {
      if (command.toString() === commands.getWifiInfo().join(' ')) {
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', new Buffer('Not JSON'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getWifiInfo()
      .then(() => {
        test.ok(false, 'get wifi info should reject');
        test.done();
      })
      .catch((error) => {
        test.ok(!error.toString().includes('not connected to Wi-Fi (run "t2 wifi -l" to see available networks)'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      });
  },

  getWifiInfoDisabled(test) {
    test.expect(2);

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === commands.getWifiInfo().join(' ')) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stderr.emit('data', new Buffer('Command: Not found.'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getWifiInfo()
      .then(() => {
        test.ok(false, 'fetching wifi info with disabled interface should reject.');
        test.done();
      })
      .catch(error => {
        test.ok(!error.toString().includes('Not Found'));
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      });
  },

  getWifiInfoDisabledUnknownError(test) {
    test.expect(2);

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === commands.getWifiInfo().join(' ')) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stderr.emit('data', new Buffer('Unknown error'));
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getWifiInfo()
      .then(() => {
        test.ok(false, 'fetching wifi info with disabled interface should reject.');
        test.done();
      })
      .catch(error => {
        test.equal(error.toString(), 'Error: Unknown error');
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      });
  },

};

module.exports['Tessel.resetMDNS'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.tessel = TesselSimulator();
    this.simpleExec = this.sandbox.spy(this.tessel, 'simpleExec');
    this.callMDNSDaemon = this.sandbox.spy(commands, 'callMDNSDaemon');
    this.callTesselMDNS = this.sandbox.spy(commands, 'callTesselMDNS');

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  resetMDNSStandard(test) {
    test.expect(2);

    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        this.tessel._rps.stdout.removeAllListeners();
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.resetMDNS()
      .then(() => {
        test.equal(this.callMDNSDaemon.callCount, 1);
        test.equal(this.callTesselMDNS.callCount, 1);
        test.done();
      })
      .catch((error) => {
        test.ok(false, error.toString());
        test.done();
      });
  },
};
