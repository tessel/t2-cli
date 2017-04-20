// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

/*global CrashReporter */

// This was removed from bootstrap due to issues that surface
// when running the test suite on appveyor.
global.t2 = require('../../bin/tessel-2');

// If the defaults are intentionally changed in bin-tessel-2,
// then they must be changed here as well. This ensures that the
// expected default command options are protected from regressions.
// This should be used as a guide for reviewing new tessel-centric
// additions to the cli command set.


var defaults = {
  timeout: {
    abbr: 't',
    metavar: 'TIMEOUT',
    help: 'Set timeout in seconds for scanning for networked tessels',
    default: 5,
    name: 'timeout',
  },
  name: {
    metavar: 'NAME',
    help: 'The name of the tessel on which the command will be executed',
    name: 'name',
  },
  lan: {
    flag: true,
    help: 'Use only a LAN connection',
    name: 'lan',
    string: '--lan',
  },
  usb: {
    flag: true,
    help: 'Use only a USB connection',
    name: 'usb',
    string: '--usb',
  },
  lanPrefer: {
    flag: true,
    default: false,
    help: 'Prefer a LAN connection if it\'s available, otherwise use USB'
  }
};

exports['Tessel (t2: makeCommand)'] = {
  any(test) {
    test.expect(16);

    t2.makeCommand('any')
      .callback(function() {

        // "this" is the nomnom parser object
        test.equal(this.specs.timeout.abbr, defaults.timeout.abbr);
        test.equal(this.specs.timeout.default, defaults.timeout.default);
        test.equal(this.specs.timeout.help, defaults.timeout.help);
        test.equal(this.specs.timeout.metavar, defaults.timeout.metavar);
        test.equal(this.specs.timeout.name, defaults.timeout.name);

        test.equal(this.specs.name.help, defaults.name.help);
        test.equal(this.specs.name.metavar, defaults.name.metavar);
        test.equal(this.specs.name.name, defaults.name.name);

        test.equal(this.specs.lan.flag, defaults.lan.flag);
        test.equal(this.specs.lan.help, defaults.lan.help);
        test.equal(this.specs.lan.string, defaults.lan.string);
        test.equal(this.specs.lan.name, defaults.lan.name);

        test.equal(this.specs.usb.flag, defaults.usb.flag);
        test.equal(this.specs.usb.help, defaults.usb.help);
        test.equal(this.specs.usb.string, defaults.usb.string);
        test.equal(this.specs.usb.name, defaults.usb.name);

        test.done();
      });

    t2(['any']);
  }
};

exports['Tessel (t2: restart)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.error = this.sandbox.stub(log, 'error');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.restart = this.sandbox.stub(controller, 'restart').returns(Promise.resolve());
    this.closeFailedCommand = this.sandbox.spy(t2, 'closeFailedCommand');
    this.closeSuccessfulCommand = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noError: function(test) {
    test.expect(1);

    t2(['restart', '--entryPoint=index.js', '--type=ram']);

    test.equal(this.restart.callCount, 1);
    // We must wait for the command to complete
    // or else the sandbox will be cleared too early
    setImmediate(test.done);
  },

  exitCodeOne: function(test) {
    test.expect(4);

    var error = new Error('Some error happened.');
    var restartOp = Promise.reject(error);

    this.restart.returns(restartOp);

    t2(['restart', '--entryPoint=index.js', '--type=ram']);

    restartOp.catch(() => {
      test.equal(this.restart.callCount, 1);
      test.equal(this.closeFailedCommand.callCount, 1);
      test.equal(this.closeFailedCommand.lastCall.args[0], error);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    });
  },

  entryPointFallbackToPrevious: function(test) {
    test.expect(1);

    var restartOp = Promise.resolve();
    this.sandbox.stub(Preferences, 'read').returns(Promise.resolve('previous.js'));

    t2(['restart']);

    this.restart.returns(restartOp);

    restartOp.then(() => {
      test.equal(this.restart.lastCall.args[0].entryPoint, 'previous.js');
      test.done();
    });
  },

  entryPointFallbackNoPrevious: function(test) {
    test.expect(1);

    this.closeFailedCommand.restore();
    this.closeFailedCommand = this.sandbox.stub(t2, 'closeFailedCommand');

    var resolved = Promise.resolve('');
    this.sandbox.stub(Preferences, 'read').returns(resolved);

    t2(['restart']);

    resolved.then(() => {
      test.equal(this.closeFailedCommand.lastCall.args[0], 'Cannot determine entry point file name');
      test.done();
    });
  },

  entryPointFallbackNoPreviousUndefined: function(test) {
    test.expect(1);

    this.closeFailedCommand.restore();
    this.closeFailedCommand = this.sandbox.stub(t2, 'closeFailedCommand');

    var resolved = Promise.resolve(undefined);
    this.sandbox.stub(Preferences, 'read').returns(resolved);

    t2(['restart']);

    resolved.then(() => {
      test.equal(this.closeFailedCommand.lastCall.args[0], 'Cannot determine entry point file name');
      test.done();
    });
  },

};

exports['Tessel (t2: update)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.error = this.sandbox.stub(log, 'error');
    this.warn = this.sandbox.stub(log, 'warn');
    this.printAvailableUpdates = this.sandbox.stub(controller, 'printAvailableUpdates').returns(Promise.resolve());
    this.update = this.sandbox.stub(controller, 'update').returns(Promise.resolve());
    this.closeFailedCommand = this.sandbox.spy(t2, 'closeFailedCommand');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  optsForwarding: function(test) {
    test.expect(4);

    t2(['update', '--version', '42']);
    test.equal(this.update.callCount, 1);
    test.deepEqual(this.update.lastCall.args[0], {
      0: 'update',
      version: 42,
      _: ['update'],
      timeout: 5,
      lanPrefer: false,
      output: true,
      loglevel: 'basic',
    });

    t2(['update', '--list']);
    // controller.update is not called for --list,
    // so callCount remains 1
    test.equal(this.update.callCount, 1);
    test.equal(this.printAvailableUpdates.callCount, 1);

    // We must wait for the command to complete
    // or else the sandbox will be cleared to early
    setImmediate(test.done);
  },

  noError: function(test) {
    test.expect(1);

    t2(['update']);

    test.equal(this.update.callCount, 1);

    // We must wait for the command to complete
    // or else the sandbox will be cleared to early
    setImmediate(test.done);
  },

  exitCodeOne: function(test) {
    test.expect(4);

    var error = new Error('Some error happened.');
    var updateOp = Promise.reject(error);

    this.update.returns(updateOp);

    t2(['update']);

    updateOp.catch(() => {
      test.equal(this.update.callCount, 1);
      test.equal(this.closeFailedCommand.callCount, 1);
      test.equal(this.closeFailedCommand.lastCall.args[0], error);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    });
  },
};

exports['Tessel (t2: provision)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.error = this.sandbox.stub(log, 'error');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.provisionTessel = this.sandbox.stub(controller, 'provisionTessel').returns(Promise.resolve());
    this.closeFailedCommand = this.sandbox.spy(t2, 'closeFailedCommand');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noError: function(test) {
    test.expect(1);

    t2(['provision']);

    test.equal(this.provisionTessel.callCount, 1);

    // We must wait for the command to complete
    // or else the sandbox will be cleared to early
    setImmediate(test.done);
  },

  exitCodeOne: function(test) {
    test.expect(4);

    var error = new Error('Some error happened.');
    var provisionOp = Promise.reject(error);

    this.provisionTessel.returns(provisionOp);

    t2(['provision']);

    provisionOp.catch(() => {
      test.equal(this.provisionTessel.callCount, 1);
      test.equal(this.closeFailedCommand.callCount, 1);
      test.equal(this.closeFailedCommand.lastCall.args[0], error);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    });
  },

};

exports['Tessel (t2: wifi)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.printAvailableNetworks = this.sandbox.stub(controller, 'printAvailableNetworks').returns(Promise.resolve());
    this.connectToNetwork = this.sandbox.stub(controller, 'connectToNetwork').returns(Promise.resolve());
    this.getWifiInfo = this.sandbox.stub(controller, 'getWifiInfo').returns(Promise.resolve());
    this.successfulCommand = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    this.failedCommand = this.sandbox.stub(t2, 'closeFailedCommand');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noOpts: function(test) {
    test.expect(3);
    t2(['wifi']);
    // We should not call either of these functions if no args were passed
    test.equal(this.printAvailableNetworks.callCount, 0);
    test.equal(this.connectToNetwork.callCount, 0);
    // It should call the getWiFiInfo function
    test.equal(this.getWifiInfo.callCount, 1);
    test.done();
  },

  listNoError: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.printAvailableNetworks.returns(resolve);

    t2(['wifi', '--list']);

    resolve.then(() => {
      test.equal(this.successfulCommand.callCount, 1);
      test.done();
    });
  },

  listErrorExitCodeOne: function(test) {
    test.expect(1);

    var reject = Promise.reject();
    this.printAvailableNetworks.returns(reject);

    t2(['wifi', '--list']);

    reject.catch(() => {
      throw 'Without this, the catch in the test is invoked before the catch in the cli program.';
    }).catch(() => {
      test.equal(this.failedCommand.callCount, 1);
      test.done();
    });
  },

  ssidPassNoError: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.connectToNetwork.returns(resolve);

    t2(['wifi', '--ssid', 'a', '--password', 'b']);

    resolve.then(() => {
      test.equal(this.successfulCommand.callCount, 1);
      test.done();
    });
  },

  ssidPassErrorExitCodeOne: function(test) {
    test.expect(1);

    var reject = Promise.reject();
    this.connectToNetwork.returns(reject);

    t2(['wifi', '--ssid', 'a', '--password', 'b']);

    reject.catch(() => {
      throw 'Without this, the catch in the test is invoked before the catch in the cli program.';
    }).catch(() => {
      test.equal(this.failedCommand.callCount, 1);
      test.done();
    });
  },
};

exports['Tessel (t2: root)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.root = this.sandbox.stub(controller, 'root').returns(Promise.resolve());
    this.successfulCommand = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  callThrough: function(test) {
    test.expect(2);

    var resolve = Promise.resolve();
    this.root.returns(resolve);

    t2(['root']);

    resolve.then(() => {
      test.equal(this.root.callCount, 1);
      test.equal(this.successfulCommand.callCount, 1);
      test.done();
    });
  },

};

exports['Tessel (t2: run)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.deploy = this.sandbox.stub(controller, 'deploy').returns(Promise.resolve());
    this.successfulCommand = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  defaultOptions: function(test) {
    test.expect(6);

    t2(['run', 'index.js']);

    test.equal(this.deploy.callCount, 1);

    var args = this.deploy.lastCall.args[0];

    // These represent the minimum required properties
    // and default values for `t2 run index.js`
    test.equal(args.slim, true);
    test.equal(args.lanPrefer, false);
    test.equal(args.full, false);
    test.equal(args.push, false);
    test.ok(!args.rustcc);


    setImmediate(test.done);
  },

  fullSetTrue_slimOverriddenLater: function(test) {
    test.expect(5);

    t2(['run', 'index.js', '--full=true']);

    test.equal(this.deploy.callCount, 1);

    var args = this.deploy.lastCall.args[0];

    // opts.full will override opts.slim in `tarBundle`
    // (See test/unit/deploy.js)
    test.equal(args.full, true);
    test.equal(args.slim, true);
    test.equal(args.lanPrefer, false);

    test.ok(!args.push);

    setImmediate(test.done);
  },
};

exports['Tessel (t2: push)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.deploy = this.sandbox.stub(controller, 'deploy').returns(Promise.resolve());
    this.successfulCommand = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  defaultOptions: function(test) {
    test.expect(6);

    t2(['push', 'index.js']);

    test.equal(this.deploy.callCount, 1);

    var args = this.deploy.lastCall.args[0];

    // These represent the minimum required properties
    // and default values for `t2 push index.js`
    test.ok(args.lanPrefer);
    test.ok(args.slim);
    test.ok(args.push);

    test.ok(!args.full);
    test.ok(!args.rustcc);

    setImmediate(test.done);
  },

  fullSetTrue_slimOverriddenLater: function(test) {
    test.expect(5);

    t2(['push', 'index.js', '--full=true']);

    test.equal(this.deploy.callCount, 1);

    var args = this.deploy.lastCall.args[0];

    // opts.full will override opts.slim in `tarBundle`
    // (See test/unit/deploy.js)
    test.ok(args.full);
    test.ok(args.lanPrefer);
    test.ok(args.push);
    test.ok(args.slim);

    setImmediate(test.done);
  },
};

exports['Tessel (t2: list)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.controllerList = this.sandbox.spy(controller, 'listTessels');
    this.tesselList = this.sandbox.stub(Tessel, 'list').returns(Promise.resolve());
    this.setDefaultKey = this.sandbox.spy(provision, 'setDefaultKey');
    this.processExit = this.sandbox.stub(process, 'exit');
    this.closeSuccessful = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    this.closeFailed = this.sandbox.stub(t2, 'closeFailedCommand');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  listStandard: function(test) {

    test.expect(4);

    t2(['list', '--timeout', '0.001']);

    setImmediate(() => {
      // Ensure controller list was called
      test.ok(this.controllerList.calledOnce);
      // Ensure it did not have a key option
      test.ok(this.controllerList.lastCall.args[0].key === undefined);
      // We should not try to set the keypath if not specifically requested
      test.ok(!this.setDefaultKey.called);
      // Tessel list should have been called afterwards
      test.ok(this.tesselList.called);
      test.done();
    });
  },

  listKey: function(test) {

    test.expect(4);

    var keyPath = './FAKE_KEY';

    t2(['list', '--timeout', '0.001', '-i', keyPath]);

    setImmediate(() => {
      // Restore our func so other tests pass
      // Ensure list was called
      test.ok(this.controllerList.calledOnce);
      // It was called with the keypath
      test.ok(this.controllerList.lastCall.args[0].key === keyPath);
      // We did try to set the key path
      test.ok(this.setDefaultKey.called);
      // It was called with the key path
      test.ok(this.setDefaultKey.lastCall.args[0] === keyPath);
      test.done();
    });
  }
};

exports['closeFailedCommand'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.error = this.sandbox.stub(log, 'error');
    this.warn = this.sandbox.stub(log, 'warn');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  warningJustAString: function(test) {
    test.expect(3);

    t2.closeFailedCommand('a string');

    test.equal(this.warn.callCount, 1);
    test.equal(this.warn.lastCall.args[0], 'a string');
    test.equal(this.processExit.callCount, 1);

    test.done();
  },

  errorIsAnErrorObject: function(test) {
    test.expect(3);
    var error = new Error('for real');

    t2.closeFailedCommand(error);

    test.equal(this.error.callCount, 1);
    test.equal(this.error.lastCall.args[0], error.toString());
    test.equal(this.processExit.callCount, 1);

    test.done();
  },

  errorCode: function(test) {
    test.expect(4);
    var error = new Error('for real');

    error.code = 'red';

    t2.closeFailedCommand(error);

    test.equal(this.error.callCount, 1);
    test.equal(this.error.lastCall.args[0], error.toString());
    test.equal(this.processExit.callCount, 1);
    test.equal(this.processExit.lastCall.args[0], 'red');

    test.done();
  },

  errorCodeInOptions: function(test) {
    test.expect(4);
    var error = new Error('for real');
    t2.closeFailedCommand(error, {
      code: 'red'
    });

    test.equal(this.error.callCount, 1);
    test.equal(this.error.lastCall.args[0], error.toString());
    test.equal(this.processExit.callCount, 1);
    test.equal(this.processExit.lastCall.args[0], 'red');

    test.done();
  },
};

exports['--output true/false'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    // console.error is used by the underlying log.info/error/warn calls
    this.info = this.sandbox.stub(log, 'info');
    this.error = this.sandbox.stub(log, 'error');
    this.controllerList = this.sandbox.spy(controller, 'listTessels');
    this.tesselList = this.sandbox.stub(Tessel, 'list', () => {
      // Simulating what actually happens in Tessel.list
      // without the complexity of mocking a seeker
      log.info('Searching for devices...');
      return Promise.reject('No devices found...');
    });
    this.outputHelper = this.sandbox.spy(controller, 'outputHelper');
    this.processExit = this.sandbox.stub(process, 'exit');
    this.closeSuccessful = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    this.closeFailed = this.sandbox.stub(t2, 'closeFailedCommand');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  defaultOutputTrue: function(test) {
    test.expect(5);

    t2(['list', '--timeout', '0.001']);

    setImmediate(() => {
      // Ensure list was called
      test.ok(this.controllerList.calledOnce);
      // We did try to set the output
      test.ok(this.outputHelper.calledOnce);
      // It was called proper flag (default is true)
      test.ok(this.outputHelper.lastCall.args[0].output === true);
      // Ensure we called Tessel List
      test.ok(this.tesselList.calledOnce);
      // log was called once at the start to indicate we're searching
      test.equal(this.info.callCount, 1);
      test.done();
    });
  },

  outputFalse: function(test) {
    test.expect(5);

    t2(['list', '--timeout', '0.001', '--output=false']);

    setImmediate(() => {
      // Restore our func so other tests pass
      // Ensure list was called
      test.ok(this.controllerList.calledOnce);
      // We did try to set the output
      test.ok(this.outputHelper.calledOnce);
      // It was called proper flag (default is true)
      test.ok(this.outputHelper.lastCall.args[0].output === false);
      // Ensure we called Tessel List
      test.ok(this.tesselList.calledOnce);
      // log was never called because we disabled it
      test.equal(this.error.callCount, 0);
      test.done();
    });
  },
};


exports['Tessel (t2: crash-reporter)'] = {

  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.closeSuccessful = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    this.closeFailed = this.sandbox.stub(t2, 'closeFailedCommand');

    this.crOn = this.sandbox.stub(CrashReporter, 'on').returns(Promise.resolve());
    this.crOff = this.sandbox.stub(CrashReporter, 'off').returns(Promise.resolve());
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());
    this.crStatus = this.sandbox.stub(CrashReporter, 'status').returns(Promise.resolve());
    this.crSubmit = this.sandbox.stub(CrashReporter, 'submit').returns(Promise.resolve());
    this.crTest = this.sandbox.stub(CrashReporter, 'test').returns(Promise.resolve());

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  callThroughNoOptions: function(test) {
    test.expect(4);

    var resolve = Promise.resolve();
    this.crStatus.restore();
    this.crStatus = this.sandbox.stub(CrashReporter, 'status').returns(resolve);

    t2(['crash-reporter']);

    test.equal(this.crOn.callCount, 0);
    test.equal(this.crOff.callCount, 0);
    test.equal(this.crTest.callCount, 0);

    resolve.then(() => {
      test.equal(this.crStatus.callCount, 1);
      test.done();
    });
  },

  on: function(test) {
    test.expect(4);

    t2(['crash-reporter', '--on=true']);

    test.equal(this.crOn.callCount, 1);
    test.equal(this.crOff.callCount, 0);
    test.equal(this.crTest.callCount, 0);
    test.equal(this.crStatus.callCount, 0);

    test.done();
  },

  off: function(test) {
    test.expect(4);

    t2(['crash-reporter', '--off=true']);

    test.equal(this.crOn.callCount, 0);
    test.equal(this.crOff.callCount, 1);
    test.equal(this.crTest.callCount, 0);
    test.equal(this.crStatus.callCount, 0);

    test.done();
  },

  test: function(test) {
    test.expect(4);

    var resolve = Promise.resolve();
    this.crTest.restore();
    this.crTest = this.sandbox.stub(CrashReporter, 'test').returns(resolve);

    t2(['crash-reporter', '--test=true']);

    test.equal(this.crOn.callCount, 0);
    test.equal(this.crOff.callCount, 0);
    test.equal(this.crStatus.callCount, 0);

    resolve.then(() => {
      test.equal(this.crTest.callCount, 1);
      test.done();
    });
  },

  onAndTest: function(test) {
    test.expect(4);

    var resolve = Promise.resolve();
    this.crOn.restore();
    this.crOn = this.sandbox.stub(CrashReporter, 'on').returns(resolve);

    t2(['crash-reporter', '--on', '--test']);

    resolve.then(() => {
      test.equal(this.crOn.callCount, 1);
      test.equal(this.crOff.callCount, 0);
      test.equal(this.crTest.callCount, 1);
      test.equal(this.crStatus.callCount, 0);

      test.done();
    });
  },

  onNoTestThrough: function(test) {
    test.expect(4);

    var resolve = Promise.resolve();
    this.crOn.restore();
    this.crOn = this.sandbox.stub(CrashReporter, 'on').returns(resolve);

    t2(['crash-reporter', '--on']);

    resolve.then(() => {
      test.equal(this.crOn.callCount, 1);
      test.equal(this.crOff.callCount, 0);
      test.equal(this.crTest.callCount, 0);
      test.equal(this.crStatus.callCount, 1);

      test.done();
    });
  },

  unsuccessful: function(test) {
    test.expect(4);

    var resolve = Promise.resolve();
    this.crOn.restore();
    this.crOn = this.sandbox.stub(CrashReporter, 'on').returns(resolve);

    t2(['crash-reporter', '--on']);

    resolve.then(() => {
      test.equal(this.crOn.callCount, 1);
      test.equal(this.crOff.callCount, 0);
      test.equal(this.crTest.callCount, 0);
      test.equal(this.crStatus.callCount, 1);
      test.done();
    });
  },
};

exports['Tessel (init)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.successfulCommand = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    this.failedCommand = this.sandbox.stub(t2, 'closeFailedCommand');
    this.resolveLanguage = this.sandbox.spy(init, 'resolveLanguage');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  'defaults to --lang=js': function(test) {
    test.expect(3);

    var resolve = Promise.resolve();
    this.createNewProject = this.sandbox.stub(controller, 'createNewProject').returns(resolve);

    t2(['init']);

    resolve.then(() => {
      // Infers that the stub above called and not the actual createNewProject
      test.equal(this.resolveLanguage.callCount, 0);
      test.equal(this.createNewProject.callCount, 1);
      test.equal(this.createNewProject.lastCall.args[0].lang, 'js');
      test.done();
    });
  },

  'explicit --lang=js': function(test) {
    test.expect(3);

    var resolve = Promise.resolve();
    this.createNewProject = this.sandbox.stub(controller, 'createNewProject').returns(resolve);

    t2(['init', '--lang=js']);

    resolve.then(() => {
      // Infers that the stub above called and not the actual createNewProject
      test.equal(this.resolveLanguage.callCount, 0);
      test.equal(this.createNewProject.callCount, 1);
      test.equal(this.createNewProject.lastCall.args[0].lang, 'js');
      test.done();
    });
  },
  'explicit --lang=javascript': function(test) {
    test.expect(3);

    var resolve = Promise.resolve();
    this.createNewProject = this.sandbox.stub(controller, 'createNewProject').returns(resolve);

    t2(['init', '--lang=javascript']);

    resolve.then(() => {
      // Infers that the stub above called and not the actual createNewProject
      test.equal(this.resolveLanguage.callCount, 0);
      test.equal(this.createNewProject.callCount, 1);
      test.equal(this.createNewProject.lastCall.args[0].lang, 'javascript');
      test.done();
    });
  },
  'explicit --lang=rs': function(test) {
    test.expect(3);

    var resolve = Promise.resolve();
    this.createNewProject = this.sandbox.stub(controller, 'createNewProject').returns(resolve);

    t2(['init', '--lang=rs']);

    resolve.then(() => {
      // Infers that the stub above called and not the actual createNewProject
      test.equal(this.resolveLanguage.callCount, 0);
      test.equal(this.createNewProject.callCount, 1);
      test.equal(this.createNewProject.lastCall.args[0].lang, 'rs');
      test.done();
    });
  },
  'explicit --lang=rust': function(test) {
    test.expect(3);

    var resolve = Promise.resolve();
    this.createNewProject = this.sandbox.stub(controller, 'createNewProject').returns(resolve);

    t2(['init', '--lang=rust']);

    resolve.then(() => {
      // Infers that the stub above called and not the actual createNewProject
      test.equal(this.resolveLanguage.callCount, 0);
      test.equal(this.createNewProject.callCount, 1);
      test.equal(this.createNewProject.lastCall.args[0].lang, 'rust');
      test.done();
    });
  },
};


exports['Tessel (t2: installer-*)'] = {

  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.closeSuccessful = this.sandbox.stub(t2, 'closeSuccessfulCommand');
    this.closeFailed = this.sandbox.stub(t2, 'closeFailedCommand');

    this.drivers = this.sandbox.stub(installer, 'drivers').returns(Promise.resolve());
    this.homedir = this.sandbox.stub(installer, 'homedir').returns(Promise.resolve());
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  npmScriptPostinstall: function(test) {
    test.expect(1);

    test.equal(
      cliPackageJson.scripts.postinstall,
      't2 install drivers --loglevel=error || true; t2 install homedir --loglevel=error || true;'
    );

    test.done();
  },

  callThroughNoOptions: function(test) {
    test.expect(8);

    var dresolve = Promise.resolve();
    var hresolve = Promise.resolve();

    this.drivers.restore();
    this.homedir.restore();

    this.drivers = this.sandbox.stub(installer, 'drivers').returns(dresolve);
    this.homedir = this.sandbox.stub(installer, 'homedir').returns(hresolve);

    t2(['install', 'drivers']);
    t2(['install', 'homedir']);

    test.equal(this.drivers.callCount, 1);
    test.equal(this.homedir.callCount, 1);

    Promise.all([dresolve, hresolve]).then(() => {
      test.equal(this.drivers.callCount, 1);
      test.equal(this.homedir.callCount, 1);

      test.equal(this.drivers.lastCall.args[0][0], 'install');
      test.equal(this.homedir.lastCall.args[0][0], 'install');

      test.equal(this.drivers.lastCall.args[0].operation, 'drivers');
      test.equal(this.homedir.lastCall.args[0].operation, 'homedir');

      test.done();
    });
  },
};

exports['Tessel (t2: [subargs])'] = {

  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.parse = this.sandbox.stub(t2.nomnom, 'parse');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    t2.nomnom.subargs = undefined;
    done();
  },

  emptyNoWhitespace: function(test) {
    test.expect(3);

    // t2 run foo.js []
    t2(['run', 'foo.js', '[]']);

    test.equal(this.parse.callCount, 1);
    test.deepEqual(this.parse.lastCall.args[0], ['run', 'foo.js']);
    test.deepEqual(t2.nomnom.subargs, []);
    test.done();
  },

  emptyWithWhitespace: function(test) {
    test.expect(3);

    // t2 run foo.js [ ]
    t2(['run', 'foo.js', '[ ]']);

    test.equal(this.parse.callCount, 1);
    test.deepEqual(this.parse.lastCall.args[0], ['run', 'foo.js']);
    test.deepEqual(t2.nomnom.subargs, []);
    test.done();
  },

  emptySingleNoWhitespace: function(test) {
    test.expect(3);

    // t2 run foo.js [0]
    t2(['run', 'foo.js', '[0]']);

    test.equal(this.parse.callCount, 1);
    test.deepEqual(this.parse.lastCall.args[0], ['run', 'foo.js']);
    test.deepEqual(t2.nomnom.subargs, ['0']);
    test.done();
  },

  emptySingleWithWhitespace: function(test) {
    test.expect(3);

    // t2 run foo.js [0 ]
    t2(['run', 'foo.js', '[0', ']']);

    test.equal(this.parse.callCount, 1);
    test.deepEqual(this.parse.lastCall.args[0], ['run', 'foo.js']);
    test.deepEqual(t2.nomnom.subargs, ['0']);
    test.done();
  },

  emptyMultipleWithWhitespace: function(test) {
    test.expect(3);

    // t2 run foo.js [0 0  0    0]
    t2(['run', 'foo.js', '[0', '0', '0', '0]']);

    test.equal(this.parse.callCount, 1);
    test.deepEqual(this.parse.lastCall.args[0], ['run', 'foo.js']);
    test.deepEqual(t2.nomnom.subargs, ['0', '0', '0', '0']);
    test.done();
  },

  emptyMultipleMixed: function(test) {
    test.expect(3);

    // t2 run foo.js [--foo=bar   0 x y z   --a true 1  2 3 ]
    t2(['run', 'foo.js', '[--foo=bar', '0', 'x', 'y', 'z', '--a', 'true', '1', '2', '3', ']']);

    test.equal(this.parse.callCount, 1);
    test.deepEqual(this.parse.lastCall.args[0], ['run', 'foo.js']);
    test.deepEqual(
      t2.nomnom.subargs, ['--foo=bar', '0', 'x', 'y', 'z', '--a', 'true', '1', '2', '3']
    );
    test.done();
  },
};
