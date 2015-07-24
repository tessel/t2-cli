var sinon = require('sinon');
var cli = require('../../bin/tessel-2');
var controller = require('../../lib/controller');
var logs = require('../../lib/logs');


exports['Tessel (*: verbose flag)'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.info = this.sandbox.stub(logs, 'info');
    this.provisionTessel = this.sandbox.stub(controller, 'provisionTessel').returns(Promise.resolve());
    this.deployScript = this.sandbox.stub(controller, 'deployScript').returns(Promise.resolve());
    this.eraseScript = this.sandbox.stub(controller, 'eraseScript').returns(Promise.resolve());
    this.listTessels = this.sandbox.stub(controller, 'listTessels').returns(Promise.resolve());
    this.printAvailableNetworks = this.sandbox.stub(controller, 'printAvailableNetworks').returns(Promise.resolve());
    this.connectToNetwork = this.sandbox.stub(controller, 'connectToNetwork').returns(Promise.resolve());
    this.renameTessel = this.sandbox.stub(controller, 'renameTessel').returns(Promise.resolve());

    this.init = this.sandbox.stub(controller, 'init');
    this.processExit = this.sandbox.stub(process, 'exit');

    logs.verbose = null;

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    logs.verbose = false;
    done();
  },

  init: function(test) {
    test.expect(2);

    cli(['init', '--verbose']);
    test.equal(logs.verbose, true);

    logs.verbose = null;

    cli(['init', '-v']);
    test.equal(logs.verbose, true);

    test.done();
  },

  list: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.listTessels.returns(resolve);

    cli(['list', '--verbose']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
      test.done();
    }.bind(this));
  },

  provision: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.provisionTessel.returns(resolve);

    cli(['provision', '--verbose']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
      test.done();
    }.bind(this));
  },

  rename: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.renameTessel.returns(resolve);

    cli(['rename', '--verbose']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
      test.done();
    }.bind(this));
  },

  run: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.deployScript.returns(resolve);

    cli(['run', '--verbose']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
      test.done();
    }.bind(this));
  },

  push: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.deployScript.returns(resolve);

    cli(['push', '--verbose']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
      test.done();
    }.bind(this));
  },

  erase: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.deployScript.returns(resolve);

    cli(['erase', '--verbose']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
      test.done();
    }.bind(this));
  },

  wifiList: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.printAvailableNetworks.returns(resolve);

    cli(['wifi', '--verbose', '--list', ' ']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
      test.done();
    }.bind(this));
  },

  wifiConnect: function(test) {
    test.expect(1);

    var resolve = Promise.resolve();
    this.connectToNetwork.returns(resolve);

    cli(['wifi', '--verbose', '--ssid', 'a', '--password', 'b']);

    resolve.then(function() {
      test.equal(logs.verbose, true);
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

    // We must wait for the command too complete
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
