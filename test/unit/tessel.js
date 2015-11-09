var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var discover = require('../../lib/discover.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var logs = require('../../lib/logs');
// Require this function so that the functions in the
// controller placed on the Tessel prototype
var controller = require('../../lib/controller');
var lan = require('../../lib/lan_connection');
var TesselSimulator = require('../common/tessel-simulator');
var TESSEL_AUTH_KEY = require('../../lib/tessel/provision.js').TESSEL_AUTH_KEY;


exports['Tessel (get)'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.activeSeeker = undefined;
    // This is necessary to prevent an EventEmitter memory leak warning
    this.processOn = this.sandbox.stub(process, 'on');
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function Seeker() {
      this.start = function(options) {
        self.activeSeeker = this;
        setTimeout(this.stop.bind(this), options.timeout);
        return this;
      };
      this.stop = function() {
        this.emit('end');
        return this;
      };
    });
    util.inherits(this.seeker, EventEmitter);
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});

    this.menu = this.sandbox.stub(controller, 'menu', function() {
      return Promise.resolve();
    });

    this.standardOpts = {
      timeout: 0.01,
      key: TESSEL_AUTH_KEY
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
      .catch(function() {
        test.equal(this.logsInfo.firstCall.args[0], 'Looking for your Tessel...');
        test.done();
      }.bind(this));
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
      key: this.standardOpts.key,
      name: 'Does_Not_Exist'
    };
    // Try to get Tessels but return none
    Tessel.get(customOpts)
      // If
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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', tessel);
    }.bind(this));
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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', tessel);
    }.bind(this));
  },

  multipleUSBNoName: function(test) {
    test.expect(2);
    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
      .catch(function(reason) {
        test.equal(reason, 'No Tessel selected, mission aborted!');
        test.equal(this.menu.calledOnce, 1);
        test.done();
      }.bind(this));

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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    }.bind(this));
  },

  multipleUSBHasName: function(test) {
    test.expect(1);

    var customOpts = {
      timeout: this.standardOpts.timeout,
      key: this.standardOpts.key,
      name: 'a'
    };

    Tessel.get(customOpts)
      .then(function(tessel) {
        test.equal(tessel.name, 'a');
        test.done();
      })
      .catch(function() {
        test.fail();
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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    }.bind(this));
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
        test.fail();
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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    }.bind(this));
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
        test.fail();
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

    setImmediate(function() {
      // "Detect" the lan first. This order is intentional
      // 1
      this.activeSeeker.emit('tessel', lan);
      // 2
      this.activeSeeker.emit('tessel', usb);
    }.bind(this));

  },

  usbAndAuthorizedLANSameTessel: function(test) {
    test.expect(2);

    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
      .then(function(tessel) {
        test.equal(tessel.name, 'a');
        test.equal(tessel.connection.connectionType, 'LAN');
        test.done();
      })
      .catch(function() {
        test.fail();
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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', usb);
      this.activeSeeker.emit('tessel', lan);
    }.bind(this));
  },

  multipleLANNoName: function(test) {
    test.expect(2);
    // Try to get Tessels but return none
    Tessel.get(this.standardOpts)
      .catch(function(reason) {
        test.equal(reason, 'No Tessel selected, mission aborted!');
        test.equal(this.menu.calledOnce, 1);
        a.close();
        b.close();
        test.done();
      }.bind(this));

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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    }.bind(this));
  },

  multipleLANHasName: function(test) {
    test.expect(1);

    var customOpts = {
      timeout: this.standardOpts.timeout,
      key: this.standardOpts.key,
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
        test.fail();
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

    setImmediate(function() {
      this.activeSeeker.emit('tessel', a);
      this.activeSeeker.emit('tessel', b);
    }.bind(this));
  },
};


exports['Tessel (get); filter: unauthorized'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.activeSeeker = undefined;
    // This is necessary to prevent an EventEmitter memory leak warning
    this.processOn = this.sandbox.stub(process, 'on');

    var Seeker = discover.TesselSeeker;

    this.start = this.sandbox.spy(Seeker.prototype, 'start');

    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function() {
      self.activeSeeker = new Seeker();
      return self.activeSeeker;
    });

    this.startScan = this.sandbox.stub(lan, 'startScan', function() {
      return new EventEmitter();
    });

    util.inherits(this.seeker, EventEmitter);
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});

    this.menu = this.sandbox.stub(controller, 'menu', function() {
      return Promise.resolve();
    });

    this.standardOpts = {
      timeout: 0.01,
      key: TESSEL_AUTH_KEY
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
      key: this.standardOpts.key,
      authorized: true
    };

    Tessel.get(customOpts)
      .then(function() {
        test.fail();
      }.bind(this))
      .catch(function(message) {
        test.equal(message, 'No Authorized Tessels Found.');
        test.done();
      });

    var lan = TesselSimulator({
      type: 'LAN',
      authorized: false
    });

    setImmediate(function() {
      this.activeSeeker.lanScan.emit('connection', lan.connection);
      this.activeSeeker.emit('end');
    }.bind(this));
  },
};
