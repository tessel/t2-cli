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

exports['controller.runHeuristics'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  oneUSBDevice: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    controller.runHeuristics({}, [a])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        test.done();
      });
  },

  oneLANDevice: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    controller.runHeuristics({}, [a])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        test.done();
      });
  },

  USBAndLANDevices: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    controller.runHeuristics({}, [a, b])
      .then(function(tessel) {
        test.deepEqual(b, tessel);
        test.done();
      });
  },

  bothConnectionsAndLAN: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    b.addConnection({
      connectionType: 'LAN',
      authorized: true
    });

    controller.runHeuristics({}, [a, b])
      .then(function(tessel) {
        test.deepEqual(b, tessel);
        test.done();
      });
  },

  bothConnectionsAndMultipleLAN: function(test) {
    test.expect(1);

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
      authorized: true,
      type: 'USB'
    });

    c.addConnection({
      connectionType: 'LAN',
      authorized: true
    });

    controller.runHeuristics({}, [a, b, c])
      .then(function(tessel) {
        test.deepEqual(c, tessel);
        test.done();
      });
  },

  USBAndLANDevicesWithNameOption: function(test) {
    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    a.name = 'Me!';

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    b.name = 'Not Me!';

    controller.runHeuristics({
        name: a.name
      }, [a, b])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        test.done();
      });
  },

  USBAndLANDevicesWithEnvVariable: function(test) {
    test.expect(1);

    var winningName = 'Me!';
    process.env['Tessel'] = winningName;

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'LAN'
    });

    a.name = winningName;

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    b.name = 'Not ' + winningName;

    controller.runHeuristics({
        name: a.name
      }, [a, b])
      .then(function(tessel) {
        test.deepEqual(a, tessel);
        process.env['Tessel'] = undefined;
        test.done();
      });
  },

  catchAmbiguityTwoLAN: function(test) {

    test.expect(1);

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

    controller.runHeuristics({}, [a, b])
      .then(function() {
        test.fail('Should have thrown an error');
      })
      .catch(function(err) {
        test.equal(err instanceof controller.HeuristicAmbiguityError, true);
        test.done();
      });
  },

  catchAmbiguityTwoUSB: function(test) {

    test.expect(1);

    var a = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    var b = newTessel({
      sandbox: this.sandbox,
      authorized: true,
      type: 'USB'
    });

    controller.runHeuristics({}, [a, b])
      .then(function() {
        test.fail('Should have thrown an error');
      })
      .catch(function(err) {
        test.equal(err instanceof controller.HeuristicAmbiguityError, true);
        test.done();
      });
  }
};


exports['Tessel.list'] = {

  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(Seeker, 'TesselSeeker', function Seeker() {
      this.start = function(opts) {
        self.activeSeeker = this;
        if (opts.timeout && typeof opts.timeout === 'number') {
          setTimeout(this.stop, opts.timeout);
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
    test.expect(4);

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
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneLANTessel: function(test) {
    test.expect(4);

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
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneTesselTwoConnections: function(test) {
    test.expect(5);

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
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);
  },

  multipleDifferentTessels: function(test) {
    test.expect(5);

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
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
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
      this.start = function(opts) {
        self.activeSeeker = this;
        if (opts.timeout && typeof opts.timeout === 'number') {
          setTimeout(this.stop, opts.timeout);
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
    test.expect(6);

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
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'the_name'), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneUnNamedTessel: function(test) {
    test.expect(6);

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
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'the_name'), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', a);
  },

  oneUnamedTesselTwoConnections: function(test) {
    test.expect(6);

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
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.equal(this.logsInfo.callCount, 2);
        test.equal(_.contains(this.logsInfo.lastCall.args[0], 'samesies'), true);
        test.done();
      }.bind(this));

    this.activeSeeker.emit('tessel', usb);
    this.activeSeeker.emit('tessel', lan);
  },

  standardCommandNoTessels: function(test) {
    test.expect(2);

    var opts = {
      timeout: 0.01
    };
    controller.standardTesselCommand(opts, function() {
        // Doesn't matter what this function does b/c Tessel.get will fail
        return Promise.resolve();
      })
      .catch(function(err) {
        // We don't need to close any connections because none were found
        test.equal(this.closeTesselConnections.callCount, 0);
        test.equal(typeof err, 'string');
        test.done();
      }.bind(this));
  },

  standardCommandSuccess: function(test) {
    test.expect(4);

    controller.closeTesselConnections.returns(Promise.resolve());
    var optionalValue = 'testValue';
    var opts = {
      timeout: 0.01
    };
    controller.standardTesselCommand(opts, function(tessel) {
        // Make sure we have been given the tessel that was emitted
        test.deepEqual(tessel, usb);
        // Finish the command
        return Promise.resolve(optionalValue);
      })
      .then(function(returnedValue) {
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        // Ensure we got the optional returned value
        test.equal(optionalValue, returnedValue);
        test.done();
      }.bind(this))
      .catch(test.fail);

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    this.activeSeeker.emit('tessel', usb);
  },

  standardCommandFailed: function(test) {
    test.expect(4);

    controller.closeTesselConnections.returns(Promise.resolve());

    var opts = {
      timeout: 0.01
    };

    var errMessage = 'This command failed';

    controller.standardTesselCommand(opts, function(tessel) {
        // Make sure we have been given the tessel that was emitted
        test.deepEqual(tessel, usb);
        // Finish the command
        return Promise.reject(errMessage);
      })
      .then(test.fail)
      .catch(function(err) {
        // Make sure the error messages are passed through properly
        test.equal(errMessage, err);
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        test.done();
      }.bind(this));

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    this.activeSeeker.emit('tessel', usb);
  },

  standardCommandSigInt: function(test) {
    test.expect(2);

    controller.closeTesselConnections.returns(Promise.resolve());

    var opts = {
      timeout: 0.01
    };

    controller.standardTesselCommand(opts, function() {
        // This command doesn't do anything. It won't resolve so if we do get
        // to the next clause, it's due to the sigint
      })
      .then(function() {
        // We need to close the connection of the Tessel we found
        // We close once at the end of Tessel.get and again after the standard command
        test.equal(this.closeTesselConnections.callCount, 2);
        // Make sure we closed the connection of the exact Tessel we emitted
        test.equal(this.closeTesselConnections.args[1][0][0], usb);
        test.done();
      }.bind(this))
      .catch(test.fail);

    var usb = newTessel({
      sandbox: this.sandbox,
      type: 'USB',
      name: 'USBTessel'
    });

    this.activeSeeker.emit('tessel', usb);

    process.emit('SIGINT');
  },
};
