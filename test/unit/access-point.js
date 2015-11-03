var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');

exports['Tessel.prototype.createAccessPoint'] = {
  setUp: function(done) {
    this.createAccessPoint = sinon.spy(Tessel.prototype, 'createAccessPoint');
    this.logsInfo = sinon.stub(logs, 'info', function() {});
    this.setAccessPointSSID = sinon.spy(commands, 'setAccessPointSSID');
    this.setAccessPointPassword = sinon.spy(commands, 'setAccessPointPassword');
    this.setAccessPointSecurity = sinon.spy(commands, 'setAccessPointSecurity');
    this.commitWirelessCredentials = sinon.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = sinon.spy(commands, 'reconnectWifi');
    this.reconnectDnsmasq = sinon.spy(commands, 'reconnectDnsmasq');
    this.reconnectDhcp = sinon.spy(commands, 'reconnectDhcp');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.createAccessPoint.restore();
    this.logsInfo.restore();
    this.setAccessPointSSID.restore();
    this.setAccessPointPassword.restore();
    this.setAccessPointSecurity.restore();
    this.commitWirelessCredentials.restore();
    this.reconnectWifi.restore();
    this.reconnectDnsmasq.restore();
    this.reconnectDhcp.restore();
    done();
  },

  noSSID: function(test) {
    test.expect(1);

    this.tessel.createAccessPoint({
        ssid: undefined
      })
      .catch(function(error) {
        test.ok(error);
        test.done();
      });
  },

  noPasswordWithSecurity: function(test) {
    test.expect(1);

    this.tessel.createAccessPoint({
        ssid: 'test',
        password: undefined,
        security: 'psk2'
      })
      .catch(function(error) {
        test.ok(error);
        test.done();
      });
  },

  noPasswordNoSecurity: function(test) {
    test.expect(7);
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
        test.equal(self.setAccessPointSSID.callCount, 1);
        test.equal(self.setAccessPointPassword.callCount, 0);
        test.equal(self.setAccessPointSecurity.callCount, 0);
        test.equal(self.reconnectWifi.callCount, 1);
        test.equal(self.reconnectDnsmasq.callCount, 1);
        test.equal(self.reconnectDhcp.callCount, 1);
        test.ok(self.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
      });
  },

  properCredentials: function(test) {
    test.expect(9);
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
    test.expect(9);
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
    this.enableAccessPoint = sinon.spy(Tessel.prototype, 'enableAccessPoint');
    this.logsInfo = sinon.stub(logs, 'info', function() {});
    this.turnAccessPointOn = sinon.spy(commands, 'turnAccessPointOn');
    this.commitWirelessCredentials = sinon.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = sinon.spy(commands, 'reconnectWifi');
    this.reconnectDnsmasq = sinon.spy(commands, 'reconnectDnsmasq');
    this.reconnectDhcp = sinon.spy(commands, 'reconnectDhcp');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.enableAccessPoint.restore();
    this.logsInfo.restore();
    this.turnAccessPointOn.restore();
    this.commitWirelessCredentials.restore();
    this.reconnectWifi.restore();
    this.reconnectDnsmasq.restore();
    this.reconnectDhcp.restore();
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
    this.disableAccessPoint = sinon.spy(Tessel.prototype, 'disableAccessPoint');
    this.logsInfo = sinon.stub(logs, 'info', function() {});
    this.turnAccessPointOff = sinon.spy(commands, 'turnAccessPointOff');
    this.commitWirelessCredentials = sinon.spy(commands, 'commitWirelessCredentials');
    this.reconnectWifi = sinon.spy(commands, 'reconnectWifi');
    this.reconnectDnsmasq = sinon.spy(commands, 'reconnectDnsmasq');
    this.reconnectDhcp = sinon.spy(commands, 'reconnectDhcp');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.disableAccessPoint.restore();
    this.logsInfo.restore();
    this.turnAccessPointOff.restore();
    this.commitWirelessCredentials.restore();
    this.reconnectWifi.restore();
    this.reconnectDnsmasq.restore();
    this.reconnectDhcp.restore();
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
