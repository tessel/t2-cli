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
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn', function() {});
    this.info = this.sandbox.stub(log, 'info', function() {});
    this.basic = this.sandbox.stub(log, 'basic', function() {});

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
      .then(() => {
        test.equal(a.close.callCount, 1);
        test.equal(b.close.callCount, 1);
        test.equal(c.close.callCount, 0);
        test.done();
      });
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
      .then(() => {
        test.equal(a.close.callCount, 1);
        test.equal(b.close.callCount, 1);
        test.equal(c.close.callCount, 1);
        test.done();
      });
  },

  resolvesForUnauthorizedLANConnections: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: false,
      type: 'LAN'
    });

    controller.closeTesselConnections([a])
      .then(() => {
        test.equal(a.close.callCount, 0);
        test.done();
      });
  },
};

exports['controller.runHeuristics'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
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
      .then(() => {
        test.ok(false, 'Test failed because expected HeuristicAmbiguityError did not occur.');
        test.done();
      })
      .catch(error => {
        test.equal(error instanceof controller.HeuristicAmbiguityError, true);
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
      .then(() => {
        test.ok(false, 'Test failed because expected HeuristicAmbiguityError did not occur.');
        test.done();
      })
      .catch(error => {
        test.equal(error instanceof controller.HeuristicAmbiguityError, true);
        test.done();
      });
  }
};

exports['controller.tesselEnvVersions'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn', function() {});
    this.info = this.sandbox.stub(log, 'info', function() {});
    this.basic = this.sandbox.stub(log, 'basic', function() {});

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.packageJsonVersion = require('../../package.json').version;

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand', (opts, callback) => {
      return callback(this.tessel);
    });

    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', () => {
      return Promise.resolve('9a85c84f5a03c715908921baaaa9e7397985bc7f');
    });

    this.fetchCurrentNodeVersion = this.sandbox.stub(Tessel.prototype, 'fetchCurrentNodeVersion', () => {
      return Promise.resolve('4.2.1');
    });

    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList', () => {
      return Promise.resolve(
        [{
          'released': '2015-08-20T16:20:08.704Z',
          'sha': '78f2bd20af9eaf76796657186f3010f03a979dc8',
          'version': '0.0.3',
        }, {
          'released': '2015-08-18T15:12:13.070Z',
          'sha': 'bf327359b4a13b4da07bc5776fe8a22ae88d54f9',
          'version': '0.0.2',
        }, {
          'released': '2015-08-12T03:01:57.856Z',
          'sha': '9a85c84f5a03c715908921baaaa9e7397985bc7f',
          'version': '0.0.1',
        }]
      );
    });

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  properVersionsReturned: function(test) {
    test.expect(7);

    var opts = {};

    controller.tesselEnvVersions(opts)
      .then(() => {
        // Version command was sent
        test.equal(this.standardTesselCommand.callCount, 1);
        // Get the firmware version
        test.equal(this.fetchCurrentBuildInfo.callCount, 1);
        // Execute `node --version` command on tessel
        test.equal(this.fetchCurrentNodeVersion.callCount, 1);
        // Make sure we have some output
        test.equal(this.info.callCount, 3);

        // Output of CLI version to console
        test.equal(this.info.firstCall.args[0], `Tessel [TestTessel] CLI version: ${this.packageJsonVersion}`);
        // Output of firmware version to console
        test.equal(this.info.secondCall.args[0], 'Tessel [TestTessel] Firmware version: 0.0.1');
        // Output of Node version to console
        test.equal(this.info.thirdCall.args[0], 'Tessel [TestTessel] Node version: 4.2.1');
        test.done();
      });
  },

  nodeVersionFailed: function(test) {
    test.expect(7);

    this.info.restore();
    this.info = this.sandbox.stub(log, 'info', function() {});

    this.standardTesselCommand.restore();
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand', (opts, callback) => {
      return callback(this.tessel);
    });

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', () => {
      return Promise.resolve('9a85c84f5a03c715908921baaaa9e7397985bc7f');
    });

    this.fetchCurrentNodeVersion.restore();
    this.fetchCurrentNodeVersion = this.sandbox.stub(Tessel.prototype, 'fetchCurrentNodeVersion', () => {
      return Promise.reject();
    });

    var opts = {};

    controller.tesselEnvVersions(opts)
      .then(() => {
        // Version command was sent
        test.equal(this.standardTesselCommand.callCount, 1);
        // Get the firmware version
        test.equal(this.fetchCurrentBuildInfo.callCount, 1);
        // Execute `node --version` command on tessel
        test.equal(this.fetchCurrentNodeVersion.callCount, 1);
        // Make sure we have some output
        test.equal(this.info.callCount, 3);

        // Output of CLI version to console
        test.equal(this.info.firstCall.args[0], `Tessel [TestTessel] CLI version: ${this.packageJsonVersion}`);
        // Output of firmware version to console
        test.equal(this.info.secondCall.args[0], 'Tessel [TestTessel] Firmware version: 0.0.1');
        // Output of Node version to console
        test.equal(this.info.thirdCall.args[0], 'Tessel [TestTessel] Node version: unknown');
        test.done();
      });
  },

  firmwareVersionFailed: function(test) {
    test.expect(7);

    this.info.restore();
    this.info = this.sandbox.stub(log, 'info', function() {});

    this.standardTesselCommand.restore();
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand', (opts, callback) => {
      return callback(this.tessel);
    });

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', () => {
      return Promise.reject();
    });

    this.fetchCurrentNodeVersion.restore();
    this.fetchCurrentNodeVersion = this.sandbox.stub(Tessel.prototype, 'fetchCurrentNodeVersion', () => {
      return Promise.resolve('4.2.1');
    });

    var opts = {};

    controller.tesselEnvVersions(opts)
      .then(() => {
        // Version command was sent
        test.equal(this.standardTesselCommand.callCount, 1);
        // Get the firmware version
        test.equal(this.fetchCurrentBuildInfo.callCount, 1);
        // Execute `node --version` command on tessel
        test.equal(this.fetchCurrentNodeVersion.callCount, 0);
        // Make sure we have some output
        test.equal(this.info.callCount, 3);

        // Output of CLI version to console
        test.equal(this.info.firstCall.args[0], `Tessel [TestTessel] CLI version: ${this.packageJsonVersion}`);
        // Output of firmware version to console
        test.equal(this.info.secondCall.args[0], 'Tessel [TestTessel] Firmware version: unknown');
        // Output of Node version to console
        test.equal(this.info.thirdCall.args[0], 'Tessel [TestTessel] Node version: unknown');
        test.done();
      });
  }
};

exports['Tessel.list'] = {

  setUp: function(done) {
    var testContext = this;
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function() {
      testContext.activeSeeker = this;
      this.start = (opts) => {
        if (opts.timeout && typeof opts.timeout === 'number') {
          setTimeout(this.stop, opts.timeout);
        }
        return this;
      };
      this.stop = () => {
        this.emit('end');
        return this;
      };
    });
    util.inherits(this.seeker, Emitter);

    this.warn = this.sandbox.stub(log, 'warn', function() {});
    this.info = this.sandbox.stub(log, 'info', function() {});
    this.basic = this.sandbox.stub(log, 'basic', function() {});

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
      .then(() => {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(a.close.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
    });
  },

  oneLANTessel: function(test) {
    test.expect(4);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    Tessel.list(this.standardOpts)
      .then(() => {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(a.close.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
    });
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
      .then(() => {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(usb.close.callCount, 1);
        test.equal(lan.close.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    });
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
      .then(() => {
        test.equal(this.runHeuristics.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(usb.close.callCount, 1);
        test.equal(lan.close.callCount, 1);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    });
  },
};

exports['Tessel.get'] = {

  setUp: function(done) {
    var testContext = this;
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function Seeker() {
      this.start = (opts) => {
        testContext.activeSeeker = this;
        this.msg = {
          noAuth: 'No Authorized Tessels Found.',
          auth: 'No Tessels Found.'
        };
        if (opts.timeout && typeof opts.timeout === 'number') {
          setTimeout(this.stop, opts.timeout);
        }
        return this;
      };
      this.stop = () => {
        testContext.activeSeeker.emit('end');
        return this;
      };
    });
    util.inherits(this.seeker, Emitter);
    this.warn = this.sandbox.stub(log, 'warn', function() {});
    this.info = this.sandbox.stub(log, 'info', function() {});
    this.basic = this.sandbox.stub(log, 'basic', function() {});
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
      .then(() => {
        test.equal(this.reconcileTessels.callCount, 0);
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.info.callCount, 2);
        test.equal(this.info.lastCall.args[0].includes('the_name'), true);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
    });
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
      .then(() => {
        test.equal(this.reconcileTessels.callCount, 0);
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.info.callCount, 2);
        test.equal(this.info.lastCall.args[0].includes('the_name'), true);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
    });
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
      .then(() => {
        test.equal(this.reconcileTessels.callCount, 1);
        test.equal(this.runHeuristics.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.info.callCount, 2);
        test.equal(this.info.lastCall.args[0].includes('samesies'), true);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    });

  },

  standardCommandNoTessels: function(test) {
    test.expect(2);

    controller.standardTesselCommand(this.standardOpts, function() {
        // Doesn't matter what this function does b/c Tessel.get will fail
        return Promise.resolve();
      })
      .catch(error => {
        // We don't need to close any connections because none were found
        test.equal(this.closeTesselConnections.callCount, 0);
        test.equal(typeof error, 'string');
        test.done();
      });
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
      .then(returnedValue => {
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        // Ensure we got the optional returned value
        test.equal(optionalValue, returnedValue);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
    });
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
      .then(() => {
        test.ok(false, 'standardTesselCommand was expected to fail, but did not.');
        test.done();
      })
      .catch(error => {
        // Make sure the error messages are passed through properly
        test.equal(errMessage, error);
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        test.done();
      });

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
    });
  },

  standardCommandSigInt: function(test) {
    test.expect(2);

    controller.closeTesselConnections.returns(Promise.resolve());

    controller.standardTesselCommand(this.standardOpts, function() {
        // This command doesn't do anything. It won't resolve so if we do get
        // to the next clause, it's due to the sigint
      })
      .then(() => {
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
      process.emit('SIGINT');
    });
  },
};

exports['controller.closeTesselConnections'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn', function() {});
    this.info = this.sandbox.stub(log, 'info', function() {});
    this.basic = this.sandbox.stub(log, 'basic', function() {});

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noNetworkSSID: function(test) {
    test.expect(1);

    controller.connectToNetwork({
        ssid: undefined
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  noNetworkPasswordWithSecurity: function(test) {
    test.expect(1);

    controller.connectToNetwork({
        ssid: 'test',
        password: undefined,
        security: 'psk2'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  invalidNetworkSecurityOption: function(test) {
    test.expect(1);

    controller.connectToNetwork({
        ssid: 'test',
        password: undefined,
        security: 'reallySecure'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  noAccessPointSSID: function(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: undefined
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  noAccessPointPasswordWithSecurity: function(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: undefined,
        security: 'psk2'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  invalidAccessPointSecurityOption: function(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: undefined,
        security: 'reallySecure'
      })
      .catch(error => {
        test.ok(true, error.toString());
        test.done();
      });
  },
};

exports['controller.root'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn', function() {});
    this.info = this.sandbox.stub(log, 'info', function() {});
    this.basic = this.sandbox.stub(log, 'basic', function() {});

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').returns(Promise.resolve());

    function FakeChild() {}

    FakeChild.prototype = Object.create(Emitter.prototype);

    this.child = new FakeChild();

    this.spawn = this.sandbox.stub(cp, 'spawn', () => this.child);

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
      .then(() => {
        var options = this.standardTesselCommand.lastCall.args[0];

        test.equal(this.standardTesselCommand.callCount, 1);
        test.equal(options, opts);
        test.equal(options.lan, true);
        test.done();
      });
  },

  setsOptsUsbFalseAndWarns: function(test) {
    test.expect(4);

    var opts = {
      usb: true
    };

    this.warn.restore();
    this.warn = this.sandbox.stub(log, 'warn', function() {});

    controller.root(opts)
      .then(() => {
        var options = this.standardTesselCommand.lastCall.args[0];

        test.equal(this.standardTesselCommand.callCount, 1);
        test.equal(options, opts);
        test.equal(options.usb, false);
        test.equal(this.warn.callCount, 2);
        test.done();
      });
  },

  setsAuthorizedTrue: function(test) {
    test.expect(3);

    var opts = {};

    controller.root(opts)
      .then(() => {
        var options = this.standardTesselCommand.lastCall.args[0];

        test.equal(this.standardTesselCommand.callCount, 1);
        test.equal(options, opts);
        test.equal(options.authorized, true);
        test.done();
      });
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
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand', (opts, callback) => {
      return callback(tessel);
    });

    // Return our own local auth key (it won't be set because we have stubbed
    // that functionality out of standardTesselCommand)
    this.sandbox.stub(Tessel, 'LOCAL_AUTH_KEY', testKey);

    controller.root({
        key: testKey
      })
      .then(() => {
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
      });

    setImmediate(() => {
      this.child.emit('close');
    });
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
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand', (opts, callback) => {
      return callback(tessel);
    });

    var errMessage = 'Your child is a fake!';

    controller.root({})
      .then(() => {
        // Only spawn one process
        test.ok(false, 'Should have rejected the root promise.');
        test.done();
      })
      .catch(error => {
        test.ok(error.includes(errMessage));
        test.done();
      });

    setImmediate(() => {
      this.child.emit('error', new Error(errMessage));
    });
  }
};
