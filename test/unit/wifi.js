// Test dependencies are required and exposed in common/bootstrap.js

exports['Tessel.prototype.findAvailableNetworks'] = {
  setUp: function(done) {

    this.findAvailableNetworks = sinon.spy(Tessel.prototype, 'findAvailableNetworks');
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.findAvailableNetworks.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
    done();
  },

  noNetworks: function(test) {
    test.expect(1);
    var self = this;

    this.tessel.findAvailableNetworks()
      .then(function(networks) {
        test.equal(networks.length, 0);
        test.done();
      });

    var networks = JSON.stringify({
      results: []
    });

    this.tessel._rps.stdout.push(networks);

    setImmediate(function() {
      self.tessel._rps.emit('close');
    });
  },

  someNetworks: function(test) {
    test.expect(2);
    var self = this;

    var networks = {
      results: [{
        ssid: 'ssid1',
        quality: 21,
        max_quality: 73,
      }, {
        ssid: 'ssid2',
        quality: 5,
        max_quality: 73,
      }, ]
    };

    this.tessel.findAvailableNetworks()
      .then(function(found) {
        test.equal(found.length, networks.results.length);
        test.equal(self.findAvailableNetworks.callCount, 1);
        test.done();
      });

    this.tessel._rps.stdout.push(JSON.stringify(networks));

    setImmediate(function() {
      self.tessel._rps.emit('close');
    });
  },

  compareSignalStrengths: function(test) {
    test.expect(5);
    var self = this;

    var bestNetwork = {
      ssid: 'best',
      quality: 60,
      quality_max: 73,
    };

    var worstNetwork = {
      ssid: 'worst',
      quality: 5,
      quality_max: 73,
    };

    var middleNetwork = {
      ssid: 'middle',
      quality: 10,
      quality_max: 73,
    };

    var networks = {
      results: [bestNetwork, worstNetwork, middleNetwork]
    };

    this.tessel.findAvailableNetworks()
      .then(function(found) {
        test.equal(found.length, networks.results.length);
        test.equal(self.findAvailableNetworks.callCount, 1);
        test.equal(found[0].ssid, bestNetwork.ssid);
        test.equal(found[1].ssid, middleNetwork.ssid);
        test.equal(found[2].ssid, worstNetwork.ssid);
        test.done();
      });

    this.tessel._rps.stdout.push(JSON.stringify(networks));

    setImmediate(function() {
      self.tessel._rps.emit('close');
    });
  },
};

module.exports['Tessel.prototype.connectToNetwork'] = {
  setUp: function(done) {

    this.connectToNetwork = sinon.spy(Tessel.prototype, 'connectToNetwork');
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});
    this.setNetworkSSID = sinon.spy(commands, 'setNetworkSSID');
    this.setNetworkPassword = sinon.spy(commands, 'setNetworkPassword');
    this.setNetworkEncryption = sinon.spy(commands, 'setNetworkEncryption');
    this.commitWirelessCredentials = sinon.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = sinon.spy(commands, 'reconnectWifi');
    this.ubusListen = sinon.spy(commands, 'ubusListen');
    this.tessel = TesselSimulator();

    done();
  },
  tearDown: function(done) {
    this.tessel.mockClose();
    this.connectToNetwork.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
    this.setNetworkSSID.restore();
    this.setNetworkPassword.restore();
    this.setNetworkEncryption.restore();
    this.commitWirelessCredentials.restore();
    this.reconnectWifi.restore();
    this.ubusListen.restore();
    done();
  },
  noSSID: function(test) {
    var self = this;
    test.expect(4);
    this.tessel.connectToNetwork({
        ssid: undefined,
        password: 'fish'
      })
      .catch(function(error) {
        test.ok(error);
        test.equal(self.setNetworkSSID.callCount, 0);
        test.equal(self.setNetworkPassword.callCount, 0);
        test.equal(self.setNetworkEncryption.callCount, 0);
        test.done();
      });
  },
  noPassword: function(test) {
    var self = this;
    test.expect(4);
    this.tessel.connectToNetwork({
        ssid: 'tank',
        password: undefined
      })
      .catch(function(error) {
        test.ok(error);
        test.equal(self.setNetworkSSID.callCount, 0);
        test.equal(self.setNetworkPassword.callCount, 0);
        test.equal(self.setNetworkEncryption.callCount, 0);
        test.done();
      });
  },

  // tests that the proper credentials and a positive report about connectivity
  // will lead to a resolve
  properCredentials: function(test) {
    var self = this;
    test.expect(9);
    var creds = {
      ssid: 'tank',
      password: 'fish'
    };

    // Test is expecting several closes...
    self.tessel._rps.on('control', function(command) {
      // If this is the ubus listen command
      if (command.toString() === 'ubus listen') {
        // Write to stdout so it completes as expected
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(function() {
          self.tessel._rps.stdout.emit('data', 'ifup');
        });
      }
      // If it's any other command
      else {
        setImmediate(function() {
          // Remove any listeners on stdout so we don't break anything when we write to it
          self.tessel._rps.stdout.removeAllListeners();
          // Continue
          self.tessel._rps.emit('close');
        });
      }
    });
    this.tessel.connectToNetwork(creds)
      .then(function() {
        test.equal(self.setNetworkSSID.callCount, 1);
        test.equal(self.setNetworkPassword.callCount, 1);
        test.equal(self.setNetworkEncryption.callCount, 1);
        test.equal(self.commitWirelessCredentials.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.ok(self.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(self.setNetworkEncryption.lastCall.calledWith('psk2'));
        test.ok(self.ubusListen.callCount, 1);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  },

  // Tests that data on stderr after connecting will lead to a rejection
  connectionFails: function(test) {
    var self = this;
    test.expect(10);
    var creds = {
      ssid: 'tank',
      password: 'not_gonna_work'
    };
    var errMessage = 'Unable to connect to the network.';

    // Test is expecting several closes...
    self.tessel._rps.on('control', function(command) {
      // If this is the ubus listen command
      if (command.toString() === 'ubus listen') {
        // Write to stderr so it throws an error
        // Wrap in setImmediate to make sure listener is set up before emitting
        setImmediate(function() {
          self.tessel._rps.stderr.emit('data', errMessage);
        });
      }
      // If it's any other command
      else {
        setImmediate(function() {
          // Remove any listeners on stdout so we don't break anything when we write to it
          self.tessel._rps.stderr.removeAllListeners();
          // Continue
          self.tessel._rps.emit('close');
        });
      }
    });
    this.tessel.connectToNetwork(creds)
      .then(function() {
        test.fail('Test should have rejected with an error.');
      })
      .catch(function(error) {
        test.equal(error, errMessage);
        test.equal(self.setNetworkSSID.callCount, 1);
        test.equal(self.setNetworkPassword.callCount, 1);
        test.equal(self.setNetworkEncryption.callCount, 1);
        test.equal(self.commitWirelessCredentials.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.ok(self.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(self.setNetworkEncryption.lastCall.calledWith('psk2'));
        test.ok(self.ubusListen.callCount, 1);
        test.done();
      });
  },

  // Tests that after a specific timeout, a connection attempt will reject
  connectionTimeout: function(test) {
    var self = this;
    test.expect(10);
    var creds = {
      ssid: 'tank',
      password: 'taking_too_long'
    };

    // Make it timeout super fast so this test doesn't take forever
    Tessel._wifiConnectionTimeout = 10;

    // Test is expecting several closes...
    self.tessel._rps.on('control', function(command) {
      // If this is not the ubus listen command
      // If it is the ubus listen, we'll let it hang
      if (command.toString() !== 'ubus listen') {
        setImmediate(function() {
          // Remove any listeners on stdout so we don't break anything when we write to it
          self.tessel._rps.stderr.removeAllListeners();
          // Continue
          self.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.connectToNetwork(creds)
      .then(function() {
        test.fail('Test should have rejected with an error.');
      })
      .catch(function(error) {
        test.ok(error.toLowerCase().indexOf('timed out') !== -1);
        test.equal(self.setNetworkSSID.callCount, 1);
        test.equal(self.setNetworkPassword.callCount, 1);
        test.equal(self.setNetworkEncryption.callCount, 1);
        test.equal(self.commitWirelessCredentials.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.ok(self.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setNetworkPassword.lastCall.calledWith(creds.password));
        test.ok(self.setNetworkEncryption.lastCall.calledWith('psk2'));
        test.ok(self.ubusListen.callCount, 1);
        test.done();
      });
  }
};

module.exports['Tessel.setWifiState'] = {
  setUp: function(done) {
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});
    this.tessel = TesselSimulator();
    this.simpleExec = sinon.spy(this.tessel, 'simpleExec');

    done();
  },
  tearDown: function(done) {
    this.tessel.mockClose();
    this.logsWarn.restore();
    this.logsInfo.restore();
    done();
  },

  setWifiStateTruthy: function(test) {
    var self = this;

    test.expect(6);
    var state = true;
    this.tessel.setWiFiState(state)
      .then(function() {
        test.equal(self.simpleExec.calledThrice, true);
        test.deepEqual(self.simpleExec.args[0][0], commands.turnOnWifi(state));
        test.deepEqual(self.simpleExec.args[1][0], commands.commitWirelessCredentials());
        test.deepEqual(self.simpleExec.args[2][0], commands.reconnectWifi());
        test.equal(self.logsInfo.calledOnce, true);
        test.equal(self.logsInfo.args[0][1].indexOf('Enabled.') !== -1, true);
        test.done();
      })
      .catch(function(err) {
        test.equal(undefined, err, 'an unexpected error was thrown');
      });

    setImmediate(function() {
      // enable wifi completed
      self.tessel._rps.emit('close');
      setImmediate(function() {
        // commit wifi settings completed
        self.tessel._rps.emit('close');
        setImmediate(function() {
          // Reconnecting to wifi completed
          self.tessel._rps.emit('close');
        });
      });
    });
  },
  setWifiStateFalsy: function(test) {
    var self = this;

    test.expect(6);
    var state = false;
    this.tessel.setWiFiState(state)
      .then(function() {
        test.equal(self.simpleExec.calledThrice, true);
        test.deepEqual(self.simpleExec.args[0][0], commands.turnOnWifi(state));
        test.deepEqual(self.simpleExec.args[1][0], commands.commitWirelessCredentials());
        test.deepEqual(self.simpleExec.args[2][0], commands.reconnectWifi());
        test.equal(self.logsInfo.calledOnce, true);
        test.equal(self.logsInfo.args[0][1].indexOf('Disabled.') !== -1, true);
        test.done();
      })
      .catch(function(err) {
        test.equal(undefined, err, 'an unexpected error was thrown');
      });

    setImmediate(function() {
      // enable wifi completed
      self.tessel._rps.emit('close');
      setImmediate(function() {
        // commit wifi settings completed
        self.tessel._rps.emit('close');
        setImmediate(function() {
          // Reconnecting to wifi completed
          self.tessel._rps.emit('close');
        });
      });
    });

  }

};
