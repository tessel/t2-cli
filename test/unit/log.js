'use strict';

// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');
/*global log, npmlog */

exports['log'] = {
  setUp(done) {
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
  tearDown(done) {
    this.sandbox.restore();
    log.level('basic');
    done();
  },
  usage: {
    basic(test) {
      test.expect(3);
      log.basic('basic message');
      test.equal(this.npmlog.basic.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.basic.lastCall.args, ['', 'basic message']);
      test.done();
    },
    error(test) {
      test.expect(3);
      log.error('error message');
      test.equal(this.npmlog.error.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.error.lastCall.args, ['', 'error message']);
      test.done();
    },
    info(test) {
      test.expect(3);
      log.info('info message');
      test.equal(this.npmlog.info.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.info.lastCall.args, ['', 'info message']);
      test.done();
    },
    http(test) {
      test.expect(3);
      log.http('http message');
      test.equal(this.npmlog.http.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.http.lastCall.args, ['', 'http message']);
      test.done();
    },
    warn(test) {
      test.expect(3);
      log.warn('warn message');
      test.equal(this.npmlog.warn.callCount, 1);
      test.equal(this.format.callCount, 1);
      test.deepEqual(this.npmlog.warn.lastCall.args, ['', 'warn message']);
      test.done();
    },
  },
  disableAll: {
    setUp(done) {
      log.disable();
      done();
    },
    tearDown(done) {
      log.enable();
      done();
    },
    basic(test) {
      test.expect(1);
      log.basic('basic message');
      test.equal(this.npmlog.basic.callCount, 0);
      test.done();
    },
    error(test) {
      test.expect(1);
      log.error('error message');
      test.equal(this.npmlog.error.callCount, 0);
      test.done();
    },
    info(test) {
      test.expect(1);
      log.info('info message');
      test.equal(this.npmlog.info.callCount, 0);
      test.done();
    },
    http(test) {
      test.expect(1);
      log.http('http message');
      test.equal(this.npmlog.http.callCount, 0);
      test.done();
    },
    warn(test) {
      test.expect(1);
      log.warn('warn message');
      test.equal(this.npmlog.warn.callCount, 0);
      test.done();
    },
  },
  enableAll: {
    setUp(done) {
      log.enable();
      done();
    },
    tearDown(done) {
      log.disable();
      done();
    },
    basic(test) {
      test.expect(1);
      log.basic('basic message');
      test.equal(this.npmlog.basic.callCount, 1);
      test.done();
    },
    error(test) {
      test.expect(1);
      log.error('error message');
      test.equal(this.npmlog.error.callCount, 1);
      test.done();
    },
    info(test) {
      test.expect(1);
      log.info('info message');
      test.equal(this.npmlog.info.callCount, 1);
      test.done();
    },
    http(test) {
      test.expect(1);
      log.http('http message');
      test.equal(this.npmlog.http.callCount, 1);
      test.done();
    },
    warn(test) {
      test.expect(1);
      log.warn('warn message');
      test.equal(this.npmlog.warn.callCount, 1);
      test.done();
    },
  },

  configure: {
    setUp(done) {
      log.enable();
      done();
    },

    basic(test) {
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
    error(test) {
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
    info(test) {
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
    http(test) {
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
    warn(test) {
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

    throws(test) {
      test.expect(1);
      test.throws(() => {
        log.configure();
      });
      test.done();
    },
  },
  level(test) {
    test.expect(3);

    test.equal(npmlog.level, 'basic');
    log.level('whatever');
    test.equal(npmlog.level, 'whatever');
    test.equal(log.level(), 'whatever');

    test.done();
  },
};

exports['log.isEnabled/isDisabled'] = {
  setUp(done) {
    done();
  },
  tearDown(done) {
    done();
  },
  basic(test) {
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
  error(test) {
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
  info(test) {
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
  http(test) {
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
  warn(test) {
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
  setUp(done) {
    this.sandbox = sinon.sandbox.create();

    this.spinnerCount = 0;
    this.charSpinner = this.sandbox.stub(log, 'charSpinner', () => this.spinnerCount++);
    this.clearInterval = this.sandbox.stub(global, 'clearInterval');
    done();
  },
  tearDown(done) {
    this.sandbox.restore();
    log.spinner.interval = null;
    log.configure({
      spinner: true
    });
    done();
  },
  usage(test) {
    test.expect(3);
    test.equal(log.spinner.interval, null);
    log.spinner.start();
    test.notEqual(log.spinner.interval, null);
    log.spinner.stop();
    test.equal(log.spinner.interval, null);
    test.done();
  },
  disable(test) {
    test.expect(2);
    test.equal(log.spinner.interval, null);
    log.configure({
      spinner: false,
    });
    log.spinner.start();
    test.equal(log.spinner.interval, null);
    test.done();
  },
  startMakesCharSpinner(test) {
    test.expect(2);
    test.equal(log.spinner.interval, null);
    log.spinner.start();
    test.equal(this.charSpinner.callCount, 1);
    test.done();
  },
  duplicateStartIsNoop(test) {
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
  stopClearsCharSpinner(test) {
    test.expect(3);
    log.charSpinner.clear = this.sandbox.stub();
    log.spinner.interval = Math.PI;
    log.spinner.stop();
    test.equal(this.clearInterval.callCount, 1);
    test.equal(log.spinner.interval, null);
    test.equal(log.charSpinner.clear.callCount, 1);

    test.done();
  },
  duplicateStopIsNoop(test) {
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


exports['log.charSpinner'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.clock = this.sandbox.useFakeTimers();
    this.stderrWrite = this.sandbox.stub(process.stderr, 'write');

    if (!process.stderr.isTTY) {
      process.stderr.isTTY = true;
    }
    done();
  },
  tearDown(done) {
    this.sandbox.restore();
    log.spinner.interval = null;
    log.configure({
      spinner: true
    });
    done();
  },
  defaults(test) {
    test.expect(7);

    log.charSpinner();

    // Jump beyond the delay
    this.clock.tick(50 * 3);

    test.equal(this.stderrWrite.lastCall.args[0], '\\\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '|\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '/\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '-\u001b[0G');

    test.equal(this.stderrWrite.callCount, 4);

    log.charSpinner.clear();

    test.equal(this.stderrWrite.lastCall.args[0], '\u001b[2K');
    test.equal(this.stderrWrite.callCount, 5);
    test.done();
  },

  cleanupTrue(test) {
    test.expect(7);

    log.charSpinner({
      cleanup: true
    });

    // Jump beyond the delay
    this.clock.tick(50 * 3);

    test.equal(this.stderrWrite.lastCall.args[0], '\\\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '|\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '/\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '-\u001b[0G');

    test.equal(this.stderrWrite.callCount, 4);

    log.charSpinner.clear();

    test.equal(this.stderrWrite.lastCall.args[0], '\u001b[2K');
    test.equal(this.stderrWrite.callCount, 5);
    test.done();
  },

  ms(test) {
    test.expect(7);

    log.charSpinner({
      ms: 10
    });

    // Jump beyond the delay
    this.clock.tick(10 * 3);

    test.equal(this.stderrWrite.lastCall.args[0], '\\\u001b[0G');
    this.clock.tick(10);
    test.equal(this.stderrWrite.lastCall.args[0], '|\u001b[0G');
    this.clock.tick(10);
    test.equal(this.stderrWrite.lastCall.args[0], '/\u001b[0G');
    this.clock.tick(10);
    test.equal(this.stderrWrite.lastCall.args[0], '-\u001b[0G');

    test.equal(this.stderrWrite.callCount, 4);

    log.charSpinner.clear();

    test.equal(this.stderrWrite.lastCall.args[0], '\u001b[2K');
    test.equal(this.stderrWrite.callCount, 5);
    test.done();
  },

  sprite(test) {
    test.expect(7);

    log.charSpinner({
      sprite: '1234'
    });

    // Jump beyond the delay
    this.clock.tick(50 * 3);

    test.equal(this.stderrWrite.lastCall.args[0], '2\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '3\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '4\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '1\u001b[0G');

    test.equal(this.stderrWrite.callCount, 4);

    log.charSpinner.clear();

    test.equal(this.stderrWrite.lastCall.args[0], '\u001b[2K');
    test.equal(this.stderrWrite.callCount, 5);
    test.done();
  },

  stream(test) {
    test.expect(7);

    log.charSpinner({
      stream: process.stderr
    });

    // Jump beyond the delay
    this.clock.tick(50 * 3);

    test.equal(this.stderrWrite.lastCall.args[0], '\\\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '|\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '/\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '-\u001b[0G');

    test.equal(this.stderrWrite.callCount, 4);

    log.charSpinner.clear();

    test.equal(this.stderrWrite.lastCall.args[0], '\u001b[2K');
    test.equal(this.stderrWrite.callCount, 5);
    test.done();
  },

  streamIsNotTTY(test) {
    test.expect(7);

    const isTTY = process.stderr.isTTY;

    process.stderr.isTTY = false;

    log.charSpinner({
      stream: process.stderr
    });

    // Jump beyond the delay
    this.clock.tick(50 * 3);

    test.equal(this.stderrWrite.lastCall.args[0], '\\\r');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '|\r');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '/\r');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '-\r');

    test.equal(this.stderrWrite.callCount, 4);

    log.charSpinner.clear();

    test.equal(this.stderrWrite.lastCall.args[0], '\r \r');
    test.equal(this.stderrWrite.callCount, 5);

    process.stderr.isTTY = isTTY;
    test.done();
  },

  delay(test) {
    test.expect(7);

    log.charSpinner({
      delay: 0
    });

    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '\\\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '|\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '/\u001b[0G');
    this.clock.tick(50);
    test.equal(this.stderrWrite.lastCall.args[0], '-\u001b[0G');

    test.equal(this.stderrWrite.callCount, 4);

    log.charSpinner.clear();

    test.equal(this.stderrWrite.lastCall.args[0], '\u001b[2K');
    test.equal(this.stderrWrite.callCount, 5);
    test.done();
  },
};
