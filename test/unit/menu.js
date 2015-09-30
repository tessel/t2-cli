var sinon = require('sinon');
var controller = require('../../lib/controller');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');

exports['controller.menu.create'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.sandbox.spy(controller.menu, 'create');
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  createMenu: function(test) {
    test.expect(2);
    var a = new TesselSimulator({
      type: 'LAN',
      name: 'Tessel-123',
      authorized: true
    });
    var b = new TesselSimulator({
      type: 'LAN',
      name: 'Tessel-123',
      serialNumber: '1234'
    });
    var tessels = [];
    var opts = {};
    var title = 'My Menu';
    tessels.push(a, b);
    controller.menu.create(tessels, opts, title).then(function() {
      test.equal(controller.menu.create.called, true);
      test.equal(1, 1);
      test.done();
    }.bind(this)).catch(function(e) {
      console.log('error: ', e);
    });
  }
};
/*
exports['controller.menu.make'] = {
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
  }
};
exports['controller.menu.show'] = {
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
  }
};
exports['controller.menu.clear'] = {
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
  }
};
*/
