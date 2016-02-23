// Test dependencies are required and exposed in common/bootstrap.js


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
    var creds = {
      ssid: 'test',
      pass: 'test-password',
      security: 'psk2'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        this.tessel._rps.emit('close');
      });
    });

    // tessel.receive is called twice but needs to be rejected the first time
    var count = 0;
    this.sandbox.stub(this.tessel, 'receive', function(remoteProcess, callback) {
      if (typeof callback !== 'function') {
        callback = function() {};
      }
      if (count === 0) {
        count++;
        return callback(new Error('uci: Entry not found'));
      } else {
        return callback(null, new Buffer(0));
      }
    });

    this.tessel.createAccessPoint(creds)
      .then(() => {
        test.equal(this.getAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPoint.callCount, 1);
        test.equal(this.setAccessPointDevice.callCount, 1);
        test.equal(this.setAccessPointNetwork.callCount, 1);
        test.equal(this.setAccessPointMode.callCount, 1);
        test.equal(this.setAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPointPassword.callCount, 1);
        test.equal(this.setAccessPointSecurity.callCount, 1);
        test.equal(this.setLanNetwork.callCount, 1);
        test.equal(this.setLanNetworkIfname.callCount, 1);
        test.equal(this.setLanNetworkProto.callCount, 1);
        test.equal(this.setLanNetworkIP.callCount, 1);
        test.equal(this.setLanNetworkNetmask.callCount, 1);
        test.equal(this.commitNetwork.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.reconnectDnsmasq.callCount, 1);
        test.equal(this.reconnectDhcp.callCount, 1);
        test.ok(this.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setAccessPointPassword.lastCall.calledWith(creds.pass));
        test.ok(this.setAccessPointSecurity.lastCall.calledWith(creds.security));

        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  noPasswordNoSecurity: function(test) {
    test.expect(9);
    var creds = {
      ssid: 'test',
      pass: undefined,
      security: undefined
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.createAccessPoint(creds)
      .then(() => {
        test.equal(this.getAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPointPassword.callCount, 0);
        test.equal(this.setAccessPointSecurity.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.reconnectDnsmasq.callCount, 1);
        test.equal(this.reconnectDhcp.callCount, 1);
        test.ok(this.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setAccessPointSecurity.lastCall.calledWith('none'));
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  properCredentials: function(test) {
    test.expect(10);
    var creds = {
      ssid: 'test',
      pass: 'test-password',
      security: 'psk2'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.createAccessPoint(creds)
      .then(() => {
        test.equal(this.getAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPointPassword.callCount, 1);
        test.equal(this.setAccessPointSecurity.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.reconnectDnsmasq.callCount, 1);
        test.equal(this.reconnectDhcp.callCount, 1);
        test.ok(this.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setAccessPointPassword.lastCall.calledWith(creds.pass));
        test.ok(this.setAccessPointSecurity.lastCall.calledWith(creds.security));
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  passwordNoSecurity: function(test) {
    test.expect(10);
    var creds = {
      ssid: 'test',
      pass: 'test-password',
      security: undefined
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.createAccessPoint(creds)
      .then(() => {
        test.equal(this.getAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPointSSID.callCount, 1);
        test.equal(this.setAccessPointPassword.callCount, 1);
        test.equal(this.setAccessPointSecurity.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.reconnectDnsmasq.callCount, 1);
        test.equal(this.reconnectDhcp.callCount, 1);
        test.ok(this.setAccessPointSSID.lastCall.calledWith(creds.ssid));
        test.ok(this.setAccessPointPassword.lastCall.calledWith(creds.pass));
        test.ok(this.setAccessPointSecurity.lastCall.calledWith('psk2'));
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
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

    // Test is expecting two closes...;
    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.enableAccessPoint()
      .then(() => {
        test.equal(this.turnAccessPointOn.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.reconnectDnsmasq.callCount, 1);
        test.equal(this.reconnectDhcp.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
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

    // Test is expecting two closes...;
    this.tessel._rps.on('control', () => {
      setImmediate(() => {
        this.tessel._rps.emit('close');
      });
    });

    this.tessel.disableAccessPoint()
      .then(() => {
        test.equal(this.turnAccessPointOff.callCount, 1);
        test.equal(this.reconnectWifi.callCount, 1);
        test.equal(this.reconnectDnsmasq.callCount, 1);
        test.equal(this.reconnectDhcp.callCount, 1);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  }
};

exports['Tessel.prototype.getAccessPointInfo'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.getAccessPointInfo = this.sandbox.spy(Tessel.prototype, 'getAccessPointInfo');
    this.getAccessPointConfig = this.sandbox.spy(commands, 'getAccessPointConfig');
    this.getAccessPointIP = this.sandbox.spy(commands, 'getAccessPointIP');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  returnsActiveInfo: function(test) {
    test.expect(3);
    var results = {
      ssid: 'TestSSID',
      key: 'TestPass123',
      encryption: 'psk2',
      disabled: '0',
      ip: '192.168.200.1'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'uci show wireless.@wifi-iface[1]') {
        var info = new Buffer(tags.stripIndent `
          wireless.cfg053579.ssid='${results.ssid}'
          wireless.cfg053579.key='${results.key}'
          wireless.cfg053579.encryption='${results.encryption}'
          wireless.cfg053579.disabled='0'`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', info);
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'uci get network.lan.ipaddr') {
        var ipInfo = new Buffer(`${results.ip}\n`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', ipInfo);
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getAccessPointInfo()
      .then((info) => {
        test.equal(this.getAccessPointConfig.callCount, 1);
        test.equal(this.getAccessPointIP.callCount, 1);
        test.deepEqual(info, results);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
        test.done();
      });
  },

  returnsNullValues: function(test) {
    test.expect(3);
    var results = {
      ssid: null,
      key: null,
      encryption: null,
      disabled: '1',
      ip: '192.168.200.1'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'uci show wireless.@wifi-iface[1]') {
        var info = new Buffer(`wireless.cfg053579.disabled='1'`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', info);
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'uci get network.lan.ipaddr') {
        var ipInfo = new Buffer(`${results.ip}\n`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', ipInfo);
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getAccessPointInfo()
      .then((info) => {
        test.equal(this.getAccessPointConfig.callCount, 1);
        test.equal(this.getAccessPointIP.callCount, 1);
        test.deepEqual(info, results);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
        test.done();
      });
  }
};

exports['Tessel.prototype.disableAccessPoint'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.getAccessPointInfo = this.sandbox.spy(Tessel.prototype, 'getAccessPointInfo');
    this.getAccessPointConfig = this.sandbox.spy(commands, 'getAccessPointConfig');
    this.getAccessPointIP = this.sandbox.spy(commands, 'getAccessPointIP');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  returnsActiveInfo: function(test) {
    test.expect(3);
    var results = {
      ssid: 'TestSSID',
      key: 'TestPass123',
      encryption: 'psk2',
      disabled: '0',
      ip: '192.168.200.1'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'uci show wireless.@wifi-iface[1]') {
        var info = new Buffer(tags.stripIndent `
          wireless.cfg053579.ssid='${results.ssid}'
          wireless.cfg053579.key='${results.key}'
          wireless.cfg053579.encryption='${results.encryption}'
          wireless.cfg053579.disabled='0'`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', info);
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'uci get network.lan.ipaddr') {
        var ipInfo = new Buffer(`${results.ip}\n`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', ipInfo);
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getAccessPointInfo()
      .then((info) => {
        test.equal(this.getAccessPointConfig.callCount, 1);
        test.equal(this.getAccessPointIP.callCount, 1);
        test.deepEqual(info, results);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
        test.done();
      });
  },

  returnsNullValues: function(test) {
    test.expect(3);
    var results = {
      ssid: null,
      key: null,
      encryption: null,
      disabled: '1',
      ip: '192.168.200.1'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'uci show wireless.@wifi-iface[1]') {
        var info = new Buffer(`wireless.cfg053579.disabled='1'`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', info);
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'uci get network.lan.ipaddr') {
        var ipInfo = new Buffer(`${results.ip}\n`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', ipInfo);
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getAccessPointInfo()
      .then((info) => {
        test.equal(this.getAccessPointConfig.callCount, 1);
        test.equal(this.getAccessPointIP.callCount, 1);
        test.deepEqual(info, results);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
        test.done();
      });
  }
};

exports['Tessel.prototype.disableAccessPoint'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.getAccessPointInfo = this.sandbox.spy(Tessel.prototype, 'getAccessPointInfo');
    this.getAccessPointConfig = this.sandbox.spy(commands, 'getAccessPointConfig');
    this.getAccessPointIP = this.sandbox.spy(commands, 'getAccessPointIP');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  returnsActiveInfo: function(test) {
    test.expect(3);
    var results = {
      ssid: 'TestSSID',
      password: 'TestPass123',
      security: 'psk2',
      disabled: '0',
      ip: '192.168.200.1'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'uci show wireless.@wifi-iface[1]') {
        var info = new Buffer(
          `wireless.cfg053579.ssid='${results.ssid}'
          wireless.cfg053579.key='${results.password}'
          wireless.cfg053579.encryption='${results.security}'
          wireless.cfg053579.disabled='0'`
        );

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', info);
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'uci get network.lan.ipaddr') {
        var ipInfo = new Buffer(`${results.ip}\n`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', ipInfo);
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getAccessPointInfo()
      .then((info) => {
        test.equal(this.getAccessPointConfig.callCount, 1);
        test.equal(this.getAccessPointIP.callCount, 1);
        test.deepEqual(info, results);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
        test.done();
      });
  },

  returnsNullValues: function(test) {
    test.expect(3);
    var results = {
      ssid: null,
      password: null,
      security: null,
      disabled: '1',
      ip: '192.168.200.1'
    };

    // Test is expecting two closes...;
    this.tessel._rps.on('control', (command) => {
      if (command.toString() === 'uci show wireless.@wifi-iface[1]') {
        var info = new Buffer(`wireless.cfg053579.disabled='1'`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', info);
          this.tessel._rps.emit('close');
        });
      } else if (command.toString() === 'uci get network.lan.ipaddr') {
        var ipInfo = new Buffer(`${results.ip}\n`);

        setImmediate(() => {
          this.tessel._rps.stdout.emit('data', ipInfo);
          this.tessel._rps.emit('close');
        });
      } else {
        setImmediate(() => {
          this.tessel._rps.stdout.removeAllListeners();
          this.tessel._rps.emit('close');
        });
      }
    });

    this.tessel.getAccessPointInfo()
      .then((info) => {
        test.equal(this.getAccessPointConfig.callCount, 1);
        test.equal(this.getAccessPointIP.callCount, 1);
        test.deepEqual(info, results);
        test.done();
      })
      .catch(function(error) {
        test.fail(error);
        test.done();
      });
  }
};
