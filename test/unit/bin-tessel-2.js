var sinon = require('sinon');
var cli = require('../../bin/tessel-2');
var controller = require('../../lib/controller');
var logs = require('../../lib/logs');


exports['Tessel (cli: provision)'] = {
  setUp: function(done) {
    this.sinon = sinon.sandbox.create();
    this.warn = this.sinon.stub(logs, 'warn');
    this.provisionTessel = this.sinon.stub(controller, 'provisionTessel').returns(Promise.resolve());
    this.processExit = this.sinon.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sinon.restore();
    done();
  },

  noError: function(test) {
    test.expect(1);

    cli(['provision']);

    test.equal(this.provisionTessel.callCount, 1);
    test.done();
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
    this.sinon = sinon.sandbox.create();
    this.warn = this.sinon.stub(logs, 'warn');
    this.printAvailableNetworks = this.sinon.stub(controller, 'printAvailableNetworks').returns(Promise.resolve());
    this.connectToNetwork = this.sinon.stub(controller, 'connectToNetwork').returns(Promise.resolve());
    this.processExit = this.sinon.stub(process, 'exit');

    done();
  },

  tearDown: function(done) {
    this.sinon.restore();
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
