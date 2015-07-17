var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var Seeker = require('../../lib/discover.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var logs = require('../../lib/logs');

exports['Tessel (endConnection)'] = {
  setUp: function(done) {

    this.mockConnection = {
      end: function() {},
      close: function() {}
    };

    this.end = sinon.spy(this.mockConnection, 'end');

    done();
  },

  tearDown: function(done) {
    this.end.restore();
    done();
  },

  sigintConnection: function(test) {
    test.expect(1);

    var processOnce = sinon.stub(process, 'once');

    new Tessel(this.mockConnection);

    var endConnection = processOnce.lastCall.args[1];

    endConnection();

    test.equal(this.end.callCount, 1);

    processOnce.restore();
    test.done();
  },

  closeConnection: function(test) {
    test.expect(2);

    var processremoveListener = sinon.stub(process, 'removeListener');
    var tessel = new Tessel(this.mockConnection);

    tessel.close();

    test.equal(processremoveListener.callCount, 1);
    test.equal(this.end.callCount, 1);

    processremoveListener.restore();
    test.done();
  },
};

exports['Tessel (get)'] = {

  setUp: function(done) {
    var self = this;
    this.activeSeeker = undefined;
    this.seeker = sinon.stub(Seeker, 'TesselSeeker', function Seeker() {
      this.start = function() {
        self.activeSeeker = this;
        return this;
      };
      this.stop = function() {
        return this;
      };
    });
    util.inherits(this.seeker, EventEmitter);
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});

    done();
  },

  tearDown: function(done) {
    this.seeker.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
    done();
  },

  noTessels: function(test) {
    // Try to get Tessels but return none
    Tessel.get({
        timeout: 1
      })
      // If
      .then(function(tessels) {
        test.equal(tessels, false, 'Somehow Tessels were returned');
      })
      .catch(function(err) {
        test.equal(typeof err, 'string', 'No error thrown');
        test.done();
      });
  },

  oneUSB: function(test) {
    var testConnectionType = 'USB';
    var testName = 'testTessel';
    // Try to get Tessels but return none
    Tessel.get({
        timeout: 1
      })
      // If
      .then(function(tessel) {
        test.equal(tessel.name, testName);
        test.equal(tessel.connection.connectionType, testConnectionType);
        test.done();
      })
      .catch(function(err) {
        test.equal(err, undefined, 'A valid USB Tessel was reject upon get.');
      });

    var tessel = new Tessel({
      connectionType: testConnectionType
    });
    tessel.name = testName;
    this.activeSeeker.emit('tessel', tessel);
  },

  multipleUSB: function(test) {
    // TODO
    test.done();
  },

  usbAndNonAuthorizedLANSameTessel: function(test) {
    // TODO
    test.done();
  },

  usbAndAuthorizedLANSameTessel: function(test) {
    // TODO
    test.done();
  },

  manyLAN: function(test) {
    // TODO
    test.done();
  },

  oneUSBManyLAN: function(test) {
    // TODO
    test.done();
  },
};
