// Test dependencies are required and exposed in common/bootstrap.js

function newTessel(options) {
  var tessel = new Tessel({
    connectionType: options.type || 'LAN',
    authorized: options.authorized !== undefined ? options.authorized : true,
    end: function() {
      return Promise.resolve();
    }
  });

  tessel.name = options.name || 'a';

  options.sandbox.stub(tessel, 'close', function() {
    return Promise.resolve();
  });

  return tessel;
}

exports['controller.closeTesselConnections'] = {

  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  callsCloseOnAllAuthorizedLANConnections: function(test) {
    test.expect(3);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var c = newTessel({
      sandbox: this.sandbox,
      authorized: false,
      type: 'LAN'
    });

    controller.closeTesselConnections([a, b, c])
      .then(function() {
        test.equal(a.close.callCount, 1);
        test.equal(b.close.callCount, 1);
        test.equal(c.close.callCount, 0);
        test.done();
      }.bind(this));
  },

  callsCloseOnAllUSBConnections: function(test) {
    test.expect(3);

    var a = newTessel({
      sandbox: this.sandbox,
      type: 'USB'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      type: 'USB'
    });

    var c = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    controller.closeTesselConnections([a, b, c])
      .then(function() {
        test.equal(a.close.callCount, 1);
        test.equal(b.close.callCount, 1);
        test.equal(c.close.callCount, 1);
        test.done();
      }.bind(this));
  },

  resolvesForUnauthorizedLANConnections: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: false,
      type: 'LAN'
    });

    controller.closeTesselConnections([a])
      .then(function() {
        test.equal(a.close.callCount, 0);
        test.done();
      }.bind(this));
  },
};

exports['controller.runHeuristics'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  oneUSBDevice: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    controller.runHeuristics({}, [a])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        test.done();
      });
  },

  oneLANDevice: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    controller.runHeuristics({}, [a])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        test.done();
      });
  },

  USBAndLANDevices: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    controller.runHeuristics({}, [a, b])
      .then(function(tessel) {
        test.deepEqual(b, tessel);
        test.done();
      });
  },

  bothConnectionsAndLAN: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    b.addConnection({
      connectionType: 'LAN',
      authorized: true
    });

    controller.runHeuristics({}, [a, b])
      .then(function(tessel) {
        test.deepEqual(b, tessel);
        test.done();
      });
  },

  bothConnectionsAndMultipleLAN: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var c = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    c.addConnection({
      connectionType: 'LAN',
      authorized: true
    });

    controller.runHeuristics({}, [a, b, c])
      .then(function(tessel) {
        test.deepEqual(c, tessel);
        test.done();
      });
  },

  USBAndLANDevicesWithNameOption: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    a.name = 'Me!';

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    b.name = 'Not Me!';

    controller.runHeuristics({
        name: a.name
      }, [a, b])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        test.done();
      });
  },

  USBAndLANDevicesWithEnvVariable: function(test) {
    test.expect(1);

    var winningName = 'Me!';
    process.env['Tessel'] = winningName;

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    a.name = winningName;

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    b.name = 'Not ' + winningName;

    controller.runHeuristics({
        name: a.name
      }, [a, b])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        process.env['Tessel'] = undefined;
        test.done();
      });
  },

  catchAmbiguityTwoLAN: function(test) {

    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    controller.runHeuristics({}, [a, b])
      .then(function() {
        test.fail('Should have thrown an error');
      })
      .catch(function(err) {
        test.equal(err instanceof controller.HeuristicAmbiguityError, true);
        test.done();
      });
  },

  catchAmbiguityTwoUSB: function(test) {

    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    controller.runHeuristics({}, [a, b])
      .then(function() {
        test.fail('Should have thrown an error');
      })
      .catch(function(err) {
        test.equal(err instanceof controller.HeuristicAmbiguityError, true);
        test.done();
      });
  }
};


exports['Tessel.list'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function() {
      this.start = function(opts) {
        self.activeSeeker = this;
        if (opts.timeout && typeof opts.timeout === 'number') {
          setTimeout(this.stop, opts.timeout);
        }
        return this;
      };
      this.stop = function() {
        this.emit('end');
        return this;
      }.bind(this);
    });
    util.inherits(this.seeker, Emitter);

    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    this.closeTesselConnections = this.sandbox.spy(controller, 'closeTesselConnections');
    this.runHeuristics = this.sandbox.spy(controller, 'runHeuristics');

    this.standardOpts = {
      timeout: 0.01,
    };

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  oneUSBTessel: function(test) {
    test.expect(4);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    Tessel.list(this.standardOpts)
      .then(function() {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(a.close.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      }.bind(this));

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
    }.bind(this));
  },

  oneLANTessel: function(test) {
    test.expect(4);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    Tessel.list(this.standardOpts)
      .then(function() {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(a.close.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      }.bind(this));

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
    }.bind(this));
  },

  oneTesselTwoConnections: function(test) {
    test.expect(5);

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'samesies'
    });

    var lan = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'samesies'
    });

    Tessel.list(this.standardOpts)
      .then(function() {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(usb.close.callCount, 1);
        test.equal(lan.close.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      }.bind(this));

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    }.bind(this));
  },

  multipleDifferentTessels: function(test) {
    test.expect(5);

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'foo'
    });

    var lan = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'bar'
    });

    Tessel.list(this.standardOpts)
      .then(function() {
        test.equal(this.runHeuristics.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(usb.close.callCount, 1);
        test.equal(lan.close.callCount, 1);
        test.done();
      }.bind(this));

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    }.bind(this));
  },
};

exports['Tessel.get'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function Seeker() {
      this.start = function(opts) {
        self.activeSeeker = this;
        this.msg = {
          noAuth: 'No Authorized Tessels Found.',
          auth: 'No Tessels Found.'
        };
        if (opts.timeout && typeof opts.timeout === 'number') {
          setTimeout(this.stop, opts.timeout);
        }
        return this;
      };
      this.stop = function() {
        self.activeSeeker.emit('end');
        return this;
      }.bind(this);
    });
    util.inherits(this.seeker, Emitter);
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});
    this.closeTesselConnections = this.sandbox.stub(controller, 'closeTesselConnections');
    this.reconcileTessels = this.sandbox.spy(controller, 'reconcileTessels');
    this.runHeuristics = this.sandbox.spy(controller, 'runHeuristics');

    this.standardOpts = {
      timeout: 0.01,
    };

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  oneNamedTessel: function(test) {
    test.expect(6);

    controller.closeTesselConnections.returns(Promise.resolve());

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'the_name'
    });

    var customOpts = {
      timeout: this.standardOpts.timeout,
      key: this.standardOpts.key,
      name: 'the_name'
    };

    Tessel.get(customOpts)
      .then(function() {
        test.equal(this.reconcileTessels.callCount, 0);
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'the_name'), true);
        test.done();
      }.bind(this));

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
    }.bind(this));
  },

  oneUnNamedTessel: function(test) {
    test.expect(6);

    controller.closeTesselConnections.returns(Promise.resolve());

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'the_name'
    });

    Tessel.get(this.standardOpts)
      .then(function() {
        test.equal(this.reconcileTessels.callCount, 0);
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'the_name'), true);
        test.done();
      }.bind(this));

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
    }.bind(this));
  },

  oneUnamedTesselTwoConnections: function(test) {
    test.expect(6);

    controller.closeTesselConnections.returns(Promise.resolve());

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'samesies'
    });

    var lan = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'samesies'
    });

    var customOpts = this.standardOpts;
    customOpts.lanPrefer = true;

    Tessel.get(customOpts)
      .then(function() {
        test.equal(this.reconcileTessels.callCount, 1);
        test.equal(this.runHeuristics.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'samesies'), true);
        test.done();
      }.bind(this));

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    }.bind(this));

  },

  standardCommandNoTessels: function(test) {
    test.expect(2);

    controller.standardTesselCommand(this.standardOpts, function() {
        // Doesn't matter what this function does b/c Tessel.get will fail
        return Promise.resolve();
      })
      .catch(function(err) {
        // We don't need to close any connections because none were found
        test.equal(this.closeTesselConnections.callCount, 0);
        test.equal(typeof err, 'string');
        test.done();
      }.bind(this));
  },

  standardCommandSuccess: function(test) {
    test.expect(4);

    controller.closeTesselConnections.returns(Promise.resolve());
    var optionalValue = 'testValue';
    controller.standardTesselCommand(this.standardOpts, function(tessel) {
        // Make sure we have been given the tessel that was emitted
        test.deepEqual(tessel, usb);
        // Finish the command
        return Promise.resolve(optionalValue);
      })
      .then(function(returnedValue) {
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        // Ensure we got the optional returned value
        test.equal(optionalValue, returnedValue);
        test.done();
      }.bind(this))
      .catch(test.fail);

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
    }.bind(this));
  },

  standardCommandFailed: function(test) {
    test.expect(4);

    controller.closeTesselConnections.returns(Promise.resolve());

    var errMessage = 'This command failed';

    controller.standardTesselCommand(this.standardOpts, function(tessel) {
        // Make sure we have been given the tessel that was emitted
        test.deepEqual(tessel, usb);
        // Finish the command
        return Promise.reject(errMessage);
      })
      .then(test.fail)
      .catch(function(err) {
        // Make sure the error messages are passed through properly
        test.equal(errMessage, err);
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        test.done();
      }.bind(this));

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
    }.bind(this));
  },

  standardCommandSigInt: function(test) {
    test.expect(2);

    controller.closeTesselConnections.returns(Promise.resolve());

    controller.standardTesselCommand(this.standardOpts, function() {
        // This command doesn't do anything. It won't resolve so if we do get
        // to the next clause, it's due to the sigint
      })
      .then(function() {
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        test.done();
      }.bind(this))
      .catch(test.fail);

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
      process.emit('SIGINT');
    }.bind(this));
  },
};

exports['controller.closeTesselConnections'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noSSID: function(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: undefined
      })
      .catch(function(error) {
        test.ok(error);
        test.done();
      });
  },

  noPasswordWithSecurity: function(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: undefined,
        security: 'psk2'
      })
      .catch(function(error) {
        test.ok(error);
        test.done();
      });
  },

  invalidSecurityOption: function(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: undefined,
        security: 'reallySecure'
      })
      .catch(function(error) {
        test.ok(error);
        test.done();
      });
  },
};

exports['controller.root'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').returns(Promise.resolve());

    function FakeChild() {}

    FakeChild.prototype = Object.create(Emitter.prototype);

    this.child = new FakeChild();

    this.spawn = this.sandbox.stub(cp, 'spawn', function() {
      return this.child;
    }.bind(this));

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  setsOptsLanTrue: function(test) {
    test.expect(3);

    var opts = {};

    controller.root(opts)
      .then(function() {
        var options = this.standardTesselCommand.lastCall.args[0];

        test.equal(this.standardTesselCommand.callCount, 1);
        test.equal(options, opts);
        test.equal(options.lan, true);
        test.done();
      }.bind(this));
  },

  setsAuthorizedTrue: function(test) {
    test.expect(3);

    var opts = {};

    controller.root(opts)
      .then(function() {
        var options = this.standardTesselCommand.lastCall.args[0];

        test.equal(this.standardTesselCommand.callCount, 1);
        test.equal(options, opts);
        test.equal(options.authorized, true);
        test.done();
      }.bind(this));
  },

  openShell: function(test) {
    test.expect(6);

    var sandbox = this.sandbox;
    var tessel = newTessel({
      authorized: true,
      sandbox: sandbox,
      type: 'LAN',
    });

    var testIP = '192.1.1.1';
    tessel.lanConnection.ip = testIP;
    var testKey = '~/fake';

    this.standardTesselCommand.restore();
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand', function(opts, callback) {
      return callback(tessel);
    }.bind(this));

    controller.root({
        key: testKey
      })
      .then(function() {
        // Only spawn one process
        test.ok(this.spawn.calledOnce);
        // That process is ssh
        test.equal(this.spawn.firstCall.args[0], 'ssh');
        // We want to make sure we provide a key path
        test.equal(this.spawn.firstCall.args[1][0], '-i');
        // Make sure it's the optional key we provided
        test.equal(this.spawn.firstCall.args[1][1], testKey);
        // Make sure it's using the correct IP address
        test.equal(this.spawn.firstCall.args[1][2], 'root@' + testIP);
        // We want to ensure stdio streams are piped to the console
        test.equal(this.spawn.firstCall.args[2].stdio, 'inherit');
        test.done();
      }.bind(this));

    setImmediate(function() {
      this.child.emit('close');
    }.bind(this));
  },

  shellOpenError: function(test) {
    test.expect(1);

    var sandbox = this.sandbox;
    var tessel = newTessel({
      authorized: true,
      sandbox: sandbox,
      type: 'LAN',
    });

    this.standardTesselCommand.restore();
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand', function(opts, callback) {
      return callback(tessel);
    }.bind(this));

    var errMessage = 'Your child is a fake!';

    controller.root({})
      .then(function() {
        // Only spawn one process
        test.fail('Should have rejected the root promise.');
      }.bind(this))
      .catch(function(err) {
        test.ok(err.indexOf(errMessage) !== -1);
        test.done();
      });

    setImmediate(function() {
      this.child.emit('error', new Error(errMessage));
    }.bind(this));
  }
};
