// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');
/*global log, npmlog */

exports['log'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.npmlog = {
      basic: this.sandbox.stub(npmlog, 'basic'),
      error: this.sandbox.stub(npmlog, 'error'),
      info: this.sandbox.stub(npmlog, 'info'),
      http: this.sandbox.stub(npmlog, 'http'),
      warn: this.sandbox.stub(npmlog, 'warn'),
      // trace: this.sandbox.stub(npmlog, 'trace'),
    };

    this.format = this.sandbox.spy(util, 'format');
    log.enable();
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  usage: {
    basic: function(test) {
      test.expect(3);
      log.basic('basic message');
      test.equal(this.npmlog.basic.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.basic.lastCall.args, ['', 'basic message']);
      test.done();
    },
    error: function(test) {
      test.expect(3);
      log.error('error message');
      test.equal(this.npmlog.error.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.error.lastCall.args, ['', 'error message']);
      test.done();
    },
    info: function(test) {
      test.expect(3);
      log.info('info message');
      test.equal(this.npmlog.info.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.info.lastCall.args, ['', 'info message']);
      test.done();
    },
    http: function(test) {
      test.expect(3);
      log.http('http message');
      test.equal(this.npmlog.http.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.http.lastCall.args, ['', 'http message']);
      test.done();
    },
    warn: function(test) {
      test.expect(3);
      log.warn('warn message');
      test.equal(this.npmlog.warn.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.warn.lastCall.args, ['', 'warn message']);
      test.done();
    },
  },
  disableAll: {
    setUp: function(done) {
      log.disable();
      done();
    },
    tearDown: function(done) {
      log.enable();
      done();
    },
    basic: function(test) {
      test.expect(1);
      log.basic('basic message');
      test.equal(this.npmlog.basic.callCount, 0);
      test.done();
    },
    error: function(test) {
      test.expect(1);
      log.error('error message');
      test.equal(this.npmlog.error.callCount, 0);
      test.done();
    },
    info: function(test) {
      test.expect(1);
      log.info('info message');
      test.equal(this.npmlog.info.callCount, 0);
      test.done();
    },
    http: function(test) {
      test.expect(1);
      log.http('http message');
      test.equal(this.npmlog.http.callCount, 0);
      test.done();
    },
    warn: function(test) {
      test.expect(1);
      log.warn('warn message');
      test.equal(this.npmlog.warn.callCount, 0);
      test.done();
    },
  },
  enableAll: {
    setUp: function(done) {
      log.enable();
      done();
    },
    tearDown: function(done) {
      log.disable();
      done();
    },
    basic: function(test) {
      test.expect(1);
      log.basic('basic message');
      test.equal(this.npmlog.basic.callCount, 1);
      test.done();
    },
    error: function(test) {
      test.expect(1);
      log.error('error message');
      test.equal(this.npmlog.error.callCount, 1);
      test.done();
    },
    info: function(test) {
      test.expect(1);
      log.info('info message');
      test.equal(this.npmlog.info.callCount, 1);
      test.done();
    },
    http: function(test) {
      test.expect(1);
      log.http('http message');
      test.equal(this.npmlog.http.callCount, 1);
      test.done();
    },
    warn: function(test) {
      test.expect(1);
      log.warn('warn message');
      test.equal(this.npmlog.warn.callCount, 1);
      test.done();
    },
  },

  configure: {
    setUp: function(done) {
      log.enable();
      done();
    },

    basic: function(test) {
      test.expect(1);
      log.configure({
        basic: false,
      });
      log.basic('basic message');
      log.configure({
        basic: true,
      });
      log.basic('basic message');

      test.equal(this.npmlog.basic.callCount, 1);
      test.done();
    },
    error: function(test) {
      test.expect(1);
      log.configure({
        error: false,
      });
      log.error('error message');
      log.configure({
        error: true,
      });
      log.error('error message');

      test.equal(this.npmlog.error.callCount, 1);
      test.done();
    },
    info: function(test) {
      test.expect(1);
      log.configure({
        info: false,
      });
      log.info('info message');
      log.configure({
        info: true,
      });
      log.info('info message');

      test.equal(this.npmlog.info.callCount, 1);
      test.done();
    },
    http: function(test) {
      test.expect(1);
      log.configure({
        http: false,
      });
      log.http('http message');
      log.configure({
        http: true,
      });
      log.http('http message');

      test.equal(this.npmlog.http.callCount, 1);
      test.done();
    },
    warn: function(test) {
      test.expect(1);
      log.configure({
        warn: false,
      });
      log.warn('warn message');
      log.configure({
        warn: true,
      });
      log.warn('warn message');

      test.equal(this.npmlog.warn.callCount, 1);
      test.done();
    },
  },

};

exports['log.isEnabled/isDisabled'] = {
  setUp: function(done) {
    done();
  },
  tearDown: function(done) {
    done();
  },
  basic: function(test) {
    test.expect(6);
    test.equal(log.isDisabled('basic'), false);
    test.equal(log.isEnabled('basic'), true);
    log.configure({
      basic: false,
    });
    test.equal(log.isDisabled('basic'), true);
    test.equal(log.isEnabled('basic'), false);
    log.configure({
      basic: true,
    });
    test.equal(log.isDisabled('basic'), false);
    test.equal(log.isEnabled('basic'), true);
    test.done();
  },
  error: function(test) {
    test.expect(6);
    test.equal(log.isDisabled('error'), false);
    test.equal(log.isEnabled('error'), true);
    log.configure({
      error: false,
    });
    test.equal(log.isDisabled('error'), true);
    test.equal(log.isEnabled('error'), false);
    log.configure({
      error: true,
    });
    test.equal(log.isDisabled('error'), false);
    test.equal(log.isEnabled('error'), true);
    test.done();
  },
  info: function(test) {
    test.expect(6);
    test.equal(log.isDisabled('info'), false);
    test.equal(log.isEnabled('info'), true);
    log.configure({
      info: false,
    });
    test.equal(log.isDisabled('info'), true);
    test.equal(log.isEnabled('info'), false);
    log.configure({
      info: true,
    });
    test.equal(log.isDisabled('info'), false);
    test.equal(log.isEnabled('info'), true);
    test.done();
  },
  http: function(test) {
    test.expect(6);
    test.equal(log.isDisabled('http'), false);
    test.equal(log.isEnabled('http'), true);
    log.configure({
      http: false,
    });
    test.equal(log.isDisabled('http'), true);
    test.equal(log.isEnabled('http'), false);
    log.configure({
      http: true,
    });
    test.equal(log.isDisabled('http'), false);
    test.equal(log.isEnabled('http'), true);
    test.done();
  },
  warn: function(test) {
    test.expect(6);
    test.equal(log.isDisabled('warn'), false);
    test.equal(log.isEnabled('warn'), true);
    log.configure({
      warn: false,
    });
    test.equal(log.isDisabled('warn'), true);
    test.equal(log.isEnabled('warn'), false);
    log.configure({
      warn: true,
    });
    test.equal(log.isDisabled('warn'), false);
    test.equal(log.isEnabled('warn'), true);
    test.done();
  },
};

exports['log.spinner'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();

    this.spinnerCount = 0;
    this.charSpinner = this.sandbox.stub(log, 'charSpinner', () => this.spinnerCount++);
    this.clearInterval = this.sandbox.stub(global, 'clearInterval');
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    log.spinner.interval = null;
    log.configure({
      spinner: true
    });
    done();
  },
  usage: function(test) {
    test.expect(3);
    test.equal(log.spinner.interval, null);
    log.spinner.start();
    test.notEqual(log.spinner.interval, null);
    log.spinner.stop();
    test.equal(log.spinner.interval, null);
    test.done();
  },
  disable: function(test) {
    test.expect(2);
    test.equal(log.spinner.interval, null);
    log.configure({
      spinner: false,
    });
    log.spinner.start();
    test.equal(log.spinner.interval, null);
    test.done();
  },
  startMakesCharSpinner: function(test) {
    test.expect(2);
    test.equal(log.spinner.interval, null);
    log.spinner.start();
    test.equal(this.charSpinner.callCount, 1);
    test.done();
  },
  duplicateStartIsNoop: function(test) {
    test.expect(4);
    test.equal(log.spinner.interval, null);
    log.spinner.start();
    test.equal(this.charSpinner.callCount, 1);
    log.spinner.start();
    test.equal(this.charSpinner.callCount, 1);
    log.spinner.start();
    test.equal(this.charSpinner.callCount, 1);
    test.done();
  },
  stopClearsCharSpinner: function(test) {
    test.expect(2);
    log.spinner.interval = Math.PI;
    log.spinner.stop();
    test.equal(this.clearInterval.callCount, 1);
    test.equal(log.spinner.interval, null);
    test.done();
  },
  duplicateStopIsNoop: function(test) {
    test.expect(4);
    log.spinner.interval = Math.PI;
    log.spinner.stop();
    test.equal(this.clearInterval.callCount, 1);
    test.equal(log.spinner.interval, null);
    log.spinner.stop();
    test.equal(this.clearInterval.callCount, 1);
    log.spinner.stop();
    test.equal(this.clearInterval.callCount, 1);
    test.done();
  },
};
