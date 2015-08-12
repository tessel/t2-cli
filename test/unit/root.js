// unit test t2 root command
var sinon = require('sinon');
//var _ = require('lodash');
var controller = require('../../lib/controller');
var Tessel = require('../../lib/tessel/tessel');
var Seeker = require('../../lib/discover.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var logs = require('../../lib/logs');

// template for creating fake tessels
function createFakeTessel(options) {
  var tessel = new Tessel({
    connectionType: options.type || 'LAN',
    authorized: options.authorized !== undefined ? options.authorized : true,
    end: function() {
      // returns a value, promize or thenable
      return Promise.resolve();
      // https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
    }

  });

  function serialNumber(options) {
    if (options.type === 'USB') {
      return options.serialNumber;
    } else {
      return false;
    }
  }
  tessel.serialNumber = serialNumber(options);
  tessel.name = options.name || 'a';

  options.sandbox.stub(tessel, 'close', function() {
    return Promise.resolve();
  });
  // return the fake tessel
  return tessel;
}


exports['Tessel.seekTessels'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(Seeker, 'TesselSeeker', function Seeker() {
      this.start = function() {
        self.activeSeeker = this;
        return this;
      };
      this.stop = function() {
        return this;
      };
    });
    // copy the seeker events into the EventEmitter

    util.inherits(this.seeker, EventEmitter);

    // setting up fake system for logging
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});


    this.closeTesselConnections = this.sandbox.spy(controller, 'closeTesselConnections');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  // Test is based on structure of controller.js Tessel.list tests (but documented!)
  oneAuthorizedLANTessel: function(test) {
    test.expect(3);
    var a = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });
    Tessel.seekTessels({
      timeout: 0.01
    }).then(function() {
      // it is a authorized tessel, so the test connection while seeking is closes once
      test.equal(this.closeTesselConnections.callCount, 1);
      // TODO: if tessels have multiple connections at once, this doesn't work anymore!
      // test whether the Tessel is unauthorized
      test.equal(a.connections[0].authorized, true);
      // because we do not runHeuristics callCount is expected to be 0
      test.equal(a.close.callCount, 0);
      a = null;
      test.done();
    }.bind(this));

    // simulate a LAN-Tessel is discovered 
    this.activeSeeker.emit('tessel', a);
  },
  oneNotAuthorizedLANTessel: function(test) {
    test.expect(3);
    var a = createFakeTessel({
      sandbox: this.sandbox,
      authorized: false,
      type: 'LAN'
    });
    Tessel.seekTessels({
      timeout: 0.01
    }).then(function() {
      // a not authorized Tessel also close connections (connection is not a ssh login!)
      test.equal(this.closeTesselConnections.callCount, 1);
      // TODO: if tessels have multiple connections at once, this doesn't work anymore!
      // test whether the Tessel is unauthorized
      test.equal(a.connections[0].authorized, false);
      // because we do not runHeuristics callCount is expected to be 0
      test.equal(a.close.callCount, 0);
      test.done();
    }.bind(this));

    // simulate a LAN-Tessel is discovered 
    this.activeSeeker.emit('tessel', a);
  },
  oneTesselTwoConnections: function(test) {
    test.expect(5);

    var a = createFakeTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'sameTessel',
      serialNumber: '080027F00626'
    });

    var lan = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'sameTessel'
    });


    Tessel.seekTessels({
        timeout: 0.01
      })
      .then(function() {

        // discover.js handles both connection types by tessel.connection.open
        // lan_connection.js is trying to do a ssh connection and sets authorized to false or true
        // usb_connection.js register this connection with daemon to keeps track of active remote processes
        // and adds a serialNumber what is simulated by the fakeTessel if USB

        // the second is the lan connection what is authorized
        test.equal(a.connections[1].authorized, true);
        // the two instead one connection causes in two seeked interfaces of the same tessel
        test.equal(this.closeTesselConnections.callCount, 2);

        // one tessel with two connections has to have two connection objects
        test.equal(a.connections.length, 2);
        // because we do not runHeuristics callCount is expected to be 0
        test.equal(a.close.callCount, 0);
        // because we do not runHeuristics callCount is expected to be 0
        test.equal(lan.close.callCount, 0);

        // TODO: Because of the connections object of sameTessel isn't conjunct already this test has to be rewritten later 
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
    this.activeSeeker.emit('tessel', lan);

    // TODO: here it needs to be one object with multiple connections !!
    a.connections.push(lan.connections[0]);

  },
  multipeDifferentTessels: function(test) {
    test.expect(6);

    var usb = createFakeTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'dannyLanded',
      serialNumber: '080027F00626'
    });

    var lan = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN',
      name: 'dannyFlying'
    });


    Tessel.seekTessels({
        timeout: 0.01
      })
      .then(function() {
        test.equal(lan.connections[0].authorized, true);
        test.equal(usb.serialNumber, '080027F00626');
        test.equal(this.closeTesselConnections.callCount, 2);

        test.equal(usb.connections.length, 1);
        // because we do not runHeuristics callCount is expected to be 0
        test.equal(usb.close.callCount, 0);
        // because we do not runHeuristics callCount is expected to be 0
        test.equal(lan.close.callCount, 0);

        // TODO: Because of the connections object of sameTessel isn't conjunct already this test has to be rewritten later 
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);

    // TODO: here it needs to be one object with multiple connections !!

  },
};

exports['controller.root'] = {

  setUp: function(done) {
    //var self = this;
    // creating fake methods
    this.sandbox = sinon.sandbox.create();

    //this.
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  test1: function(test) {
    test.expect(1);
    test.ok(true, 'This shouldn\'t fail');
    test.done();
  },
  test2: function(test) {
    test.expect(1);
    test.ok(1 === 1, 'This shouldn\'t fail');
    // test.ok(false, 'This should fail');
    test.done();
  }
};
// t2 root --help

// t2 root # only one tessel (authorized)

// t2 root # only one tessel (not authorized)

// t2 root # no tessel found

// t2 root # two tessels (authorized)

// t2 root # two tessels (not authorized)

// t2 root # invalid id_rsa for authorized tessel ! (froud prevention)

// t2 root # Accessing root...

// t2 root --help # Usage: tessel root [-i <path>] [--help]

// TODO: adding USB tests !

// TODO: running tests on Windows 7 and try catch ssh exists
