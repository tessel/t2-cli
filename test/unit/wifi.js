// Test dependencies are required and exposed in common/bootstrap.js

exports['Tessel.prototype.findAvailableNetworks'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.findAvailableNetworks = this.sandbox.spy(Tessel.prototype, 'findAvailableNetworks');
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  noNetworks: function(test) {
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

  someNetworks: function(test) {
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

  compareSignalStrengths: function(test) {
    test.expect(5);


    var networks = `Cell 01 - Address: 14:35:8B:11:30:F0
              ESSID: "middle"
              Mode: Master  Channel: 11
              Signal: -55 dBm  Quality: 30/70
              Encryption: mixed WPA/WPA2 PSK (TKIP, CCMP)

    Cell 02 - Address: 6C:70:9F:D9:7A:5C
              ESSID: "worst"
              Mode: Master  Channel: 2
              Signal: -57 dBm  Quality: 5/70
              Encryption: WPA2 PSK (CCMP)

    Cell 03 - Address: 6C:70:9F:D9:7A:5C
            ESSID: "best"
            Mode: Master  Channel: 2
            Signal: -57 dBm  Quality: 60/70
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
        test.done();
      });

    this.tessel._rps.stdout.push(networks);

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  compareSignalStrengthSafe: function(test) {
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
};

module.exports['Tessel.prototype.connectToNetwork'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.connectToNetwork = this.sandbox.spy(Tessel.prototype, 'connectToNetwork');
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.setNetworkSSID = this.sandbox.spy(commands, 'setNetworkSSID');
    this.setNetworkPassword = this.sandbox.spy(commands, 'setNetworkPassword');
    this.setNetworkEncryption = this.sandbox.spy(commands, 'setNetworkEncryption');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.getWifiInfo = this.sandbox.spy(commands, 'getWifiInfo');
    this.tessel = TesselSimulator();

    done();
  },
  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },
  noPassword: function(test) {
    test.expect(8);
    var creds = {
      ssid: 'tank',
      password: undefined
    };

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', 'signal');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();

          // Continue
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
  properCredentials: function(test) {
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
          this.tessel._rps.stdout.emit('data', 'signal');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();

          // Continue
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

  properCredentialsWithSecurity: function(test) {
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
          this.tessel._rps.stdout.emit('data', 'signal');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();

          // Continue
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

  connectionFails: function(test) {
    test.expect(9);
    var creds = {
      ssid: 'tank',
      password: 'not_gonna_work'
    };
    var errMessage = 'Unable to connect to the network.';
    // Set the timeout to be small so we don't wait forever for the test to complete
    Tessel.__wifiConnectionTimeout = 10;
    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stderr so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', errMessage);
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stderr so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();

          // Continue
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

  connectionTimeout: function(test) {
    test.expect(10);
    var creds = {
      ssid: 'tank',
      password: 'not_gonna_work'
    };

    // Make it timeout super fast so this test doesn't take forever
    Tessel.__wifiConnectionTimeout = 10;

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() !== 'ubus call iwinfo info {"device":"wlan0"}') {
        setImmediate(() => {
          // Remove any listeners on stderr so we don't break anything when we write to it
          this.tessel._rps.stderr.removeAllListeners();

          // Continue
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
        test.ok(error.toLowerCase().indexOf('timed out') !== -1);
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
  batchedResponse: function(test) {
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
          this.tessel._rps.stdout.emit('data', 'do not have success yet');
          // then write the keyword we're looking for for success
          this.tessel._rps.stdout.emit('data', 'signal');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stderr so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();

          // Continue
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

module.exports['Tessel.setWifiState'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.tessel = TesselSimulator();
    this.simpleExec = this.sandbox.spy(this.tessel, 'simpleExec');
    this.turnOnWifi = this.sandbox.spy(commands, 'turnOnWifi');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.getWifiInfo = this.sandbox.spy(commands, 'getWifiInfo');

    done();
  },
  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  setWifiStateTruthy: function(test) {
    test.expect(8);
    var state = true;

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', 'signal');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();

          // Continue
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
        test.equal(this.logsInfo.calledTwice, true);
        test.equal(this.logsInfo.lastCall.args[1].indexOf('Enabled.') !== -1, true);
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },
  setWifiStateFalsy: function(test) {
    test.expect(8);
    var state = false;

    // Test is expecting several closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'ubus call iwinfo info {"device":"wlan0"}' && state) {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', 'signal');
        });
      } else {
        setImmediate(() => {
          // Remove any listeners on stdout so we don't break anything when we write to it
          this.tessel._rps.stdout.removeAllListeners();

          // Continue
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
        test.equal(this.logsInfo.calledOnce, true);
        test.equal(this.logsInfo.lastCall.args[1].indexOf('Disabled.') !== -1, true);
        test.ok(this.getWifiInfo.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  }

};
