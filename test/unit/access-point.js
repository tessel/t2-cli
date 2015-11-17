var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');

exports['Tessel.prototype.createAccessPoint'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.createAccessPoint = this.sandbox.spy(Tessel.prototype, 'createAccessPoint');
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.setLanNetwork = this.sandbox.spy(commands, 'setLanNetwork');
    this.setLanNetworkIfname = this.sandbox.spy(commands, 'setLanNetworkIfname');
    this.setLanNetworkProto = this.sandbox.spy(commands, 'setLanNetworkProto');
    this.setLanNetworkIP = this.sandbox.spy(commands, 'setLanNetworkIP');
    this.setLanNetworkNetmask = this.sandbox.spy(commands, 'setLanNetworkNetmask');
    this.commitNetwork = this.sandbox.spy(commands, 'commitNetwork');
    this.setAccessPoint = this.sandbox.spy(commands, 'setAccessPoint');
    this.getAccessPointSSID = this.sandbox.spy(commands, 'getAccessPointSSID');
    this.setAccessPointDevice = this.sandbox.spy(commands, 'setAccessPointDevice');
    this.setAccessPointNetwork = this.sandbox.spy(commands, 'setAccessPointNetwork');
    this.setAccessPointMode = this.sandbox.spy(commands, 'setAccessPointMode');
    this.setAccessPointSSID = this.sandbox.spy(commands, 'setAccessPointSSID');
    this.setAccessPointPassword = this.sandbox.spy(commands, 'setAccessPointPassword');
    this.setAccessPointSecurity = this.sandbox.spy(commands, 'setAccessPointSecurity');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.reconnectDnsmasq = this.sandbox.spy(commands, 'reconnectDnsmasq');
    this.reconnectDhcp = this.sandbox.spy(commands, 'reconnectDhcp');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  newAccessPoint: function(test) {
    test.expect(20);
    var self = this;
    var creds = {
      ssid: 'test',
      pass: 'test-password',
      security: 'psk2'
    };

    // Test is expecting two closes...;
    self.tessel._rps.on('control', function() {
      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    // tessel.receive is called twice but needs to be rejected the first time
    var count = 0;
    this.sandbox.stub(this.tessel, 'receive', function() {
      if (count === 0) {
        count++;
        return Promise.reject(new Error('uci: Entry not found'));
      } else {
        return Promise.resolve();
      }
    });

    this.tessel.createAccessPoint(creds)
      .then(function() {
        test.equal(self.getAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPoint.callCount, 1);
        test.equal(self.setAccessPointDevice.callCount, 1);
        test.equal(self.setAccessPointNetwork.callCount, 1);
        test.equal(self.setAccessPointMode.callCount, 1);
        test.equal(self.setAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointPassword.callCount, 1);
        test.equal(self.setAccessPointSecurity.callCount, 1);
        test.equal(self.setLanNetwork.callCount, 1);
        test.equal(self.setLanNetworkIfname.callCount, 1);
        test.equal(self.setLanNetworkProto.callCount, 1);
        test.equal(self.setLanNetworkIP.callCount, 1);
        test.equal(self.setLanNetworkNetmask.callCount, 1);
        test.equal(self.commitNetwork.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.equal(self.reconnectDnsmasq.callCount, 1);
        test.equal(self.reconnectDhcp.callCount, 1);
        test.ok(self.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setAccessPointPassword.lastCall.calledWith(creds.pass));
        test.ok(self.setAccessPointSecurity.lastCall.calledWith(creds.security));

        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  },

  noPasswordNoSecurity: function(test) {
    test.expect(9);
    var self = this;
    var creds = {
      ssid: 'test',
      pass: undefined,
      security: undefined
    };

    // Test is expecting two closes...;
    self.tessel._rps.on('control', function() {
      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    this.tessel.createAccessPoint(creds)
      .then(function() {
        test.equal(self.getAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointPassword.callCount, 0);
        test.equal(self.setAccessPointSecurity.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.equal(self.reconnectDnsmasq.callCount, 1);
        test.equal(self.reconnectDhcp.callCount, 1);
        test.ok(self.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setAccessPointSecurity.lastCall.calledWith('none'));
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  },

  properCredentials: function(test) {
    test.expect(10);
    var self = this;
    var creds = {
      ssid: 'test',
      pass: 'test-password',
      security: 'psk2'
    };

    // Test is expecting two closes...;
    self.tessel._rps.on('control', function() {
      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    this.tessel.createAccessPoint(creds)
      .then(function() {
        test.equal(self.getAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointPassword.callCount, 1);
        test.equal(self.setAccessPointSecurity.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.equal(self.reconnectDnsmasq.callCount, 1);
        test.equal(self.reconnectDhcp.callCount, 1);
        test.ok(self.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setAccessPointPassword.lastCall.calledWith(creds.pass));
        test.ok(self.setAccessPointSecurity.lastCall.calledWith(creds.security));
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  },

  passwordNoSecurity: function(test) {
    test.expect(10);
    var self = this;
    var creds = {
      ssid: 'test',
      pass: 'test-password',
      security: undefined
    };

    // Test is expecting two closes...;
    self.tessel._rps.on('control', function() {
      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    this.tessel.createAccessPoint(creds)
      .then(function() {
        test.equal(self.getAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointPassword.callCount, 1);
        test.equal(self.setAccessPointSecurity.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.equal(self.reconnectDnsmasq.callCount, 1);
        test.equal(self.reconnectDhcp.callCount, 1);
        test.ok(self.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(self.setAccessPointPassword.lastCall.calledWith(creds.pass));
        test.ok(self.setAccessPointSecurity.lastCall.calledWith('psk2'));
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  }
};

exports['Tessel.prototype.enableAccessPoint'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.enableAccessPoint = this.sandbox.spy(Tessel.prototype, 'enableAccessPoint');
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.turnAccessPointOn = this.sandbox.spy(commands, 'turnAccessPointOn');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.reconnectDnsmasq = this.sandbox.spy(commands, 'reconnectDnsmasq');
    this.reconnectDhcp = this.sandbox.spy(commands, 'reconnectDhcp');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  turnsOn: function(test) {
    test.expect(4);
    var self = this;

    // Test is expecting two closes...;
    self.tessel._rps.on('control', function() {
      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    this.tessel.enableAccessPoint()
      .then(function() {
        test.equal(self.turnAccessPointOn.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.equal(self.reconnectDnsmasq.callCount, 1);
        test.equal(self.reconnectDhcp.callCount, 1);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  }
};

exports['Tessel.prototype.disableAccessPoint'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.disableAccessPoint = this.sandbox.spy(Tessel.prototype, 'disableAccessPoint');
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.turnAccessPointOff = this.sandbox.spy(commands, 'turnAccessPointOff');
    this.commitWirelessCredentials = this.sandbox.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = this.sandbox.spy(commands, 'reconnectWifi');
    this.reconnectDnsmasq = this.sandbox.spy(commands, 'reconnectDnsmasq');
    this.reconnectDhcp = this.sandbox.spy(commands, 'reconnectDhcp');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  turnsOn: function(test) {
    test.expect(4);
    var self = this;

    // Test is expecting two closes...;
    self.tessel._rps.on('control', function() {
      setImmediate(function() {
        self.tessel._rps.emit('close');
      });
    });

    this.tessel.disableAccessPoint()
      .then(function() {
        test.equal(self.turnAccessPointOff.callCount, 1);
        test.equal(self.reconnectWifi.callCount, 1);
        test.equal(self.reconnectDnsmasq.callCount, 1);
        test.equal(self.reconnectDhcp.callCount, 1);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  }
};
