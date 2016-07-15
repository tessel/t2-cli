// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

var api = require('../../index');

exports['API Surface'] = {
  setUp: function(done) {
    done();
  },
  tearDown: function(done) {
    done();
  },
  ensureExistence: function(test) {
    test.ok(api === controller);
    test.ok(api === controller);
    test.ok(api.commands === commands);
    test.ok(api.Tessel === Tessel);
    test.ok(api.USBConnection === USB.Connection);
    test.ok(api.LANConnection === LAN.Connection);
    test.done();
  }
};

exports['CLI.list'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn', function() {});
    this.logInfo = this.sandbox.stub(log, 'info', function() {});
    this.logBasic = this.sandbox.stub(log, 'basic', function() {});
    this.closeConnections = this.sandbox.stub(controller, 'closeTesselConnections').returns(Promise.resolve());
    var test = this;
    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function Seeker() {
      this.start = (options) => {
        test.activeSeeker = this;
        setTimeout(() => this.stop(), options.timeout);
        return this;
      };
      this.stop = function() {
        this.emit('end');
        return this;
      };
    });

    util.inherits(this.seeker, Emitter);
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  rejectWithNoTessels: function(test) {
    test.expect(1);
    api.list({
        timeout: 0.0001,
        usb: true
      })
      .then(() => {
        test.ok(false, 'Should not have returned any Tessels');
        test.done();
      })
      .catch((err) => {
        test.ok(err);
        test.done();
      });
  },
  resolveWithOneTessel: function(test) {
    // Create a new Tessel
    var tessel = new Tessel({
      connectionType: 'USB'
    });
    tessel.name = 'TestTessel';

    api.list({
        timeout: 0.1,
        usb: true
      })
      .then((tessels) => {
        test.ok(tessels.length === 1);
        test.ok(tessels[0].name === tessel.name);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'Should not have rejected with one Tessel available');
        test.done();
      });

    // Emit the Tessel
    setImmediate(() => {
      this.activeSeeker.emit('tessel', tessel);
    });
  },

  resolveWithMultipleTessels: function(test) {
    // Create a new Tessel
    var tessel1 = new Tessel({
      connectionType: 'USB'
    });

    tessel1.name = 'TestTessel1';

    // Create a new Tessel
    var tessel2 = new Tessel({
      connectionType: 'LAN'
    });

    tessel2.name = 'TestTessel2';

    api.list({
        timeout: 0.1
      })
      .then((tessels) => {
        test.ok(tessels.length === 2);
        test.ok(tessels[0].name === tessel1.name);
        test.ok(tessels[1].name === tessel2.name);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'Should not have rejected with one Tessel available');
        test.done();
      });

    // Emit the Tessel
    setImmediate(() => {
      this.activeSeeker.emit('tessel', tessel1);
      this.activeSeeker.emit('tessel', tessel2);
    });
  }
};
