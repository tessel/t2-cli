// Test dependencies are required and exposed in common/bootstrap.js

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
    help: 'Use LAN connection',
    name: 'lan',
    string: '--lan',
  },
  usb: {
    flag: true,
    help: 'Use USB connection',
    name: 'usb',
    string: '--usb',
  },
  key: Tessel.TESSEL_AUTH_KEY
};

exports['Tessel (cli: makeCommand)'] = {
  any: function(test) {
    test.expect(16);

    cli.makeCommand('any')
      .callback(function() {
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

    cli(['any']);
  }
};

exports['Tessel (cli: restart)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.err = this.sandbox.stub(logs, 'err');
    this.warn = this.sandbox.stub(logs, 'warn');
    this.info = this.sandbox.stub(logs, 'info');
    this.restartScript = this.sandbox.stub(controller, 'restartScript').returns(Promise.resolve());
    this.closeFailedCommand = this.sandbox.spy(cli, 'closeFailedCommand');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noError: function(test) {
    test.expect(1);

    cli(['restart', '--type=ram']);

    test.equal(this.restartScript.callCount, 1);
    // We must wait for the command to complete
    // or else the sandbox will be cleared too early
    setImmediate(function() {
      test.done();
    });
  },

  exitCodeOne: function(test) {
    test.expect(4);

    var error = new Error('Some error happened.');
    var restartOp = Promise.reject(error);

    this.restartScript.returns(restartOp);

    cli(['restart', '--type=ram']);

    restartOp.catch(function() {
      test.equal(this.restartScript.callCount, 1);
      test.equal(this.closeFailedCommand.callCount, 1);
      test.equal(this.closeFailedCommand.lastCall.args[0], error);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    }.bind(this));
  },

};

exports['Tessel (cli: update)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.err = this.sandbox.stub(logs, 'err');
    this.warn = this.sandbox.stub(logs, 'warn');
    this.printAvailableUpdates = this.sandbox.stub(controller, 'printAvailableUpdates').returns(Promise.resolve());
    this.update = this.sandbox.stub(controller, 'update').returns(Promise.resolve());
    this.closeFailedCommand = this.sandbox.spy(cli, 'closeFailedCommand');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  optsForwarding: function(test) {
    test.expect(4);

    cli(['update', '--version', '42']);
    test.equal(this.update.callCount, 1);
    test.deepEqual(this.update.lastCall.args[0], {
      0: 'update',
      version: 42,
      _: ['update'],
      timeout: 5,
      key: Tessel.TESSEL_AUTH_KEY
    });

    cli(['update', '--list', ' ']);
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

    cli(['update']);

    test.equal(this.update.callCount, 1);

    // We must wait for the command to complete
    // or else the sandbox will be cleared to early
    setImmediate(function() {
      test.done();
    });
  },

  exitCodeOne: function(test) {
    test.expect(4);

    var error = new Error('Some error happened.');
    var updateOp = Promise.reject(error);

    this.update.returns(updateOp);

    cli(['update']);

    updateOp.catch(function() {
      test.equal(this.update.callCount, 1);
      test.equal(this.closeFailedCommand.callCount, 1);
      test.equal(this.closeFailedCommand.lastCall.args[0], error);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    }.bind(this));
  },
};

exports['Tessel (cli: provision)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.err = this.sandbox.stub(logs, 'err');
    this.warn = this.sandbox.stub(logs, 'warn');
    this.info = this.sandbox.stub(logs, 'info');
    this.provisionTessel = this.sandbox.stub(controller, 'provisionTessel').returns(Promise.resolve());
    this.closeFailedCommand = this.sandbox.spy(cli, 'closeFailedCommand');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noError: function(test) {
    test.expect(1);

    cli(['provision']);

    test.equal(this.provisionTessel.callCount, 1);

    // We must wait for the command to complete
    // or else the sandbox will be cleared to early
    setImmediate(function() {
      test.done();
    });
  },

  exitCodeOne: function(test) {
    test.expect(4);

    var error = new Error('Some error happened.');
    var provisionOp = Promise.reject(error);

    this.provisionTessel.returns(provisionOp);

    cli(['provision']);

    provisionOp.catch(function() {
      test.equal(this.provisionTessel.callCount, 1);
      test.equal(this.closeFailedCommand.callCount, 1);
      test.equal(this.closeFailedCommand.lastCall.args[0], error);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    }.bind(this));
  },

};

exports['Tessel (cli: wifi)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(logs, 'warn');
    this.info = this.sandbox.stub(logs, 'info');
    this.printAvailableNetworks = this.sandbox.stub(controller, 'printAvailableNetworks').returns(Promise.resolve());
    this.connectToNetwork = this.sandbox.stub(controller, 'connectToNetwork').returns(Promise.resolve());
    this.getWifiInfo = this.sandbox.stub(controller, 'getWifiInfo').returns(Promise.resolve());
    this.successfulCommand = this.sandbox.stub(cli, 'closeSuccessfulCommand');
    this.failedCommand = this.sandbox.stub(cli, 'closeFailedCommand');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noOpts: function(test) {
    test.expect(3);
    cli(['wifi']);
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

    cli(['wifi', '--list', ' ']);

    resolve.then(function() {
      test.equal(this.successfulCommand.callCount, 1);
      test.done();
    }.bind(this));
  },

  listErrorExitCodeOne: function(test) {
    test.expect(1);

    var reject = Promise.reject();
    this.printAvailableNetworks.returns(reject);

    cli(['wifi', '--list', ' ']);

    reject.catch(function() {
      throw 'Without this, the catch in the test is invoked before the catch in the cli program.';
    }).catch(function() {
      test.equal(this.failedCommand.callCount, 1);
      test.done();
    }.bind(this));
  },

  ssidPassNoError: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.connectToNetwork.returns(resolve);

    cli(['wifi', '--ssid', 'a', '--password', 'b']);

    resolve.then(function() {
      test.equal(this.successfulCommand.callCount, 1);
      test.done();
    }.bind(this));
  },

  ssidPassErrorExitCodeOne: function(test) {
    test.expect(1);

    var reject = Promise.reject();
    this.connectToNetwork.returns(reject);

    cli(['wifi', '--ssid', 'a', '--password', 'b']);

    reject.catch(function() {
      throw 'Without this, the catch in the test is invoked before the catch in the cli program.';
    }).catch(function() {
      test.equal(this.failedCommand.callCount, 1);
      test.done();
    }.bind(this));
  },
};

exports['closeFailedCommand'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.err = this.sandbox.stub(logs, 'err');
    this.warn = this.sandbox.stub(logs, 'warn');
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  warningJustAString: function(test) {
    test.expect(3);

    cli.closeFailedCommand('a string');

    test.equal(this.warn.callCount, 1);
    test.equal(this.warn.lastCall.args[0], 'a string');
    test.equal(this.processExit.callCount, 1);

    test.done();
  },

  errorIsAnErrorObject: function(test) {
    test.expect(3);
    var error = new Error('for real');

    cli.closeFailedCommand(error);

    test.equal(this.err.callCount, 1);
    test.equal(this.err.lastCall.args[0], error.toString());
    test.equal(this.processExit.callCount, 1);

    test.done();
  },

  errorCode: function(test) {
    test.expect(4);
    var error = new Error('for real');

    error.code = 'red';

    cli.closeFailedCommand(error);

    test.equal(this.err.callCount, 1);
    test.equal(this.err.lastCall.args[0], error.toString());
    test.equal(this.processExit.callCount, 1);
    test.equal(this.processExit.lastCall.args[0], 'red');

    test.done();
  },

  errorCodeInOptions: function(test) {
    test.expect(4);
    var error = new Error('for real');
    cli.closeFailedCommand(error, {
      code: 'red'
    });

    test.equal(this.err.callCount, 1);
    test.equal(this.err.lastCall.args[0], error.toString());
    test.equal(this.processExit.callCount, 1);
    test.equal(this.processExit.lastCall.args[0], 'red');

    test.done();
  },
};
