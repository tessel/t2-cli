var Emitter = require('events').EventEmitter;
var sinon = require('sinon');
var usb = require('../../lib/usb_connection');
var lan = require('../../lib/lan_connection');
var TesselSeeker = require('../../lib/discover').TesselSeeker;


function FakeScanner() {
  Emitter.call(this);
}

FakeScanner.prototype = Object.create(Emitter.prototype, {
  constructor: {
    value: FakeScanner
  }
});

FakeScanner.prototype.stop = function() {};


exports['TesselSeeker'] = {
  setUp: function(done) {
    this.seeker = new TesselSeeker();

    done();
  },

  tearDown: function(done) {
    done();
  },

  initialization: function(test) {
    test.expect(2);

    test.equal(this.lanScan, undefined);
    test.equal(this.usbScan, undefined);
    test.done();
  },
};

exports['TesselSeeker.prototype.start'] = {
  setUp: function(done) {
    this.usbStartScan = sinon.stub(usb, 'startScan', function() {
      return new FakeScanner();
    });
    this.lanStartScan = sinon.stub(lan, 'startScan', function() {
      return new FakeScanner();
    });

    this.seeker = new TesselSeeker();

    done();
  },

  tearDown: function(done) {
    this.usbStartScan.restore();
    this.lanStartScan.restore();
    done();
  },

  start: function(test) {
    test.expect(3);

    test.equal(this.seeker.start(), this.seeker);

    test.equal(this.usbStartScan.callCount, 1);
    test.equal(this.lanStartScan.callCount, 1);

    test.done();
  },
};


exports['TesselSeeker.prototype.stop'] = {
  setUp: function(done) {
    this.stop = sinon.spy(FakeScanner.prototype, 'stop');

    this.usbStartScan = sinon.stub(usb, 'startScan', function() {
      return new FakeScanner();
    });
    this.lanStartScan = sinon.stub(lan, 'startScan', function() {
      return new FakeScanner();
    });
    this.seeker = new TesselSeeker();

    done();
  },

  tearDown: function(done) {
    this.stop.restore();
    this.usbStartScan.restore();
    this.lanStartScan.restore();
    done();
  },

  stop: function(test) {
    test.expect(1);
    test.equal(this.seeker.stop(), this.seeker);
    test.done();
  },

  stopAfterStart: function(test) {
    test.expect(1);

    this.seeker.start();
    this.seeker.stop();

    // Both active scanners called stop
    test.equal(this.stop.callCount, 2);

    test.done();
  },

  stopDuplicateCall: function(test) {
    test.expect(2);

    this.seeker.start();
    this.seeker.stop();

    // Both active scanners called stop
    test.equal(this.stop.callCount, 2);

    // Duplicate call
    this.seeker.stop();

    // Call count remains 2
    test.equal(this.stop.callCount, 2);

    test.done();
  },

  stopOnlyUsb: function(test) {
    test.expect(1);

    this.seeker.start();

    this.seeker.lanScan = undefined;

    this.seeker.stop();

    test.equal(this.stop.callCount, 1);

    test.done();
  },

  stopOnlyLan: function(test) {
    test.expect(1);

    this.seeker.start();

    this.seeker.usbScan = undefined;

    this.seeker.stop();

    test.equal(this.stop.callCount, 1);

    test.done();
  },
};
