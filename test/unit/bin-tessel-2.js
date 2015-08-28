var sinon = require('sinon');
var cli = require('../../bin/tessel-2');
var controller = require('../../lib/controller');
var logs = require('../../lib/logs');


exports['Tessel (cli: restart)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(logs, 'warn');
    this.restartScript = this.sandbox.stub(controller, 'restartScript').returns(Promise.resolve());
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noError: function(test) {
    test.expect(1);

    cli(['restart']);

    test.equal(this.restartScript.callCount, 1);

    // We must wait for the command to complete
    // or else the sandbox will be cleared to early
    setImmediate(function() {
      test.done();
    });
  },

  exitCodeOne: function(test) {
    test.expect(2);

    var restartOp = Promise.reject();

    this.restartScript.returns(restartOp);

    cli(['restart']);

    restartOp.catch(function() {
      test.equal(this.restartScript.callCount, 1);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    }.bind(this));
  },

};

exports['Tessel (cli: provision)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(logs, 'warn');
    this.provisionTessel = this.sandbox.stub(controller, 'provisionTessel').returns(Promise.resolve());
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
    test.expect(2);

    var provisionOp = Promise.reject();

    this.provisionTessel.returns(provisionOp);

    cli(['provision']);

    provisionOp.catch(function() {
      test.equal(this.provisionTessel.callCount, 1);
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    }.bind(this));
  },

};

exports['Tessel (cli: wifi)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(logs, 'warn');
    this.printAvailableNetworks = this.sandbox.stub(controller, 'printAvailableNetworks').returns(Promise.resolve());
    this.connectToNetwork = this.sandbox.stub(controller, 'connectToNetwork').returns(Promise.resolve());
    this.processExit = this.sandbox.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noOpts: function(test) {
    test.expect(1);

    cli(['wifi']);

    test.equal(this.printAvailableNetworks.callCount, 0);
    test.done();
  },

  listNoError: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.printAvailableNetworks.returns(resolve);

    cli(['wifi', '--list', ' ']);

    resolve.then(function() {
      test.equal(this.processExit.lastCall.args[0], 0);
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
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    }.bind(this));
  },

  ssidPassNoError: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.connectToNetwork.returns(resolve);

    cli(['wifi', '--ssid', 'a', '--password', 'b']);

    resolve.then(function() {
      test.equal(this.processExit.lastCall.args[0], 0);
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
      test.equal(this.processExit.lastCall.args[0], 1);
      test.done();
    }.bind(this));
  },
};
