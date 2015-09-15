var _ = require('lodash');
var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');

module.exports['Tessel.prototype.findAvailableNetworks'] = {
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

module.exports['Tessel.prototype.getWifiInfo'] = {
  setUp: function(done) {
    this.getWifiInfo = sinon.spy(Tessel.prototype, 'getWifiInfo');
    this.logsWarn = sinon.stub(logs, 'warn', _.noop);
    this.logsInfo = sinon.stub(logs, 'info', _.noop);
    this.logsErr = sinon.stub(logs, 'err', _.noop);
    this.getWifiCmd = sinon.spy(commands, 'getWifiInfo');
    this.getIPAddress = sinon.spy(commands, 'getIPAddress');
    this.tessel = TesselSimulator();
    done();
  },
  tearDown: function(done) {
    this.tessel.mockClose();
    this.logsWarn.restore();
    this.logsInfo.restore();
    this.logsErr.restore();
    this.getWifiInfo.restore();
    done();
  },
  noWifi: function(test) {
    test.expect(3);

    var self = this;
    this.tessel.getWifiInfo({
        timeout: 5
      })
      .then(function() {
        test.fail('getWifiInfo did not get rejected');
      })
      .catch(function(err) {
        test.ok(err);
        test.equal(self.getWifiCmd.callCount, 1);
        test.equal(self.getIPAddress.callCount, 0);
        test.done();
      });

    // Force Wifi down
    this.tessel._rps.stdout.push('{}');
    setImmediate(function() {
      self.tessel._rps.emit('close');
    });
  },
  success: function(test) {
    test.expect(2);

    var self = this;
    this.tessel.getWifiInfo({
        timeout: 5
      })
      .then(function(network) {
        test.equal(network.ssid, 'piano');
        test.equal(self.getWifiCmd.callCount, 1);
        test.equal(self.getIPAddress.callCount, 1);
        test.done();
      })
      .catch(function(err) {
        test.fail(err);
      });

    // Force Wifi up
    this.tessel._rps.stdout.push('{"ssid":"piano"}');
    setImmediate(function() {
      self.tessel._rps.emit('close');
      // mock getIPAddress
      setTimeout(function() {
        /*jshint multistr: true */
        self.tessel._rps.stdout.push(
          'wlan0     Link encap:Ethernet  HWaddr 02:A3:E4:26:A9:75\
            inet addr:10.0.0.2  Bcast:10.0.0.255  Mask:255.255.255.0\
            inet6 addr: fe80::a3:e4ff:fe26:a975/64 Scope:Link\
            UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1\
            RX packets:19697 errors:0 dropped:0 overruns:0 frame:0\
            TX packets:2248 errors:0 dropped:0 overruns:0 carrier:0\
            collisions:0 txqueuelen:1000\
            RX bytes:2225847 (2.1 MiB)  TX bytes:503558 (491.7 KiB)'
        );
        setImmediate(function() {
          self.tessel._rps.emit('close');
        });
      }, 1000);
    });
  }
};
