var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');

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
    this.commitWirelessCredentials = sinon.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = sinon.spy(commands, 'reconnectWifi');
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
    this.commitWirelessCredentials.restore();
    this.reconnectWifi.restore();
    done();
  },
  noSSID: function(test) {
    var self = this;
    test.expect(3);
    this.tessel.connectToNetwork({
        ssid: undefined,
        password: 'fish'
      })
      .catch(function(error) {
        test.ok(error);
        test.equal(self.setNetworkSSID.callCount, 0);
        test.equal(self.setNetworkPassword.callCount, 0);
        test.done();
      });
  },
  noPassword: function(test) {
    var self = this;
    test.expect(3);
    this.tessel.connectToNetwork({
        ssid: 'tank',
        password: undefined
      })
      .catch(function(error) {
        test.ok(error);
        test.equal(self.setNetworkSSID.callCount, 0);
        test.equal(self.setNetworkPassword.callCount, 0);
        test.done();
      });
  },
  properCredentials: function(test) {
    var self = this;
    test.expect(6);
    var creds = {
      ssid: 'tank',
      password: 'fish'
    };

    // Test is expecting two closes...;
    self.tessel._rps.on('control', function() {
      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    this.tessel.connectToNetwork(creds)
      .then(function() {
        test.equal(self.setNetworkSSID.callCount, 1);
        test.equal(self.setNetworkPassword.callCount, 1);
        test.equal(self.commitWirelessCredentials.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.ok(self.setNetworkSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setNetworkPassword.lastCall.calledWith(creds.password));
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
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
