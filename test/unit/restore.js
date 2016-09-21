// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['Tessel.prototype.restore'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.images = {
      uboot: new Buffer('uboot'),
      squashfs: new Buffer('squashfs'),
    };
    this.status = this.sandbox.stub(restore, 'status', () => Promise.resolve(0));
    this.fetchRestore = this.sandbox.stub(updates, 'fetchRestore', () => {
      return Promise.resolve(this.images);
    });
    this.restore = this.sandbox.spy(Tessel.prototype, 'restore');
    this.tick = this.sandbox.stub(Progress.prototype, 'tick');
    this.tessel = TesselSimulator();

    this.tessel.usbConnection.device = {
      controlTransfer() {}
    };
    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  restoreWithValidateDeviceId(test) {
    test.expect(2);

    this.validateDeviceId = this.sandbox.stub(restore, 'validateDeviceId', () => Promise.resolve());
    this.transaction = this.sandbox.stub(restore, 'transaction', () => Promise.resolve());

    this.tessel.restore({})
      .then(() => {
        test.equal(this.validateDeviceId.callCount, 1);
        test.equal(this.fetchRestore.callCount, 1);
        test.done();
      });
  },

  restoreWithoutValidateDeviceId(test) {
    test.expect(2);

    this.validateDeviceId = this.sandbox.stub(restore, 'validateDeviceId', () => Promise.resolve());
    this.transaction = this.sandbox.stub(restore, 'transaction', () => Promise.resolve());

    this.tessel.restore({
        force: true
      })
      .then(() => {
        test.equal(this.validateDeviceId.callCount, 0);
        test.equal(this.fetchRestore.callCount, 1);
        test.done();
      });
  },

  restoreFetchImages(test) {
    test.expect(3);

    this.flash = this.sandbox.stub(restore, 'flash', () => Promise.resolve());
    this.transaction = this.sandbox.stub(restore, 'transaction', (usb, bytesOrCommand) => {
      if (bytesOrCommand === 0x9F) {
        return Promise.resolve(new Buffer([0x01, 0x02, 0x19]));
      }

      return Promise.resolve();
    });


    this.tessel.restore({})
      .then(() => {
        test.equal(this.fetchRestore.callCount, 1);
        test.equal(this.flash.callCount, 1);
        test.equal(this.flash.lastCall.args[1], this.images);
        test.done();
      });
  },
};

exports['restore.*'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.images = {
      uboot: new Buffer('uboot'),
      squashfs: new Buffer('squashfs'),
    };
    this.status = this.sandbox.stub(restore, 'status', () => Promise.resolve(0));
    this.fetchRestore = this.sandbox.stub(updates, 'fetchRestore', () => {
      return Promise.resolve(this.images);
    });
    this.restore = this.sandbox.spy(Tessel.prototype, 'restore');
    this.tessel = TesselSimulator();


    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  validateDeviceIdSuccess(test) {
    test.expect(1);

    this.transaction = this.sandbox.stub(restore, 'transaction', () => Promise.resolve(new Buffer([0x01, 0x02, 0x19])));

    restore.validateDeviceId({})
      .then(() => {
        test.equal(this.transaction.callCount, 1);
        test.done();
      });
  },

  validateDeviceIdFailure(test) {
    test.expect(1);

    this.transaction = this.sandbox.stub(restore, 'transaction', () => Promise.resolve(new Buffer([0x00, 0x00, 0x00])));

    restore.validateDeviceId({})
      .catch((error) => {
        test.equal(error.message, 'Invalid Device ID (Flash Memory Communication Error)');
        test.done();
      });
  },

  partitionReturnsBuffer(test) {
    test.expect(1);
    // TODO: we need more specific tests for this
    test.equal(Buffer.isBuffer(restore.partition([1], [2])), true);
    test.done();
  },

  partitionLayout(test) {
    test.expect(18);

    var uid = [randUint8(), randUint8(), randUint8(), randUint8()];
    var mac1 = [0x02, 0xA3].concat(uid);
    var mac2 = [0x02, 0xA4].concat(uid);

    var partition = restore.partition(mac1, mac2);

    test.equal(partition.length, 46);

    // TODO: Find reference
    test.equal(partition[0], 0x20);
    test.equal(partition[1], 0x76);
    test.equal(partition[2], 0x03);
    test.equal(partition[3], 0x01);

    // mac1
    test.equal(partition[4], 0x02);
    test.equal(partition[5], 0xA3);
    test.equal(partition[6], uid[0]);
    test.equal(partition[7], uid[1]);
    test.equal(partition[8], uid[2]);
    test.equal(partition[9], uid[3]);

    // Next portion is 30 bytes, all 0xFF
    test.deepEqual(partition.slice(10, 40), Array(30).fill(0xFF));

    // mac2
    test.equal(partition[40], 0x02);
    test.equal(partition[41], 0xA4);
    test.equal(partition[42], uid[0]);
    test.equal(partition[43], uid[1]);
    test.equal(partition[44], uid[2]);
    test.equal(partition[45], uid[3]);

    test.done();
  },

};

exports['restore.transaction'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.images = {
      uboot: new Buffer('uboot'),
      squashfs: new Buffer('squashfs'),
    };
    this.status = this.sandbox.stub(restore, 'status', () => Promise.resolve(0));
    this.fetchRestore = this.sandbox.stub(updates, 'fetchRestore', () => {
      return Promise.resolve(this.images);
    });
    this.restore = this.sandbox.spy(Tessel.prototype, 'restore');
    this.tessel = TesselSimulator();

    this.usb = new USB.Connection({});
    this.usb.epOut = new Emitter();
    this.usb.epOut.transfer = this.sandbox.spy((data, callback) => {
      callback(null);
    });

    this.usb.epIn = new Emitter();
    this.usb.epIn.transfer = this.sandbox.spy((data, callback) => {
      callback(null, this.usb.epIn._mockbuffer);
    });
    this.usb.epIn._mockdata = new Buffer('mockbuffer');
    this.usb.device = {
      controlTransfer() {}
    };

    this.expectedBuffer = new Buffer([0x00, 0x00, 0x00, 0x00, 0xFF]);
    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  transactionAcceptsCommandNumber(test) {
    test.expect(2);

    restore.transaction(this.usb, 0xFF).then(() => {
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);
      test.equal(this.usb.epIn.transfer.callCount, 0);
      test.done();
    });
  },

  transactionAcceptsArray(test) {
    test.expect(2);

    restore.transaction(this.usb, [0xFF]).then(() => {
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);
      test.equal(this.usb.epIn.transfer.callCount, 0);
      test.done();
    });
  },

  transactionAcceptsBuffer(test) {
    test.expect(2);

    restore.transaction(this.usb, new Buffer([0xFF])).then(() => {
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);
      test.equal(this.usb.epIn.transfer.callCount, 0);
      test.done();
    });
  },

  transactionWithReadlength(test) {
    test.expect(4);

    this.expectedBuffer[0] = 32;

    restore.transaction(this.usb, 0xFF, 32).then(() => {
      test.equal(this.usb.epOut.transfer.callCount, 1);
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);

      test.equal(this.usb.epIn.transfer.callCount, 1);
      test.equal(this.usb.epIn.transfer.lastCall.args[0], 32);
      test.done();
    });
  },

  transactionWithReadlengthStatusPoll(test) {
    test.expect(4);

    this.expectedBuffer[0] = 32;
    this.expectedBuffer[3] = 0b00000001;

    restore.transaction(this.usb, 0xFF, 32, true).then(() => {
      test.equal(this.usb.epOut.transfer.callCount, 1);
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);

      test.equal(this.usb.epIn.transfer.callCount, 1);
      test.equal(this.usb.epIn.transfer.lastCall.args[0], 32);
      test.done();
    });
  },

  transactionWithReadlengthStatusPollWriteEnable(test) {
    test.expect(4);

    this.expectedBuffer[0] = 32;
    this.expectedBuffer[3] = 0b00000011;

    restore.transaction(this.usb, 0xFF, 32, true, true).then(() => {
      test.equal(this.usb.epOut.transfer.callCount, 1);
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);

      test.equal(this.usb.epIn.transfer.callCount, 1);
      test.equal(this.usb.epIn.transfer.lastCall.args[0], 32);
      test.done();
    });
  },

  transactionStatusPollWithoutReadlength(test) {
    test.expect(3);

    this.expectedBuffer[0] = 0;
    this.expectedBuffer[3] = 0b00000001;

    restore.transaction(this.usb, 0xFF, 0, true).then(() => {
      test.equal(this.usb.epOut.transfer.callCount, 1);
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);

      test.equal(this.usb.epIn.transfer.callCount, 0);
      test.done();
    });
  },

  transactionStatusPollWriteEnableWithoutReadlength(test) {
    test.expect(3);

    this.expectedBuffer[0] = 0;
    this.expectedBuffer[3] = 0b00000011;

    restore.transaction(this.usb, 0xFF, 0, true, true).then(() => {
      test.equal(this.usb.epOut.transfer.callCount, 1);
      test.equal(this.usb.epOut.transfer.lastCall.args[0].equals(this.expectedBuffer), true);

      test.equal(this.usb.epIn.transfer.callCount, 0);
      test.done();
    });
  },
};

exports['restore.bulkEraseFlash'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.usb = new USB.Connection({});
    this.usb.device = {
      controlTransfer() {}
    };

    this.transaction = this.sandbox.stub(restore, 'transaction', () => Promise.resolve());
    this.waitTransactionComplete = this.sandbox.stub(restore, 'waitTransactionComplete', () => Promise.resolve());

    this.tick = this.sandbox.stub(Progress.prototype, 'tick');
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  callsTransaction(test) {
    test.expect(3);
    restore.bulkEraseFlash(this.usb).then(() => {
      test.equal(this.transaction.callCount, 1);
      test.equal(this.transaction.lastCall.args[0], this.usb);
      test.equal(this.transaction.lastCall.args[1], 0x60);
      test.done();
    });
  },

  callsWaitTransactionComplete(test) {
    test.expect(2);
    restore.bulkEraseFlash(this.usb).then(() => {
      test.equal(this.waitTransactionComplete.callCount, 1);
      test.equal(this.waitTransactionComplete.lastCall.args[0], this.usb);
      test.done();
    });
  }
};

exports['restore.flash'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.images = {
      uboot: new Buffer('uboot'),
      squashfs: new Buffer('squashfs'),
    };
    this.partition = this.sandbox.spy(restore, 'partition');
    this.status = this.sandbox.stub(restore, 'status', () => Promise.resolve(0));
    this.enableWrite = this.sandbox.stub(restore, 'enableWrite', () => Promise.resolve());
    this.bulkEraseFlash = this.sandbox.stub(restore, 'bulkEraseFlash', () => Promise.resolve());
    this.write = this.sandbox.stub(restore, 'write', () => Promise.resolve());

    this.tessel = TesselSimulator();
    this.usb = new USB.Connection({});
    this.usb.epOut = new Emitter();
    this.usb.epOut.transfer = this.sandbox.spy((data, callback) => {
      callback(null);
    });

    this.usb.epIn = new Emitter();
    this.usb.epIn.transfer = this.sandbox.spy((data, callback) => {
      callback(null, this.usb.epIn._mockbuffer);
    });
    this.usb.epIn._mockdata = new Buffer('mockbuffer');

    this.tessel.usbConnection.device = {
      controlTransfer() {}
    };

    this.tick = this.sandbox.stub(Progress.prototype, 'tick');
    this.expectedBuffer = new Buffer([0x00, 0x00, 0x00, 0x00, 0xFF]);
    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  completeRestoreCallSteps(test) {
    test.expect(11);

    this.controlTransfer = this.sandbox.stub(this.tessel.usbConnection.device, 'controlTransfer');

    restore.flash(this.tessel, this.images).then(() => {
      test.equal(this.partition.callCount, 1);
      test.equal(this.enableWrite.callCount, 1);
      test.equal(this.bulkEraseFlash.callCount, 1);
      test.equal(this.write.callCount, 3);

      test.equal(this.write.getCall(0).args[1], 0);
      test.equal(this.write.getCall(0).args[2], this.images.uboot);

      test.equal(this.write.getCall(1).args[1], 0x40000);
      test.equal(this.write.getCall(1).args[2], this.images.partition);

      test.equal(this.write.getCall(2).args[1], 0x50000);
      test.equal(this.write.getCall(2).args[2], this.images.squashfs);

      test.equal(this.controlTransfer.callCount, 1);
      /*

        Take a look at other tests in this file

        - What was controlTransfer called with?

       */
      test.done();
    });
  },
};

exports['restore.write'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.images = {
      uboot: new Buffer('uboot'),
      squashfs: new Buffer('squashfs'),
    };
    this.writePage = this.sandbox.stub(restore, 'writePage', () => Promise.resolve());
    this.waitTransactionComplete = this.sandbox.stub(restore, 'waitTransactionComplete', () => Promise.resolve());
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  progress(test) {
    test.expect(3);

    this.tick = this.sandbox.stub(Progress.prototype, 'tick');

    restore.write({}, 0, new Buffer(256)).then(() => {
      test.equal(this.tick.callCount, 1);
      test.equal(this.writePage.callCount, 1);
      test.equal(this.waitTransactionComplete.callCount, 1);
      test.done();
    });
  },
};

function randUint8() {
  return Math.round(Math.random() * 255);
}


// TODO: Needs tests for restore.write, will add in follow up
