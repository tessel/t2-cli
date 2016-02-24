// Test dependencies are required and exposed in common/bootstrap.js

exports['Tessel (get)'] = {

  setUp: function(done) {
    var testContext = this;
    this.sandbox = sinon.sandbox.create();
    this.activeSeeker = undefined;
    // This is necessary to prevent an Emitter memory leak warning
    this.processOn = this.sandbox.stub(process, 'on');
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function Seeker() {
      this.start = function(options) {
        testContext.activeSeeker = this;
        setTimeout(() => this.stop(), options.timeout);
        return this;
      };
      this.stop = function() {
        this.emit('end');
        return this;
      };
    });
    util.inherits(this.seeker, Emitter);
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});

    this.menu = this.sandbox.stub(controller, 'menu', function() {
      return Promise.resolve();
    });

    this.standardOpts = {
      timeout: 0.01,
    };

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  infoOutput: function(test) {
    test.expect(1);
    Tessel.get(this.standardOpts)
      .catch(() => {
        test.equal(this.logsInfo.firstCall.args[0], 'Looking for your Tessel...');
        test.done();
      });
  },

  noTessels: function(test) {
    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
      // If Tessels were returned, this test should fail because we're
      // not emitting any Tessels to the seeker
      .then(function(tessels) {
        test.equal(tessels, false, 'Somehow Tessels were returned');
      })
      .catch(function(err) {
        test.equal(typeof err, 'string', 'No error thrown');
        test.done();
      });
  },

  noTesselWithName: function(test) {
    var testConnectionType = 'USB';
    var testName = 'Does_Exist';

    var customOpts = {
      timeout: this.standardOpts.timeout,
      name: 'Does_Not_Exist'
    };

    // Try to get Tessels but return none
    Tessel.get(customOpts)
      .then(function(tessels) {
        test.equal(tessels, false, 'Somehow Tessels were returned');
      })
      .catch(function(err) {
        test.equal(typeof err, 'string', 'No error thrown');
        test.done();
      });

    var tessel = new Tessel({
      connectionType: testConnectionType
    });
    tessel.name = testName;

    setImmediate(() => this.activeSeeker.emit('tessel', tessel));
  },

  oneUSB: function(test) {
    var testConnectionType = 'USB';
    var testName = 'testTessel';
    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
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

    setImmediate(() => this.activeSeeker.emit('tessel', tessel));
  },

  multipleUSBNoName: function(test) {
    test.expect(2);
    // Try to get Tessels
    Tessel.get(this.standardOpts)
      // It should return the first USB device it finds
      .then(function(tessel) {
        test.equal(tessel.name, a.name);
        test.equal(tessel.connection.connectionType, a.connection.connectionType);
        test.done();
      })
      .catch((reason) => {
        test.equal(reason, undefined, 'Neither USB device was found');
      });

    var a = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });
    var b = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    a.name = 'a';
    b.name = 'b';

    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    });
  },

  multipleUSBHasName: function(test) {
    test.expect(1);

    var customOpts = {
      timeout: this.standardOpts.timeout,
      name: 'a'
    };

    Tessel.get(customOpts)
      .then(function(tessel) {
        test.equal(tessel.name, 'a');
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var a = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });
    var b = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    a.name = 'a';
    b.name = 'b';

    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    });
  },

  usbAndNonAuthorizedLANSameTessel: function(test) {
    test.expect(2);

    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
      .then(function(tessel) {
        test.equal(tessel.name, 'a');
        test.equal(tessel.connection.connectionType, 'USB');

        usb.close();
        lan.close();
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var usb = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });
    var lan = new Tessel({
      connectionType: 'LAN',
      authorized: false,
      end: function() {
        return Promise.resolve();
      }
    });

    usb.name = 'a';
    lan.name = 'a';

    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    });
  },

  usbAndNonAuthorizedLANSameTesselLANFirst: function(test) {
    test.expect(2);
    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
      .then(function(tessel) {
        test.equal(tessel.name, 'a');
        test.equal(tessel.connection.connectionType, 'USB');
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var usb = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });
    var lan = new Tessel({
      connectionType: 'LAN',
      authorized: false,
      end: function() {
        return Promise.resolve();
      }
    });

    usb.name = 'a';
    lan.name = 'a';

    setImmediate(() => {
      // "Detect" the lan first. This order is intentional
      // 1
      this.activeSeeker.emit('tessel', lan);
      // 2
      this.activeSeeker.emit('tessel', usb);
    });

  },

  usbAndAuthorizedLANSameTessel: function(test) {
    test.expect(2);

    // Try to get Tessels
    Tessel.get(this.standardOpts)
      .then(function(tessel) {
        test.equal(tessel.name, 'a');
        test.equal(tessel.connection.connectionType, 'USB');
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var usb = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });
    var lan = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });

    usb.name = 'a';
    lan.name = 'a';

    lan.connection.authorized = true;

    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    });
  },

  multipleLANNoName: function(test) {
    test.expect(2);
    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
      .catch((reason) => {
        test.equal(reason, 'No Tessel selected, mission aborted!');
        test.equal(this.menu.calledOnce, 1);
        a.close();
        b.close();
        test.done();
      });

    var a = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });
    var b = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });

    a.name = 'a';
    b.name = 'b';

    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    });
  },

  multipleLANHasName: function(test) {
    test.expect(1);

    var customOpts = {
      timeout: this.standardOpts.timeout,
      name: 'a'
    };

    Tessel.get(customOpts)
      .then(function(tessel) {
        test.equal(tessel.name, 'a');
        a.close();
        b.close();
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var a = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });
    var b = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });

    a.name = 'a';
    b.name = 'b';

    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    });
  },

  // Tests that Tessel.get will return a USB connection
  // immediately upon being found if preferLAN is false
  defaultUSBPrefer: function(test) {
    test.expect(1);

    Tessel.get({
        timeout: 0.01,
      })
      .then(function(tessel) {
        test.equal(tessel.name, b.name);
        a.close();
        b.close();
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var a = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });
    var b = new Tessel({
      connectionType: 'USB',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });

    a.name = 'a';
    b.name = 'b';

    setImmediate(() => {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    });
  },

  // Tests that Tessel.get will return a LAN connection
  // if one is ever found for a default Tessel
  LANPrefer: function(test) {
    test.expect(2);

    Tessel.get({
        timeout: 0.01,
        lanPrefer: true
      })
      .then(function(tessel) {
        test.equal(tessel.name, lan.name);
        test.equal(tessel.connection.connectionType, 'LAN');
        usb.close();
        lan.close();
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var usb = new Tessel({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });
    var lan = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });

    usb.name = 'a';
    lan.name = 'a';


    setImmediate(() => {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    });
  },

  // Tests that Tessel.get will return a LAN connection
  // if USB is preferred but none are found
  USBPreferNoUSBFound: function(test) {
    test.expect(2);

    Tessel.get({
        timeout: 0.01,
        lanPrefer: false
      })
      .then(function(tessel) {
        test.equal(tessel.name, lan.name);
        test.equal(tessel.connection.connectionType, 'LAN');
        lan.close();
        test.done();
      })
      .catch(function() {
        test.ok(false, 'Tessel.get failed');
        test.done();
      });

    var lan = new Tessel({
      connectionType: 'LAN',
      authorized: true,
      end: function() {
        return Promise.resolve();
      }
    });

    lan.name = 'a';

    setImmediate(() => this.activeSeeker.emit('tessel', lan));
  }
};


exports['Tessel (get); filter: unauthorized'] = {

  setUp: function(done) {
    var testContext = this;
    this.sandbox = sinon.sandbox.create();
    this.activeSeeker = undefined;
    // This is necessary to prevent an Emitter memory leak warning
    this.processOn = this.sandbox.stub(process, 'on');

    var Seeker = discover.TesselSeeker;

    this.start = this.sandbox.spy(Seeker.prototype, 'start');

    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function() {
      testContext.activeSeeker = new Seeker();
      return testContext.activeSeeker;
    });

    this.startScan = this.sandbox.stub(lan, 'startScan', function() {
      return new Emitter();
    });

    util.inherits(this.seeker, Emitter);
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});

    this.menu = this.sandbox.stub(controller, 'menu', function() {
      return Promise.resolve();
    });

    this.standardOpts = {
      timeout: 0.01,
    };

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  unauthorizedLANDoesNotSurface: function(test) {
    test.expect(1);

    var customOpts = {
      timeout: this.standardOpts.timeout,
      authorized: true
    };

    Tessel.get(customOpts)
      .then(() => {
        test.fail();
      })
      .catch((message) => {
        test.equal(message, 'No Authorized Tessels Found.');
        test.done();
      });

    var lan = TesselSimulator({
      type: 'LAN',
      authorized: false
    });

    lan.connection.host = 'TestTessel';

    setImmediate(() => {
      this.activeSeeker.lanScan.emit('connection', lan.connection);
      this.activeSeeker.emit('end');
    });
  },
};

exports['Tessel.simpleExec'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.tessel = new TesselSimulator();
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  fastClose: function(test) {
    // Stub exec so we can inject an immediate close
    this.sandbox.stub(this.tessel.connection, 'exec', (command, callback) => {
      // Return the remote process
      callback(null, this.tessel._rps);
      // Immediately close the remote process
      this.tessel._rps.emit('close');
    });

    // Execute an arbitrary command
    this.tessel.simpleExec('arbitrary command')
      // If the callback gets called, it passes the test
      .then(test.done);
  }
};
