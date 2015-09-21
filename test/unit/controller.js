var sinon = require('sinon');
var _ = require('lodash');
var controller = require('../../lib/controller');
var Tessel = require('../../lib/tessel/tessel');
var Seeker = require('../../lib/discover.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var logs = require('../../lib/logs');


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


exports['Tessel.list'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(Seeker, 'TesselSeeker', function Seeker() {
      this.start = function(timeout) {
        self.activeSeeker = this;
        if (timeout && typeof timeout === 'number') {
          setTimeout(this.stop, timeout);
        }
        return this;
      };
      this.stop = function() {
        this.emit('end');
        return this;
      }.bind(this);
    });
    util.inherits(this.seeker, EventEmitter);

    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    this.closeTesselConnections = this.sandbox.spy(controller, 'closeTesselConnections');
    this.runHeuristics = this.sandbox.spy(controller, 'runHeuristics');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  oneUSBTessel: function(test) {
    test.expect(3);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    Tessel.list({
        timeout: 0.01
      })
      .then(function() {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(a.close.callCount, 1);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneLANTessel: function(test) {
    test.expect(3);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    Tessel.list({
        timeout: 0.01
      })
      .then(function() {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(a.close.callCount, 1);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneTesselTwoConnections: function(test) {
    test.expect(4);

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

    Tessel.list({
        timeout: 0.01
      })
      .then(function() {
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(usb.close.callCount, 1);
        test.equal(lan.close.callCount, 1);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);
  },

  multipleDifferentTessels: function(test) {
    test.expect(4);

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

    Tessel.list({
        timeout: 0.01
      })
      .then(function() {
        test.equal(this.runHeuristics.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(usb.close.callCount, 1);
        test.equal(lan.close.callCount, 1);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);
  },
};

exports['Tessel.get'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(Seeker, 'TesselSeeker', function Seeker() {
      this.start = function(timeout) {
        self.activeSeeker = this;
        if (timeout && typeof timeout === 'number') {
          setTimeout(this.stop, timeout);
        }
        return this;
      };
      this.stop = function() {
        this.emit('end');
        return this;
      }.bind(this);
    });
    util.inherits(this.seeker, EventEmitter);

    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    this.closeTesselConnections = this.sandbox.stub(controller, 'closeTesselConnections');
    this.reconcileTessels = this.sandbox.spy(controller, 'reconcileTessels');
    this.runHeuristics = this.sandbox.spy(controller, 'runHeuristics');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  oneNamedTessel: function(test) {
    test.expect(5);

    controller.closeTesselConnections.returns(Promise.resolve());

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'the_name'
    });

    Tessel.get({
        timeout: 0.01,
        name: 'the_name'
      })
      .then(function() {
        test.equal(this.reconcileTessels.callCount, 0);
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'the_name'), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneUnNamedTessel: function(test) {
    test.expect(5);

    controller.closeTesselConnections.returns(Promise.resolve());

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'the_name'
    });

    Tessel.get({
        timeout: 0.01
      })
      .then(function() {
        test.equal(this.reconcileTessels.callCount, 0);
        test.equal(this.runHeuristics.callCount, 0);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'the_name'), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneUnamedTesselTwoConnections: function(test) {
    test.expect(5);

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

    Tessel.get({
        timeout: 0.01
      })
      .then(function() {
        test.equal(this.reconcileTessels.callCount, 1);
        test.equal(this.runHeuristics.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'samesies'), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);
  },
};
