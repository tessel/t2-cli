// Test dependencies are required and exposed in common/bootstrap.js

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

exports['USB.Connection.prototype.open'] = {
  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.err = this.sandbox.stub(logs, 'err');
    this.processExit = this.sandbox.stub(process, 'exit');
    this.usbConnection = new USB.Connection({});
    this.usbConnection.epOut = new Emitter();
    this.usbConnection.epOut.transfer = this.sandbox.spy();
    this.usbConnection.epIn = new Emitter();
    this.usbConnection.epIn.startPoll = this.sandbox.spy();
    this.usbConnection.epIn.stopPoll = function(cb) {
      cb();
    };
    this.closeFunc = this.sandbox.spy(this.usbConnection, '_close');
    this.fakeInterface = {
      claim: function() {},
      setAltSetting: function(arg1, cb) {
        cb();
      },
      release: function(val, cb) {
        cb();
      },
      endpoints: [self.usbConnection.epIn, self.usbConnection.epOut],
    };
    this.sandbox.stub(this.usbConnection, 'device', {
      open: function() {},
      close: function() {},
      interface: function() {
        return self.fakeInterface;
      },
      getStringDescriptor: function(arg1, cb) {
        cb();
      },
      deviceDescriptor: {
        iSerialNumber: 'blah',
      }
    });
    this.openDevice = this.sandbox.spy(this.usbConnection.device, 'open');
    this.interface = this.sandbox.spy(this.usbConnection.device, 'interface');
    this.claim = this.sandbox.spy(this.fakeInterface, 'claim');
    this.setAltSetting = this.sandbox.spy(this.fakeInterface, 'setAltSetting');
    this.getStringDescriptor = this.sandbox.spy(this.usbConnection.device, 'getStringDescriptor');
    this.daemonRegister = this.sandbox.spy(Daemon, 'register');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  standardOpen: function(test) {
    test.expect(11);

    this.usbConnection.open()
      .then(() => {
        test.ok(this.openDevice.calledOnce);
        test.ok(this.interface.calledOnce);
        test.ok(this.interface.alwaysCalledWith(0));
        test.ok(this.claim.calledOnce);
        test.ok(this.setAltSetting.calledTwice);
        test.equal(this.setAltSetting.firstCall.args[0], 0);
        test.equal(this.setAltSetting.secondCall.args[0], 2);
        test.ok(this.getStringDescriptor.calledOnce);
        test.ok(this.daemonRegister.calledOnce);
        test.equal(this.closeFunc.called, false);
        test.ok(this.usbConnection.epIn.startPoll.calledOnce);
        test.done();
      })
      .catch(function() {
        // It should not error
        test.fail();
      });
  },

  setAltSettingFails: function(test) {
    test.expect(9);

    this.connectionAltSetting = this.sandbox.stub(this.usbConnection, 'setAltSetting').returns(Promise.reject('bad usb things'));

    this.usbConnection.open()
      .then(() => {
        // It should not succeed
        test.fail();
      })
      .catch((err) => {
        test.ok(err);
        test.ok(this.openDevice.calledOnce);
        test.equal(this.interface.called, true);
        test.equal(this.claim.called, true);
        test.equal(this.setAltSetting.called, false);
        test.equal(this.getStringDescriptor.called, false);
        test.equal(this.daemonRegister.called, false);
        test.equal(this.closeFunc.called, false);
        test.equal(this.usbConnection.epIn.startPoll.called, false);
        test.done();
      });
  },
  multipleOpens: function(test) {
    this.daemonDeregister = this.sandbox.stub(Daemon, 'deregister', (val, cb) => {
      // deregister was a success
      cb();
    });

    this.usbConnection.open()
      .then(() => test.ok(this.usbConnection.closed === false))
      .then(() => this.usbConnection.end())
      .then(() => test.ok(this.usbConnection.closed === true))
      .then(() => this.usbConnection.open())
      .then(() => test.ok(this.usbConnection.closed === false))
      .then(() => test.done());
  },

};

exports['USB.Connection.prototype.end'] = {
  setUp: function(done) {
    var self = this;
    this.sandbox = sinon.sandbox.create();
    this.err = this.sandbox.stub(logs, 'err');
    this.processExit = this.sandbox.stub(process, 'exit');
    this.usbConnection = new USB.Connection({});
    this.usbConnection.epOut = new Emitter();
    this.usbConnection.epOut.transfer = this.sandbox.spy();
    this.usbConnection.epIn = new Emitter();
    this.usbConnection.epIn.startPoll = this.sandbox.spy();
    this.usbConnection.epIn.stopPoll = function(cb) {
      cb();
    };
    this.closeFunc = this.sandbox.spy(this.usbConnection, '_close');
    this.fakeInterface = {
      claim: function() {},
      setAltSetting: function(arg1, cb) {
        cb();
      },
      release: function(val, cb) {
        cb();
      },
      endpoints: [self.usbConnection.epIn, self.usbConnection.epOut],
    };
    this.sandbox.stub(this.usbConnection, 'device', {
      open: function() {},
      close: function() {},
      interface: function() {
        return self.fakeInterface;
      },
      getStringDescriptor: function(arg1, cb) {
        cb();
      },
      deviceDescriptor: {
        iSerialNumber: 'blah',
      }
    });
    this.openDevice = this.sandbox.spy(this.usbConnection.device, 'open');
    this.interface = this.sandbox.spy(this.usbConnection.device, 'interface');
    this.claim = this.sandbox.spy(this.fakeInterface, 'claim');
    this.setAltSetting = this.sandbox.spy(this.fakeInterface, 'setAltSetting');
    this.getStringDescriptor = this.sandbox.spy(this.usbConnection.device, 'getStringDescriptor');
    this.daemonRegister = this.sandbox.spy(Daemon, 'register');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  deregisterFailNoClose: function(test) {
    test.expect(2);

    this.daemonDeregister = this.sandbox.stub(Daemon, 'deregister', (val, cb) => {
      cb('some error');
    });
    this.usbConnection.open()
      .then(() => this.usbConnection.end())
      .then(() => {
        // It should not succeed
        test.fail('End resolved even with failed deregister');
        test.done();
      })
      .catch(() => {
        test.equal(this.daemonDeregister.called, true);
        test.equal(this.closeFunc.called, false);
        test.done();
      });
  },
  resolveWaitOnClose: function(test) {
    test.expect(3);

    this.daemonDeregister = this.sandbox.stub(Daemon, 'deregister', (val, cb) => {
      // deregister was a success
      cb();
    });

    var waited = false;
    this.closeFunc.restore();
    this.closeFunc = this.sandbox.stub(this.usbConnection, '_close', (cb) => {
      waited = true;
      setImmediate(cb);
    });

    this.usbConnection.open()
      .then(() => this.usbConnection.end())
      .then(() => {
        test.equal(this.daemonDeregister.called, true);
        // We did call the close function this time
        test.equal(this.closeFunc.called, true);
        test.equal(waited, true);
        test.done();
      })
      .catch(() => {
        // It should not succeed
        test.fail('proper connection.end should not fail');
        test.done();
      });
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
