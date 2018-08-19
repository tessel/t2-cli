// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

function newTessel(options) {
  var tessel = new Tessel({
    connectionType: options.type || 'LAN',
    authorized: options.authorized !== undefined ? options.authorized : true,
    end: function() {
      return Promise.resolve();
    }
  });

  tessel.name = options.name || 'a';

  options.sandbox.stub(tessel, 'close').callsFake(function() {
    return Promise.resolve();
  });

  return tessel;
}

exports['controller.tessel'] = {

  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    controller.tessel = null;
    done();
  },

  tesselStartsNull(test) {
    test.expect(1);
    test.equal(controller.tessel, null);
    test.done();
  },
};

exports['controller.setupLocal'] = {

  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.provisionsetupLocal = this.sandbox.stub(provision, 'setupLocal');
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  passthroughCall(test) {
    test.expect(2);

    var options = {};

    controller.setupLocal(options);

    test.equal(this.provisionsetupLocal.callCount, 1);
    test.equal(this.provisionsetupLocal.lastCall.args[0], options);
    test.done();
  },
};

exports['controller.reconcileTessels'] = {

  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  resolveImmediatelyWhenOnlyOne(test) {
    test.expect(1);

    controller.reconcileTessels([1]).then(reconciled => {
      test.equal(reconciled, 1);
      test.done();
    });
  },
};


exports['controller.provision'] = {

  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');
    this.isProvisioned = this.sandbox.stub(Tessel, 'isProvisioned').returns(true);
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').returns(Promise.resolve());

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  isProvisionedAndOptsNotForced(test) {
    test.expect(1);

    controller.provision({}).then(() => {
      // We only care that this resolves.
      test.ok(true);
      test.done();
    });
  },
};

exports['controller.closeTesselConnections'] = {

  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  rejectsOnError(test) {
    test.expect(1);

    this.asyncEach = this.sandbox.stub(async, 'each').callsFake((tessels, next, done) => {
      done(new Error('This is only a test'));
    });

    controller.closeTesselConnections([1, 2, 3])
      .catch(error => {
        test.equal(error.toString(), 'Error: This is only a test');
        test.done();
      });
  },

  callsCloseOnAllAuthorizedLANConnections(test) {
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

  callsCloseOnAllUSBConnections(test) {
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

  resolvesForUnauthorizedLANConnections(test) {
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

  resolvesForClosedUSBConnections(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: false,
      type: 'USB'
    });

    a.usbConnection.closed = true;

    controller.closeTesselConnections([a])
      .then(() => {
        test.equal(a.close.callCount, 0);
        test.done();
      });
  },
};

exports['controller.runHeuristics'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.processOn = this.sandbox.stub(process, 'on');
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  oneUSBDevice(test) {
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

  oneLANDevice(test) {
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

  USBAndLANDevices(test) {
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

  bothConnectionsAndLAN(test) {
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

  bothConnectionsAndMultipleLAN(test) {
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

  USBAndLANDevicesWithNameOption(test) {
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

  USBAndLANDevicesWithEnvVariable(test) {
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

  catchAmbiguityTwoLAN(test) {

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

  catchAmbiguityTwoUSB(test) {

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

exports['controller.envVersions'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.packageJsonVersion = require('../../package.json').version;

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo').callsFake(() => {
      return Promise.resolve('9a85c84f5a03c715908921baaaa9e7397985bc7f');
    });

    this.fetchNodeProcessVersion = this.sandbox.stub(Tessel.prototype, 'fetchNodeProcessVersion').callsFake(() => {
      return Promise.resolve('4.2.1');
    });

    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList').callsFake(() => {
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

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  properVersionsReturned(test) {
    test.expect(8);

    var opts = {};

    controller.envVersions(opts)
      .then(() => {
        // Version command was sent
        test.equal(this.standardTesselCommand.callCount, 1);
        // Get the firmware version
        test.equal(this.fetchCurrentBuildInfo.callCount, 1);
        // Execute `node --version` command on tessel
        test.equal(this.fetchNodeProcessVersion.callCount, 1);
        // Make sure we have some output
        test.equal(this.info.callCount, 4);

        test.equal(this.info.getCall(0).args[0], `Tessel Environment Versions:`);
        // Output of CLI version to console
        test.equal(this.info.getCall(1).args[0], `t2-cli: ${this.packageJsonVersion}`);
        // Output of firmware version to console
        test.equal(this.info.getCall(2).args[0], 't2-firmware: 0.0.1');
        // Output of Node version to console
        test.equal(this.info.getCall(3).args[0], 'Node.js: 4.2.1');
        test.done();
      });
  },

  requestVersionWithoutTessel(test) {
    test.expect(7);

    const message = 'No Tessels Found.';

    this.standardTesselCommand.restore();
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake(() => {
      return Promise.reject(message);
    });

    const opts = {};

    controller.envVersions(opts)
      .then(() => {
        // Version command was sent
        test.equal(this.standardTesselCommand.callCount, 1);

        test.equal(this.fetchCurrentBuildInfo.callCount, 0);
        test.equal(this.fetchNodeProcessVersion.callCount, 0);

        // Make sure we have some output
        test.equal(this.info.callCount, 3);

        test.equal(this.info.getCall(0).args[0], `Tessel Environment Versions:`);
        // Output of CLI version to console
        test.equal(this.info.getCall(1).args[0], `t2-cli: ${this.packageJsonVersion}`);
        // Output 'No Tessels Found' message
        test.equal(this.info.getCall(2).args[0], message);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'envVersions was expected to succeed');
        test.done();
      });
  },

  requestVersionsFailure(test) {
    test.expect(1);

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(this.tessel, 'fetchCurrentBuildInfo').callsFake(() => {
      throw new Error();
    });

    var opts = {};

    controller.envVersions(opts)
      .then(() => {
        test.ok(false, 'envVersions was expected to fail');
        test.done();
      })
      .catch(() => {
        test.ok(true);
        test.done();
      });
  },

  // This happens with development builds.
  noBuildVersionExistsForThisSha(test) {
    test.expect(1);

    const sha = '59ce9c97e275e6e970c1ee668e5591514eb1cd74';

    this.fetchCurrentBuildInfo.restore();
    this.sandbox.stub(this.tessel, 'fetchCurrentBuildInfo').callsFake(() => Promise.resolve(sha));

    var opts = {};

    controller.envVersions(opts)
      .then(() => {
        test.equal(this.info.getCall(2).args[0], `t2-firmware: ${sha}`);
        test.done();
      })
      .catch(() => {
        test.ok(false);
        test.done();
      });
  },
};

exports['Tessel.list'] = {

  setUp(done) {
    var testContext = this;
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker').callsFake(function() {
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

    this.closeTesselConnections = this.sandbox.spy(controller, 'closeTesselConnections');
    this.runHeuristics = this.sandbox.spy(controller, 'runHeuristics');

    this.standardOpts = {
      timeout: 0.01,
    };

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  oneUSBTessel(test) {
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

  oneLANTessel(test) {
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

  explicitlyOnlyReportAuthorizedTessel(test) {
    test.expect(4);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: false,
      type: 'LAN'
    });

    var customOpts = Object.assign({}, this.standardOpts, {
      authorized: true
    });

    Tessel.list(customOpts)
      .then(() => {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);

        // "a" will not be closed, because it will never be opened.
        test.equal(a.close.callCount, 0);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      }).catch(error => {

        console.log(error);
      });

    this.activeSeeker.emit('tessel', a);
    this.activeSeeker.emit('end');

  },

  explicitlyOnlyReportAuthorizedTesselNoneFound(test) {
    test.expect(1);

    this.standardOpts.authorized = true;

    Tessel.list(this.standardOpts)
      .then(() => {
        test.ok(false, 'This should not be successful');
        test.done();
      }).catch(error => {
        test.equal(error.toString(), 'No Authorized Tessels Found.');
        test.done();
      });

    this.activeSeeker.emit('end');
  },

  oneTesselTwoConnections(test) {
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

  multipleDifferentTessels(test) {
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

  runHeuristicsRejection(test) {
    test.expect(1);

    this.runHeuristics.restore();
    this.closeTesselConnections.restore();

    this.runHeuristics = this.sandbox.stub(controller, 'runHeuristics').returns(Promise.reject(new Error('Bogus error')));
    this.closeTesselConnections = this.sandbox.stub(controller, 'closeTesselConnections').returns(Promise.resolve());

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
      .catch(error => {
        test.equal(error.toString(), 'Error: Bogus error');
      }).then(() => {
        usb.mockClose();
        lan.mockClose();
        test.done();
      });

    // Make sure the multiple tessel path is taken
    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);
    this.activeSeeker.emit('end');
  },
};

exports['Tessel.get'] = {

  setUp(done) {
    var testContext = this;
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker').callsFake(function Seeker() {
      this.start = (opts) => {
        testContext.activeSeeker = this;
        testContext.sandbox.spy(this, 'removeAllListeners');
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


    this.closeTesselConnections = this.sandbox.stub(controller, 'closeTesselConnections');
    this.reconcileTessels = this.sandbox.spy(controller, 'reconcileTessels');
    this.runHeuristics = this.sandbox.spy(controller, 'runHeuristics');

    this.standardOpts = {
      timeout: 0.01,
    };

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  fallbackTimeout(test) {
    test.expect(7);

    controller.closeTesselConnections.returns(Promise.resolve());

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'the_name'
    });

    var customOpts = {
      key: this.standardOpts.key,
      name: 'the_name',
      timeout: 0,
    };

    Tessel.get(customOpts)
      .then(() => {
        test.equal(this.activeSeeker.removeAllListeners.callCount, 1);
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

  oneNamedTessel(test) {
    test.expect(7);

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
        test.equal(this.activeSeeker.removeAllListeners.callCount, 1);
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

  oneUnNamedTessel(test) {
    test.expect(7);

    controller.closeTesselConnections.returns(Promise.resolve());

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'the_name'
    });

    Tessel.get(this.standardOpts)
      .then(() => {
        test.equal(this.activeSeeker.removeAllListeners.callCount, 0);
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

  logAndFinishSpecificTessel(test) {
    test.expect(2);

    controller.closeTesselConnections.returns(Promise.resolve());

    this.menuPrompt = this.sandbox.stub(Menu, 'prompt').callsFake((prompt) => {

      var value = prompt.translate('\tUSB\ta\t');
      return Promise.resolve(value);
    });

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'a'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'b'
    });

    var customOpts = Object.assign({}, this.standardOpts, {
      name: 'a'
    });

    Tessel.get(customOpts)
      .then(() => {
        a.mockClose();
        b.mockClose();
        test.equal(this.activeSeeker.removeAllListeners.callCount, 1);
        test.equal(this.info.callCount, 2);
        test.done();
      });

    // We must emit the Tessel sometime after list is called
    // but before the seeker stops searching
    this.activeSeeker.emit('tessel', a);
    this.activeSeeker.emit('tessel', b);
    this.activeSeeker.emit('end');
  },

  oneUnamedTesselTwoConnections(test) {
    test.expect(7);

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
        test.equal(this.activeSeeker.removeAllListeners.callCount, 0);
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

  twoDifferentTesselsPickOne(test) {
    test.expect(6);

    controller.closeTesselConnections.returns(Promise.resolve());

    this.runHeuristics.restore();
    this.runHeuristics = this.sandbox.stub(controller, 'runHeuristics').callsFake(() => {
      return Promise.reject(new controller.HeuristicAmbiguityError('Bogus error'));
    });
    this.menuPrompt = this.sandbox.stub(Menu, 'prompt').callsFake((prompt) => {

      var value = prompt.translate('\tUSB\ta\t');
      return Promise.resolve(value);
    });

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'a'
    });

    var lan = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'a'
    });

    var customOpts = this.standardOpts;

    Tessel.get(customOpts)
      .catch(() => {
        test.equal(this.activeSeeker.removeAllListeners.callCount, 0);
        test.equal(this.reconcileTessels.callCount, 1);
        test.equal(this.runHeuristics.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.info.callCount, 1);
        test.done();
      });

    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);
    this.activeSeeker.emit('end');
  },

  standardCommandNoTessels(test) {
    test.expect(3);

    controller.standardTesselCommand(this.standardOpts, function() {
        // Doesn't matter what this function does b/c Tessel.get will fail
        return Promise.resolve();
      })
      .catch(error => {
        test.equal(controller.tessel, null);
        // We don't need to close any connections because none were found
        test.equal(this.closeTesselConnections.callCount, 0);
        test.equal(typeof error, 'string');
        test.done();
      });
  },

  standardCommandSuccess(test) {
    test.expect(5);

    controller.closeTesselConnections.returns(Promise.resolve());
    var optionalValue = 'testValue';
    controller.standardTesselCommand(this.standardOpts, tessel => {
        // Make sure we have been given the tessel that was emitted
        test.deepEqual(tessel, usb);
        // The active tessel is available at controller.tessel
        test.equal(controller.tessel, usb);
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

  standardCommandFailed(test) {
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

  standardCommandSigInt(test) {
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

exports['controller.createAccessPoint'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    // stub this command to avoid authoized Tessel validation
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').returns(Promise.resolve(true));

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  noNetworkSSID(test) {
    test.expect(1);

    controller.connectToNetwork({
        ssid: undefined
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  noNetworkPasswordWithSecurity(test) {
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

  invalidNetworkSecurityOption(test) {
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

  noAccessPointSSID(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: undefined
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  noAccessPointPasswordWithSecurity(test) {
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

  invalidAccessPointSecurityOption(test) {
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

  invalidAccessPointWEPPasswordCharacters(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: 'nothexdigits',
        security: 'wep'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  invalidAccessPointWEPPasswordLength(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: '0123456789ABCDEF',
        security: 'wep'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  validAccessPointWEPPassword(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: '01234ABCDE',
        security: 'wep'
      })
      .then((settings) => {
        test.ok(settings);
        test.done();
      })
      .catch(error => {
        test.fail(error.toString());
        test.done();
      });
  },

  invalidAccessPointPSKPasswordCharacters(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: 'Password™',
        security: 'psk'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  invalidAccessPointPSKASCIIPasswordTooShort(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: 'short',
        security: 'psk'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  invalidAccessPointPSKASCIIPasswordTooLong(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: 'this is a very long passphrase. in fact, it is over 63 characters, which makes it invalid.',
        security: 'psk'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  invalidAccessPointPSKHexPasswordTooShort(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: 'DEAD',
        security: 'psk'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  invalidAccessPointPSKHexPasswordTooLong(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: 'DEADDEADDEADDEADDEADDEADDEADDEADDEADDEADDEADDEADDEADDEADDEADDEADDEAD',
        security: 'psk'
      })
      .catch(error => {
        test.ok(error);
        test.done();
      });
  },

  validAccessPointPSKPassword(test) {
    test.expect(1);

    controller.createAccessPoint({
        ssid: 'test',
        password: 'ValidPassword!',
        security: 'psk'
      })
      .then((settings) => {
        test.ok(settings);
        test.done();
      })
      .catch((error) => {
        test.fail(error.toString());
        test.done();
      });
  },
};

exports['controller.getWifiInfo'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    // stub this command to avoid authoized Tessel validation
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').returns(Promise.resolve(true));

    this.lanbot = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'lanbot'
    });

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  requestNetworkInfo(test) {
    test.expect(5);
    const options = {};

    controller.standardTesselCommand.restore();
    this.sandbox.stub(controller, 'standardTesselCommand').callsFake(
      (options, callback) => callback(this.lanbot)
    );

    this.sandbox.stub(this.lanbot, 'getWifiInfo').returns(
      Promise.resolve(global.networkInfo)
    );

    controller.getWifiInfo(options)
      .then(() => {
        test.equal(this.info.callCount, 4);
        test.equal(this.info.getCall(0).args[0], 'SSID: skynet');
        test.equal(this.info.getCall(1).args[0], 'IP Address: 000.000.000.000');
        test.equal(this.info.getCall(2).args[0], 'Signal Strength: (70/70)');
        test.equal(this.info.getCall(3).args[0], 'Bitrate: 22 Mbps');
        test.done();
      });
  },
};


exports['controller.root'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').returns(Promise.resolve());

    function FakeChild() {}

    FakeChild.prototype = Object.create(Emitter.prototype);

    this.child = new FakeChild();

    this.spawn = this.sandbox.stub(cp, 'spawn').callsFake(() => this.child);

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  setsOptsLanTrue(test) {
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

  setsOptsUsbFalseAndWarns(test) {
    test.expect(4);

    var opts = {
      usb: true
    };

    this.warn.restore();
    this.warn = this.sandbox.stub(log, 'warn');

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

  setsAuthorizedTrue(test) {
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

  openShell(test) {
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
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(tessel);
    });

    // Return our own local auth key (it won't be set because we have stubbed
    // that functionality out of standardTesselCommand)
    // this.sandbox.stub(Tessel, 'LOCAL_AUTH_KEY').callsFake(testKey);

    var opd = Object.getOwnPropertyDescriptor(Tessel, 'LOCAL_AUTH_KEY');

    Object.defineProperty(Tessel, 'LOCAL_AUTH_KEY', {
      get() {
        return testKey;
      }
    });
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

        Object.defineProperty(Tessel, 'LOCAL_AUTH_KEY', opd);
        test.done();
      });

    setImmediate(() => {
      this.child.emit('close');
    });
  },

  shellOpenError(test) {
    test.expect(1);

    var sandbox = this.sandbox;
    var tessel = newTessel({
      authorized: true,
      sandbox: sandbox,
      type: 'LAN',
    });

    this.standardTesselCommand.restore();
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
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

exports['controller.printAvailableNetworks'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator();
    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      callback(this.tessel);
      return Promise.resolve(this.tessel);
    });

    this.tessel.name = 'robocop';

    colors.enabled = false;

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();

    colors.enabled = true;
    done();
  },

  listCountOfVisibleToTesselSingle(test) {
    test.expect(5);

    this.findAvailableNetworks = this.sandbox.stub(this.tessel, 'findAvailableNetworks').callsFake(() => {
      return Promise.resolve([{
        ssid: 'foo',
        quality: '100/100'
      }]);
    });

    controller.printAvailableNetworks({})
      .then(() => {

        test.equal(this.info.callCount, 2);
        test.equal(this.basic.callCount, 1);

        test.equal(this.info.firstCall.args[0], 'Scanning for visible networks...');
        test.equal(this.info.lastCall.args[0], 'Found 1 network visible to robocop:');
        test.equal(this.basic.lastCall.args[0], '\tfoo (100/100)');
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  listCountOfVisibleToTesselPlural(test) {
    test.expect(6);

    this.findAvailableNetworks = this.sandbox.stub(this.tessel, 'findAvailableNetworks').callsFake(() => {
      return Promise.resolve([{
        ssid: 'foo',
        quality: '100/100'
      }, {
        ssid: 'bar',
        quality: '100/100'
      }]);
    });

    controller.printAvailableNetworks({})
      .then(() => {

        test.equal(this.info.callCount, 2);
        test.equal(this.basic.callCount, 2);

        test.equal(this.info.firstCall.args[0], 'Scanning for visible networks...');
        test.equal(this.info.lastCall.args[0], 'Found 2 networks visible to robocop:');
        test.equal(this.basic.firstCall.args[0], '\tfoo (100/100)');
        test.equal(this.basic.lastCall.args[0], '\tbar (100/100)');
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

  listCountOfVisibleToTesselPluralZero(test) {
    test.expect(4);

    this.findAvailableNetworks = this.sandbox.stub(this.tessel, 'findAvailableNetworks').callsFake(() => {
      return Promise.resolve([]);
    });

    controller.printAvailableNetworks({})
      .then(() => {

        test.equal(this.info.callCount, 2);
        test.equal(this.basic.callCount, 0);

        test.equal(this.info.firstCall.args[0], 'Scanning for visible networks...');
        test.equal(this.info.lastCall.args[0], 'Found 0 networks visible to robocop:');
        test.done();
      })
      .catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
  },

};

exports['controller.uninstaller'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.homedir = this.sandbox.stub(installer, 'homedir').returns(Promise.resolve());
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  optionsOperationCallThrough(test) {
    test.expect(1);

    controller.uninstaller({
        operation: 'homedir'
      })
      .then(() => {
        test.equal(this.homedir.callCount, 1);
        test.done();
      });
  },
};

exports['controller.reboot'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.reboot = this.sandbox.stub(this.tessel, 'reboot');

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  success(test) {
    test.expect(2);

    this.reboot.returns(Promise.resolve());
    controller.reboot({})
      .then(() => {
        test.equal(this.reboot.callCount, 1);
        test.equal(this.info.callCount, 1);
        test.done();
      });
  },

  failure(test) {
    test.expect(1);

    this.reboot.returns(Promise.reject());

    controller.reboot({})
      .catch(() => {
        test.equal(this.reboot.callCount, 1);
        test.done();
      });
  },
};

exports['controller.updateWithRemoteBuilds'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');
    this.tessel = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList').callsFake(() => {
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

    colors.enabled = false;
    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    colors.enabled = true;
    done();
  },

  noUsbRejection(test) {
    test.expect(1);

    controller.updateWithRemoteBuilds({}, this.tessel)
      .catch(error => {
        test.equal(error.toString(), 'Must have Tessel connected over USB to complete update. Aborting update.');

        test.done();
      });
  },

  noForceRejection(test) {
    test.expect(3);

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.fetchCurrentBuildInfo = this.sandbox.stub(this.tessel, 'fetchCurrentBuildInfo').returns(Promise.reject(new Error('No such file or directory')));

    controller.updateWithRemoteBuilds({
        force: false
      }, this.tessel)
      .catch(error => {
        test.equal(error.toString(), 'Error: No such file or directory');
        test.equal(this.warn.callCount, 1);
        test.equal(this.warn.lastCall.args[0].includes('Could not find firmware version on '), true);
        test.done();
      });
  },
};

exports['controller.restore'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.get = this.sandbox.stub(controller, 'get').returns(Promise.resolve(this.tessel));
    this.tesselRestore = this.sandbox.stub(this.tessel, 'restore').returns(Promise.resolve());

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  restoreCallPipelineResolved(test) {
    test.expect(2);

    controller.restore({})
      .then(() => {
        test.equal(this.get.callCount, 1);
        test.equal(this.tesselRestore.callCount, 1);
        test.done();
      });
  },

  restoreCallPipelineRejected(test) {
    test.expect(2);

    this.tesselRestore.restore();
    this.tesselRestore = this.sandbox.stub(this.tessel, 'restore').returns(Promise.reject(new Error('whatever')));

    controller.restore({})
      .catch(() => {
        test.equal(this.get.callCount, 1);
        test.equal(this.tesselRestore.callCount, 1);
        test.done();
      });
  },
};

exports['controller.deploy'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.deploy = this.sandbox.stub(this.tessel, 'deploy').returns(Promise.resolve());

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  deployCallPipeline(test) {
    test.expect(2);

    var options = {};

    controller.deploy(options)
      .then(() => {
        test.equal(this.standardTesselCommand.lastCall.args[0], options);
        test.equal(this.deploy.callCount, 1);
        test.done();
      });
  },
};

exports['controller.restart'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.restart = this.sandbox.stub(this.tessel, 'restart').returns(Promise.resolve());

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  restartCallPipeline(test) {
    test.expect(2);

    var options = {};

    controller.restart(options)
      .then(() => {
        test.equal(this.standardTesselCommand.lastCall.args[0], options);
        test.equal(this.restart.callCount, 1);
        test.done();
      });
  },
};

exports['controller.eraseScript'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.eraseScript = this.sandbox.stub(this.tessel, 'eraseScript').returns(Promise.resolve());

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  eraseScriptCallPipeline(test) {
    test.expect(2);

    var options = {};

    controller.eraseScript(options)
      .then(() => {
        test.equal(this.standardTesselCommand.lastCall.args[0], options);
        test.equal(this.eraseScript.callCount, 1);
        test.done();
      });
  },
};

exports['controller.setWiFiState'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.setWiFiState = this.sandbox.stub(this.tessel, 'setWiFiState').returns(Promise.resolve());

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  setWiFiStateCallPipeline(test) {
    test.expect(2);

    var options = {};

    controller.setWiFiState(options)
      .then(() => {
        test.equal(this.standardTesselCommand.lastCall.args[0], options);
        test.equal(this.setWiFiState.callCount, 1);
        test.done();
      });
  },

  setWiFiStateMissingEnable(test) {
    test.expect(1);
    this.setWiFiState.restore();

    controller.setWiFiState({})
      .then(() => {
        test.ok(false, 'This should not be successful');
        test.done();
      }).catch(error => {
        test.equal(error.toString(), 'Error: Missing Wifi State: property "enable" not provided.');
        test.done();
      });
  },
};

exports['controller.disableAccessPoint'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.disableAccessPoint = this.sandbox.stub(this.tessel, 'disableAccessPoint').returns(Promise.resolve());

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  disableAccessPointCallPipeline(test) {
    test.expect(2);

    var options = {};

    controller.disableAccessPoint(options)
      .then(() => {
        test.equal(this.standardTesselCommand.lastCall.args[0], options);
        test.equal(this.disableAccessPoint.callCount, 1);
        test.done();
      });
  },
};

exports['controller.enableAccessPoint'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.enableAccessPoint = this.sandbox.stub(this.tessel, 'enableAccessPoint').returns(Promise.resolve());

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  enableAccessPointCallPipeline(test) {
    test.expect(2);

    var options = {};

    controller.enableAccessPoint(options)
      .then(() => {
        test.equal(this.standardTesselCommand.lastCall.args[0], options);
        test.equal(this.enableAccessPoint.callCount, 1);
        test.done();
      });
  },
};

exports['controller.rename'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');
    this.error = this.sandbox.stub(log, 'error');

    this.tessel = TesselSimulator({
      name: 'TestTessel'
    });

    this.rename = this.sandbox.stub(this.tessel, 'rename').returns(Promise.resolve());

    this.standardTesselCommand = this.sandbox.stub(controller, 'standardTesselCommand').callsFake((options, callback) => {
      return callback(this.tessel);
    });

    colors.enabled = false;

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();

    colors.enabled = true;

    done();
  },

  willNotRenameSameAsCurrent(test) {
    test.expect(2);

    var options = {
      newName: this.tessel.name,
    };

    controller.rename(options)
      .then(() => {
        // Assert that a warning was logged when
        // the new name is the same as the old name
        test.equal(this.warn.callCount, 1);
        test.equal(this.warn.lastCall.args[0], 'Name of device is already TestTessel');
        test.done();
      });
  },

  renameCallPipeline(test) {
    test.expect(4);

    var options = {
      // reset: true,
      newName: 'Valid',
    };

    controller.rename(options)
      .then(() => {
        test.equal(this.standardTesselCommand.lastCall.args[0], options);
        test.equal(this.info.callCount, 1);
        test.equal(this.info.lastCall.args[0], 'Renaming TestTessel to Valid');
        test.equal(this.rename.callCount, 1);
        test.done();
      });
  },
};
