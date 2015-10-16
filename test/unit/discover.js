var Emitter = require('events').EventEmitter;
var sinon = require('sinon');
var usb = require('../../lib/usb_connection');
var lan = require('../../lib/lan_connection');
var TesselSeeker = require('../../lib/discover').TesselSeeker;
var TesselSimulator = require('../common/tessel-simulator');
var Tessel = require('../../lib/tessel/tessel.js');
var logs = require('../../lib/logs');


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
    this.sandbox = sinon.sandbox.create();
    this.stop = this.sandbox.spy(FakeScanner.prototype, 'stop');

    this.usbStartScan = this.sandbox.stub(usb, 'startScan', function() {
      return new FakeScanner();
    });
    this.lanStartScan = this.sandbox.stub(lan, 'startScan', function() {
      return new FakeScanner();
    });
    this.seeker = new TesselSeeker();
    // The default amount of time to scan for connections
    this.scanTime = 100;

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  start: function(test) {
    test.expect(3);

    test.equal(this.seeker.start(), this.seeker);

    test.equal(this.usbStartScan.callCount, 1);
    test.equal(this.lanStartScan.callCount, 1);

    test.done();
  },

  onlyFindUSBConnectionNoAlternative: function(test) {
    test.expect(2);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime,
      usb: true
    };

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return Promise.resolve('Frank');
    });

    // Start scan
    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then(function(found) {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 1);
        test.equal(found[0].connection.connectionType, 'USB');
        test.done();
      }.bind(this));

    var usb = TesselSimulator({
      type: 'USB'
    });

    // Make the open function resolve immediately
    usb.connection.open = function() {
      return Promise.resolve();
    };

    // Emit the connections immediately
    if (this.seeker.usbScan) {
      this.seeker.usbScan.emit('connection', usb.connection);
    }
  },
};


exports['TesselSeeker.prototype.stop'] = {
  setUp: function(done) {

    this.sandbox = sinon.sandbox.create();

    this.stop = this.sandbox.spy(FakeScanner.prototype, 'stop');

    this.usbStartScan = this.sandbox.stub(usb, 'startScan', function() {
      return new FakeScanner();
    });
    this.lanStartScan = this.sandbox.stub(lan, 'startScan', function() {
      return new FakeScanner();
    });
    this.seeker = new TesselSeeker();

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
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
  }
};

exports['TesselSeeker Scan Time'] = {
  setUp: function(done) {

    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'err', function() {});

    this.stop = this.sandbox.spy(FakeScanner.prototype, 'stop');

    this.usbStartScan = this.sandbox.stub(usb, 'startScan', function() {
      return new FakeScanner();
    });
    this.lanStartScan = this.sandbox.stub(lan, 'startScan', function() {
      return new FakeScanner();
    });
    this.seeker = new TesselSeeker();
    // The default amount of time to scan for connections
    this.scanTime = 100;

    done();
  },

  tearDown: function(done) {
    // Remove sigint listeners once we finish with the Tessels
    process.removeAllListeners('SIGINT');
    this.sandbox.restore();
    done();
  },

  oneUnauthorizedLANPending: function(test) {
    test.expect(1);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then(function(found) {
        // Make sure we only have the one Tessel we created
        test.equal(found.length, 1);
        test.done();
      });

    // Create a Simulated LAN Tessel (Unauthorized)
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: false
    });
    // Give it a name
    lan.connection.host = 'Tessel-Test_Subject';
    // Create it's open function
    lan.connection.open = resolveOpenInMs.bind(this, this.scanTime * 2);
    // Once half of the scan time has elapsed, emit a new connection
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);
  },

  oneAuthorizedLANPending: function(test) {
    test.expect(2);
    // Spy on the seeker stop
    this.seekerStop = this.sandbox.spy(TesselSeeker.prototype, 'stop');

    // Give it a name
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return new Promise(function(resolve) {
        resolve('Tessel-Test_Subject');
      });
    });

    // Scan for this period
    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      .then(function discoveryComplete(found) {
        // Make sure we only have the one Tessel we created
        test.equal(found.length, 1);
        // The seeker was told to stop after the timeout ran down
        test.equal(this.seekerStop.callCount, 1);
        test.done();
      }.bind(this));

    // Create a Simulated authorized, LAN Tessel
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create it's open function
    lan.connection.open = resolveOpenInMs.bind(this, this.scanTime * 2);

    // Emit the connection halfway through the scan
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);
  },

  oneAuthorizedLANPendingFails: function(test) {
    test.expect(1);

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return Promise.reject('Could not get name for some reason...');
    });

    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then(function(found) {
        // Make sure we don't find any Tessels
        test.equal(found.length, 0);
        test.done();
      }.bind(this));

    // Create a Simulated authorized, LAN Tessel
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create it's open function
    lan.connection.open = resolveOpenInMs.bind(this, this.scanTime * 2);

    // Emit the connection halfway through the scan
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);
  },

  // A test with multiple kinds of connections emitted at different times
  usbAndLANConnections: function(test) {
    test.expect(1);

    // Give it a name
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return Promise.resolve('Tessel-AndFriends');
    });

    // When all Tessels have completed opening
    standardSeekerSetup(this.seeker, {
        timeout: this.scanTime
      })
      .then(function(found) {
        // Make sure we only have the one Tessel we created
        test.equal(found.length, 4);
        test.done();
      }.bind(this));

    // Create a simulated LAN Tessel (Unathorized)
    var lan1 = TesselSimulator({
      type: 'LAN',
      authorized: false
    });
    // Create a simulated LAN Tessel (authorized)
    var lan2 = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create open functions authorized Tessel opens after scan has
    // complete but unauthorized opens before scan completes
    lan1.connection.open = resolveOpenInMs.bind(this, this.scanTime + 1);
    // Give it a name
    lan1.connection.host = 'Tessel-TroubleMaker';
    lan2.connection.open = resolveOpenInMs.bind(this, this.scanTime + 2);

    var usb1 = TesselSimulator({
      type: 'USB'
    });
    var usb2 = TesselSimulator({
      type: 'USB'
    });

    usb1.connection.open = resolveOpenInMs.bind(this, this.scanTime + 3);
    usb2.connection.open = resolveOpenInMs.bind(this, this.scanTime + 4);

    emitConnectionInMs(this.seeker, lan1.connection, this.scanTime / 4);
    emitConnectionInMs(this.seeker, usb1.connection, this.scanTime / 3);
    emitConnectionInMs(this.seeker, lan2.connection, this.scanTime / 2);
    emitConnectionInMs(this.seeker, usb2.connection, this.scanTime / 1.1);
  },

  // A test where seeker.stop is explicitly called instead of waiting for timeout
  explicitStop: function(test) {
    test.expect(1);

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return Promise.resolve('Frank');
    });

    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then(function(found) {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 0);
        test.done();
      }.bind(this));

    // Create a Simulated LAN Tessel (authorized)
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create it's open function
    lan.connection.open = resolveOpenInMs.bind(this, this.scanTime * 2);

    // Emit the connection halfway through the scan
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);

    setTimeout(function stopScan() {
      this.seeker.stop();
    }.bind(this), this.scanTime);
  },
  onlyFindUSBConnections: function(test) {
    test.expect(2);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime,
      usb: true
    };

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return Promise.resolve('Frank');
    });

    // Start scan
    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then(function(found) {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 1);
        test.equal(found[0].connection.connectionType, 'USB');
        test.done();
      }.bind(this));

    // Create a Simulated LAN Tessel (authorized)
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    var usb = TesselSimulator({
      type: 'USB'
    });

    // Make the open function resolve immediately
    lan.connection.open = function() {
      return Promise.resolve();
    };
    usb.connection.open = function() {
      return Promise.resolve();
    };

    // Emit the connections immediately
    if (this.seeker.lanScan) {
      this.seeker.lanScan.emit('connection', lan.connection);
    }
    if (this.seeker.usbScan) {
      this.seeker.usbScan.emit('connection', usb.connection);
    }

    setTimeout(function stopScan() {
      this.seeker.stop();
    }.bind(this), this.scanTime);
  },
  onlyFindLANConnections: function(test) {
    test.expect(3);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime,
      lan: true
    };

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return Promise.resolve('Frank');
    });

    // Start scan
    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then(function(found) {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 2);
        test.equal(found[0].connection.connectionType, 'LAN');
        test.equal(found[1].connection.connectionType, 'LAN');
        test.done();
      }.bind(this));

    // Create a Simulated LAN Tessel (authorized)
    var lan1 = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create a Simulated LAN Tessel (authorized)
    var lan2 = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    var usb = TesselSimulator({
      type: 'USB'
    });

    // Make the open function resolve immediately
    lan1.connection.open = lan2.connection.open = function() {
      return Promise.resolve();
    };
    usb.connection.open = function() {
      return Promise.resolve();
    };

    // Emit the connections immediately
    if (this.seeker.lanScan) {
      this.seeker.lanScan.emit('connection', lan1.connection);
      this.seeker.lanScan.emit('connection', lan2.connection);
    }
    if (this.seeker.usbScan) {
      this.seeker.usbScan.emit('connection', usb.connection);
    }

    setTimeout(function stopScan() {
      this.seeker.stop();
    }.bind(this), this.scanTime);
  }
};

function standardSeekerSetup(seeker, opts) {
  return new Promise(function(resolve) {
    // Start scan
    seeker.start(opts);
    // Array to save found Tessels in
    var found = [];

    // When we get a Tessel
    seeker.on('tessel', function(tessel) {
      // save it
      found.push(tessel);
    });

    // When all Tessels have completed opening
    seeker.once('end', function() {
      return resolve(found);
    });
  });
}

function resolveOpenInMs(ms) {
  // After twice the scanning time, finally resolve
  return new Promise(function(resolve) {
    setTimeout(function() {
      return resolve();
    }, ms);
  });
}

function emitConnectionInMs(seeker, connection, ms) {
  setTimeout(function() {
    // Emit a new connection
    seeker.lanScan.emit('connection', connection);
  }, ms);
}
