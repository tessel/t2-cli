// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

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
  setUp(done) {
    this.seeker = new TesselSeeker();

    done();
  },

  tearDown(done) {
    done();
  },

  initialization(test) {
    test.expect(2);
    test.equal(this.lanScan, null);
    test.equal(this.usbScan, null);
    test.done();
  },
};

exports['TesselSeeker.prototype.start'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.stop = this.sandbox.spy(FakeScanner.prototype, 'stop');

    this.usbStartScan = this.sandbox.stub(usb, 'startScan').callsFake(function() {
      return new FakeScanner();
    });
    this.lanStartScan = this.sandbox.stub(lan, 'startScan').callsFake(function() {
      return new FakeScanner();
    });
    this.usbStopScan = this.sandbox.stub(usb, 'stopScan').callsFake(function() {
      return null;
    });
    this.lanStopScan = this.sandbox.stub(lan, 'stopScan').callsFake(function() {
      return null;
    });
    this.seeker = new TesselSeeker();
    // The default amount of time to scan for connections
    this.scanTime = 100;

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  start(test) {
    test.expect(3);

    test.equal(this.seeker.start(), this.seeker);

    test.equal(this.usbStartScan.callCount, 1);
    test.equal(this.lanStartScan.callCount, 1);

    test.done();
  },

  onlyFindUSBConnectionNoAlternative(test) {
    test.expect(2);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime,
      usb: true
    };

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(function() {
      return Promise.resolve('Frank');
    });

    // Start scan
    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then((found) => {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 1);
        test.equal(found[0].connection.connectionType, 'USB');
        test.done();
      });

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
  setUp(done) {

    this.sandbox = sinon.sandbox.create();

    this.stop = this.sandbox.spy(FakeScanner.prototype, 'stop');

    this.usbStartScan = this.sandbox.stub(usb, 'startScan').callsFake(function() {
      return new FakeScanner();
    });
    this.lanStartScan = this.sandbox.stub(lan, 'startScan').callsFake(function() {
      return new FakeScanner();
    });
    this.usbStopScan = this.sandbox.stub(usb, 'stopScan').callsFake(function() {
      return null;
    });
    this.lanStopScan = this.sandbox.stub(lan, 'stopScan').callsFake(function() {
      return null;
    });
    this.seeker = new TesselSeeker();

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  stop(test) {
    test.expect(1);
    test.equal(this.seeker.stop(), this.seeker);
    test.done();
  },

  stopAfterStart(test) {
    test.expect(2);

    this.seeker.start();
    this.seeker.stop();

    // Both active scanners called stop
    test.equal(this.usbStopScan.callCount, 1);
    test.equal(this.lanStopScan.callCount, 1);

    test.done();
  },

  stopDuplicateCall(test) {
    test.expect(4);

    this.seeker.start();
    this.seeker.stop();

    // Call count remains 1 each
    test.equal(this.usbStopScan.callCount, 1);
    test.equal(this.lanStopScan.callCount, 1);

    // Duplicate call
    this.seeker.stop();

    // Call count remains at one
    test.equal(this.usbStopScan.callCount, 1);
    test.equal(this.lanStopScan.callCount, 1);

    test.done();
  },

  stopOnlyUsb(test) {
    test.expect(2);

    this.seeker.start();

    this.seeker.lanScan = null;

    this.seeker.stop();

    test.equal(this.usbStopScan.callCount, 1);
    test.equal(this.lanStopScan.callCount, 0);

    test.done();
  },

  stopOnlyLan(test) {
    test.expect(2);

    this.seeker.start();

    this.seeker.usbScan = null;

    this.seeker.stop();

    test.equal(this.usbStopScan.callCount, 0);
    test.equal(this.lanStopScan.callCount, 1);

    test.done();
  }
};

exports['TesselSeeker Scan Time'] = {
  setUp(done) {

    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn');
    this.logInfo = this.sandbox.stub(log, 'info');
    this.logBasic = this.sandbox.stub(log, 'basic');
    this.logBasic = this.sandbox.stub(log, 'error');

    this.stop = this.sandbox.spy(FakeScanner.prototype, 'stop');

    this.usbStartScan = this.sandbox.stub(usb, 'startScan').callsFake(function() {
      return new FakeScanner();
    });
    this.lanStartScan = this.sandbox.stub(lan, 'startScan').callsFake(function() {
      return new FakeScanner();
    });
    this.usbStopScan = this.sandbox.stub(usb, 'stopScan').callsFake(function() {
      return null;
    });
    this.lanStopScan = this.sandbox.stub(lan, 'stopScan').callsFake(function() {
      return null;
    });
    this.seeker = new TesselSeeker();
    // The default amount of time to scan for connections
    this.scanTime = 100;

    done();
  },

  tearDown(done) {
    // Remove sigint listeners once we finish with the Tessels
    process.removeAllListeners('SIGINT');
    this.sandbox.restore();
    done();
  },

  oneUnauthorizedLANPending(test) {
    test.expect(1);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then((found) => {
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
    lan.connection.open = () => resolveOpenInMs(this.scanTime * 2);
    // Once half of the scan time has elapsed, emit a new connection
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);
  },

  oneAuthorizedLANPending(test) {
    test.expect(2);
    // Spy on the seeker stop
    this.seekerStop = this.sandbox.spy(TesselSeeker.prototype, 'stop');

    // Give it a name
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(function() {
      return new Promise(function(resolve) {
        resolve('Tessel-Test_Subject');
      });
    });

    // Scan for this period
    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      .then((found) => {
        // Make sure we only have the one Tessel we created
        test.equal(found.length, 1);
        // The seeker was told to stop after the timeout ran down
        test.equal(this.seekerStop.callCount, 1);
        test.done();
      });

    // Create a Simulated authorized, LAN Tessel
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create it's open function
    lan.connection.open = () => resolveOpenInMs(this.scanTime * 2);

    // Emit the connection halfway through the scan
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);
  },

  oneAuthorizedLANPendingFails(test) {
    test.expect(1);

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(function() {
      return Promise.reject('Could not get name for some reason...');
    });

    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then((found) => {
        // Make sure we don't find any Tessels
        test.equal(found.length, 0);
        test.done();
      });

    // Create a Simulated authorized, LAN Tessel
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create it's open function
    lan.connection.open = () => resolveOpenInMs(this.scanTime * 2);

    // Emit the connection halfway through the scan
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);
  },

  // A test with multiple kinds of connections emitted at different times
  usbAndLANConnections(test) {
    test.expect(1);

    // Give it a name
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(function() {
      return Promise.resolve('Tessel-AndFriends');
    });

    // When all Tessels have completed opening
    standardSeekerSetup(this.seeker, {
        timeout: this.scanTime
      })
      .then((found) => {
        // Make sure we only have the one Tessel we created
        test.equal(found.length, 4);
        test.done();
      });

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
    lan1.connection.open = () => resolveOpenInMs(this.scanTime + 1);
    // Give it a name
    lan1.connection.host = 'Tessel-TroubleMaker';
    lan2.connection.open = () => resolveOpenInMs(this.scanTime + 2);

    var usb1 = TesselSimulator({
      type: 'USB'
    });
    var usb2 = TesselSimulator({
      type: 'USB'
    });

    usb1.connection.open = () => resolveOpenInMs(this.scanTime + 3);
    usb2.connection.open = () => resolveOpenInMs(this.scanTime + 4);

    emitConnectionInMs(this.seeker, lan1.connection, this.scanTime / 4);
    emitConnectionInMs(this.seeker, usb1.connection, this.scanTime / 3);
    emitConnectionInMs(this.seeker, lan2.connection, this.scanTime / 2);
    emitConnectionInMs(this.seeker, usb2.connection, this.scanTime / 1.1);
  },

  // A test where seeker.stop is explicitly called instead of waiting for timeout
  explicitStop(test) {
    test.expect(1);

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(function() {
      return Promise.resolve('Frank');
    });

    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime
    };

    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then((found) => {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 0);
        test.done();
      });

    // Create a Simulated LAN Tessel (authorized)
    var lan = TesselSimulator({
      type: 'LAN',
      authorized: true
    });

    // Create it's open function
    lan.connection.open = () => resolveOpenInMs(this.scanTime * 2);

    // Emit the connection halfway through the scan
    emitConnectionInMs(this.seeker, lan.connection, this.scanTime / 2);

    setTimeout(() => this.seeker.stop(), this.scanTime);
  },
  onlyFindUSBConnections(test) {
    test.expect(2);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime,
      usb: true
    };

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(function() {
      return Promise.resolve('Frank');
    });

    // Start scan
    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then((found) => {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 1);
        test.equal(found[0].connection.connectionType, 'USB');
        test.done();
      });

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

    setTimeout(() => this.seeker.stop(), this.scanTime);
  },
  onlyFindLANConnections(test) {
    test.expect(3);
    // Scan for new connections for this period
    var seekerOpts = {
      timeout: this.scanTime,
      lan: true
    };

    // Error on name fetch
    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(function() {
      return Promise.resolve('Frank');
    });

    // Start scan
    standardSeekerSetup(this.seeker, seekerOpts)
      // When all Tessels have completed opening
      .then((found) => {
        // Make sure we don't find any Tessels because we stopped the scan
        test.equal(found.length, 2);
        test.equal(found[0].connection.connectionType, 'LAN');
        test.equal(found[1].connection.connectionType, 'LAN');
        test.done();
      });

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

    setTimeout(() => this.seeker.stop(), this.scanTime);
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
