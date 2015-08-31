var Emitter = require('events').EventEmitter;
var sinon = require('sinon');
var usb = require('../../lib/usb_connection');
var lan = require('../../lib/lan_connection');
var TesselSeeker = require('../../lib/discover').TesselSeeker;
var TesselSimulater = require('../common/tessel-simulator');
var Tessel = require('../../lib/tessel/tessel.js');


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

  oneUnauthorizedLANPending: function(test) {
    test.expect(1);
    // Scan for new connections for one second
    var scanTime = 100;
    // Start scan
    this.seeker.start(scanTime);
    // Array to save found Tessels in
    var found = [];

    // When we get a Tessel
    this.seeker.on('tessel', function(tessel) {
      // save it
      found.push(tessel);
    });

    // When all Tessels have completed opening
    this.seeker.on('end', function() {
      // Make sure we only have the one Tessel we created
      test.equal(found.length, 1);
      test.done();
    });

    // Create a Simulated LAN Tessel (Unathorized)
    var lan = TesselSimulater('LAN');

    // Create it's open function
    lan.connection.open = function() {
      // After twice the scanning time, finally resolve
      return new Promise(function(resolve) {
        setTimeout(function() {
          return resolve();
        }, scanTime * 2);
      });
    }

    // Give it a name
    lan.connection.host = 'Tessel-Test_Subject'

    // Calculate how long half of the scan time is
    var halfScan = scanTime / 2;
    // Once half of the scan time has elapsed
    setTimeout(function() {
      // Emit a new connection
      this.seeker.lanScan.emit('connection', lan.connection);
    }.bind(this), halfScan);
  },

  oneAuthorizedLANPending: function(test) {
    test.expect(2);
    // Spy on the seeker stop
    this.seekerStop = sinon.spy(TesselSeeker.prototype, 'stop');
    // Scan for new connections for one second
    var scanTime = 100;
    // Start scan
    this.seeker.start(scanTime);
    // Array to save found Tessels in
    var found = [];

    // When we get a Tessel
    this.seeker.on('tessel', function(tessel) {
      // save it
      found.push(tessel);
    });

    // When all Tessels have completed opening
    this.seeker.on('end', function() {
      // Make sure we only have the one Tessel we created
      test.equal(found.length, 1);
      // The seeker was told to stop after the timeout ran down
      test.equal(this.seekerStop.callCount, 1);
      // Restore our stub so we can stub it again later
      this.getName.restore();
      test.done();
    }.bind(this));

    // Create a Simulated LAN Tessel (Unathorized)
    var lan = TesselSimulater('LAN');

    // Create it's open function
    lan.connection.open = function() {
      // After twice the scanning time, finally resolve
      return new Promise(function(resolve) {
        setTimeout(function() {
          return resolve();
        }, scanTime * 2);
      });
    }

    // Authorize it
    lan.connection.authorized = true;
    // Give it a name
    this.getName = sinon.stub(Tessel.prototype, 'getName', function() {
      return new Promise(function(resolve) {
        resolve('Tessel-Test_Subject')
      });
    });

    // Calculate how long half of the scan time is
    var halfScan = scanTime / 2;
    // Once half of the scan time has elapsed
    setTimeout(function() {
      // Emit a new connection
      this.seeker.lanScan.emit('connection', lan.connection);
    }.bind(this), halfScan);
  },

  oneAuthorizedLANPendingFails: function(test) {
    test.expect(1);
    // Scan for new connections for one second
    var scanTime = 100;
    // Start scan
    this.seeker.start(scanTime);
    // Array to save found Tessels in
    var found = [];

    // When we get a Tessel
    this.seeker.on('tessel', function(tessel) {
      // save it
      found.push(tessel);
    });

    // When all Tessels have completed opening
    this.seeker.on('end', function() {
      console.log('DONE')
      // Make sure we only have the one Tessel we created
      test.equal(found.length, 0);
      // Restore our stub so we can stub it again later
      this.getName.restore();
      test.done();
    }.bind(this));

    // Create a Simulated LAN Tessel (Unathorized)
    var lan = TesselSimulater('LAN');

    // Create it's open function
    lan.connection.open = function() {
      // After twice the scanning time, finally resolve
      return new Promise(function(resolve) {
        setTimeout(function() {
          return resolve();
        }, scanTime * 2);
      });
    }

    // Authorize it
    lan.connection.authorized = true;
    // Give it a name
    this.getName = sinon.stub(Tessel.prototype, 'getName', function() {
      console.log('FETCHING NAME!')
      return Promise.reject('Could not get name for some reason...');
    });

    // Calculate how long half of the scan time is
    var halfScan = scanTime/2;
    // Once half of the scan time has elapsed
    setTimeout(function() {
      // Emit a new connection
      this.seeker.lanScan.emit('connection', lan.connection);
    }.bind(this), halfScan);
  },

  // A test with multiple kinds of connections

  // A test where seeker.stop is explicitly called instead of waiting for timeout
};
