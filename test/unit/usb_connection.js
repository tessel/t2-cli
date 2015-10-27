var sinon = require('sinon');
var Emitter = require('events').EventEmitter;
var Duplex = require('stream').Duplex;
var USB = require('../../lib/usb_connection').USB;
var Daemon = require('../../lib/usb/usb_daemon');
var logs = require('../../lib/logs');

exports['USB.Connection'] = {
  setUp: function(done) {
    this.usbConnection = new USB.Connection({});
    done();
  },

  tearDown: function(done) {
    done();
  },

  duplexSubclass: function(test) {
    test.expect(1);
    test.ok(this.usbConnection instanceof Duplex);
    test.done();
  },

  connectionType: function(test) {
    test.expect(1);
    test.equal(this.usbConnection.connectionType, 'USB');
    test.done();
  },
};

exports['USB.Connection.prototype.exec'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.openProcess = this.sandbox.stub(Daemon, 'openProcess');
    this.usbConnection = new USB.Connection({});
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  openProcess: function(test) {
    test.expect(1);

    this.usbConnection.exec(['some -command 1']);

    test.equal(this.openProcess.callCount, 1);

    // TODO: add more specific tests for handling the opened process
    test.done();
  },
};

exports['USB.Connection.prototype._write'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.openProcess = this.sandbox.stub(Daemon, 'openProcess');
    this.usbConnection = new USB.Connection({});
    this.usbConnection.epOut = new Emitter();
    this.usbConnection.epOut.transfer = this.sandbox.spy();
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  transfer: function(test) {
    test.expect(3);

    var spy = this.sandbox.spy();

    this.usbConnection._write(1, 2, spy);

    test.equal(this.usbConnection.epOut.transfer.callCount, 1);
    test.equal(this.usbConnection.epOut.transfer.lastCall.args[0], 1);
    test.equal(this.usbConnection.epOut.transfer.lastCall.args[1], spy);

    test.done();
  },

  transferClosed: function(test) {
    test.expect(2);

    var spy = this.sandbox.spy();

    this.usbConnection.closed = true;
    this.usbConnection._write(1, 2, spy);

    test.equal(this.usbConnection.epOut.transfer.callCount, 0);
    test.equal(spy.callCount, 1);

    test.done();
  },
};

exports['USB.Connection.prototype._receiveMessages'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.err = this.sandbox.stub(logs, 'err');
    this.processExit = this.sandbox.stub(process, 'exit');
    this.usbConnection = new USB.Connection({});
    this.usbConnection.epIn = new Emitter();
    this.usbConnection.epIn.startPoll = this.sandbox.spy();
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  startPolling: function(test) {
    test.expect(3);

    this.usbConnection._receiveMessages();

    test.equal(this.usbConnection.epIn.startPoll.callCount, 1);
    test.equal(this.usbConnection.epIn.startPoll.lastCall.args[0], 2);
    test.equal(this.usbConnection.epIn.startPoll.lastCall.args[1], 4096);
    test.done();
  },

  pushReceivedData: function(test) {
    test.expect(1);

    this.usbConnection._receiveMessages();

    this.usbConnection.epIn.emit('data', new Buffer([0xff, 0xff]));
    test.equal(this.usbConnection._readableState.length, 2);
    test.done();
  },

  errorOnOpen: function(test) {
    var self = this;
    test.expect(2);
    var errorMessage = 'bad usb things!';

    self.usbConnection.epIn.stopPoll = function() {};
    this.sandbox.stub(this.usbConnection, '_receiveMessages', function() {
      self.usbConnection.epIn.emit('error', errorMessage);
    });

    var closeFunc = this.sandbox.spy(this.usbConnection, '_close');

    var fakeInterface = {
      claim: function() {},
      setAltSetting: function(arg1, cb) {
        cb();
      },
      endpoints: [self.usbConnection.epIn, new Emitter()],
    };
    this.sandbox.stub(this.usbConnection, 'device', {
      open: function() {},
      interface: function() {
        return fakeInterface;
      },
      getStringDescriptor: function(arg1, cb) {
        cb();
      },
      deviceDescriptor: {
        iSerialNumber: 'blah',
      }
    });

    this.usbConnection.open()
      .then(function() {
        // It should not resolve
        test.fail();
      })
      .catch(function(err) {
        // It should throw the error;
        test.equal(err, errorMessage);
        test.equal(closeFunc.callCount, 1);
        test.done();
      });
  }
};
