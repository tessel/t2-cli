// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

/*global CrashReporter */
/*global Preferences */

exports['CrashReporter'] = {
  surface(test) {
    test.expect(6);
    test.equal(typeof CrashReporter.on, 'function');
    test.equal(typeof CrashReporter.off, 'function');
    test.equal(typeof CrashReporter.post, 'function');
    test.equal(typeof CrashReporter.submit, 'function');
    test.equal(typeof CrashReporter.prompt, 'function');
    test.equal(typeof CrashReporter.test, 'function');
    test.done();
  },

  noProcessExceptionOrRejectionHandlers(test) {
    test.expect(1);

    var expect = process.env.CI ? 0 : 2;
    var tally = 0;

    Object.keys(process._events).forEach(key => {
      if (Array.isArray(process._events[key])) {
        process._events[key].forEach(handler => {
          if (handler.isCrashHandler) {
            tally++;
          }
        });
      } else {
        if (process._events[key].isCrashHandler) {
          tally++;
        }
      }
    });

    test.equal(tally, expect);
    test.done();
  }
};

exports['CrashReporter.on'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  onSuccess(test) {
    test.expect(1);

    CrashReporter.on().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.done();
    });
  },

  onFailure(test) {
    test.expect(2);
    this.pWrite.restore();
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.reject());

    // Despite the write failure, we don't _want_ to crash the crash reporter
    CrashReporter.on().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.equal(this.error.callCount, 1);
      test.done();
    });
  },

};

exports['CrashReporter.off'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  offSuccess(test) {
    test.expect(1);

    CrashReporter.off().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.done();
    });
  },

  offFailure(test) {
    test.expect(2);
    this.pWrite.restore();
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.reject());

    // Despite the write failure, we don't _want_ to crash the crash reporter
    CrashReporter.off().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.equal(this.error.callCount, 1);
      test.done();
    });
  },

};

exports['CrashReporter.submit'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.info = this.sandbox.stub(log, 'info');
    this.pRead = this.sandbox.stub(Preferences, 'read').returns(Promise.resolve('on'));
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    this.crPrompt = this.sandbox.stub(CrashReporter, 'prompt').returns(Promise.resolve(true));
    this.crPost = this.sandbox.spy(CrashReporter, 'post');
    this.crSanitize = this.sandbox.spy(CrashReporter, 'sanitize');
    this.request = this.sandbox.stub(request, 'post', (opts, handler) => {
      return handler(null, {}, '{}');
    });
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  submit(test) {
    test.expect(8);

    var report = 'Error: undefined is not a function';
    CrashReporter.submit(report).then(() => {
      var args = this.crPost.lastCall.args;
      test.equal(this.crPrompt.callCount, 1);
      test.equal(this.crPost.callCount, 1);
      test.equal(typeof args[0], 'string');
      test.ok(args[0].includes('CLI version'), 'Label CLI version should be present');
      test.ok(args[0].includes('Node version'), 'Label Node version should be present');
      test.ok(args[0].includes('OS platform'), 'Label OS platform should be present');
      test.ok(args[0].includes('OS release'), 'Label OS release should be present');
      test.equal(args[1], report);
      test.done();
    });
  },

  noSubmit(test) {
    test.expect(3);
    this.crPrompt.restore();
    this.crPrompt = this.sandbox.stub(CrashReporter, 'prompt').returns(Promise.resolve(false));

    var report = 'Error: undefined is not a function';
    CrashReporter.submit(report).then(() => {
      test.equal(this.crPrompt.callCount, 1);
      test.equal(this.pRead.callCount, 0);
      test.equal(this.info.lastCall.args[0], 'Did not submit crash report.');
      test.done();
    });
  },

  sanitizes(test) {
    test.expect(5);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());
    var error = new Error(`This happened at ${__dirname}. Line 1 in ${__filename}`);

    CrashReporter.submit(error).then(() => {
      test.equal(this.crSanitize.callCount, 2);
      // the actual dirname should not appear in the posted report contents
      test.equal(this.crPost.lastCall.args[0].includes(__dirname), false);
      test.equal(this.crPost.lastCall.args[0].includes(__filename), false);
      test.equal(this.crPost.lastCall.args[1].includes(__dirname), false);
      test.equal(this.crPost.lastCall.args[1].includes(__filename), false);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  optionsSilentDefaultsFalse(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened')).then(() => {
      test.equal(this.info.callCount, 1);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  optionsSilent(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened'), {
      silent: true
    }).then(() => {
      test.equal(this.info.callCount, 0);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  forwardsRealArgv(test) {
    test.expect(2);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    var argv2 = process.argv[2];
    var argv3 = process.argv[3];

    process.argv[2] = 'foo';
    process.argv[3] = 'bar';

    CrashReporter.submit(new Error('This happened'), {
      silent: true
    }).then(() => {
      test.equal(this.crPost.callCount, 1);
      test.equal(this.crPost.lastCall.args[2], 'foo, bar');
      process.argv[2] = argv2;
      process.argv[3] = argv3;
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  sanitizesRealArgv(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    var argv2 = process.argv[2];
    var argv3 = process.argv[3];

    process.argv[2] = '-password';
    process.argv[3] = '___abc123!@#$%^&*()+';

    CrashReporter.submit(new Error('This happened'), {
      silent: true,
    }).then(() => {
      test.equal(this.crPost.lastCall.args[2], '-password, ----redacted----');
      process.argv[2] = argv2;
      process.argv[3] = argv3;
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  sanitizesArgv1(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened'), {
      silent: true,
      argv: 'wifi, -n, somessid, -password, _abc123!@#$%^&*()+'
    }).then(() => {
      test.equal(this.crPost.lastCall.args[2], 'wifi, -n, somessid, -password, ----redacted----');
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  sanitizesArgv2(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened'), {
      silent: true,
      argv: 'wifi, -n, somessid, -p, _abc123!@#$%^&*()+'
    }).then(() => {
      test.equal(this.crPost.lastCall.args[2], 'wifi, -n, somessid, -p, ----redacted----');
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  sanitizesArgv3(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened'), {
      silent: true,
      argv: 'ap, -n, somessid, -password, _abc123!@#$%^&*()+'
    }).then(() => {
      test.equal(this.crPost.lastCall.args[2], 'ap, -n, somessid, -password, ----redacted----');
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  sanitizesArgv4(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened'), {
      silent: true,
      argv: 'ap, -n, somessid, -p, _abc123!@#$%^&*()+'
    }).then(() => {
      test.equal(this.crPost.lastCall.args[2], 'ap, -n, somessid, -p, ----redacted----');
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  labelsWithConnectionType(test) {
    test.expect(7);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    // We don't need an _actual_ tessel object to test this,
    // just something that *looks like* a tessel object.
    controller.tessel = {
      connectionType: 'FOO'
    };

    CrashReporter.submit(new Error('This happened'), {
      silent: true,
      argv: ''
    }).then(() => {
      var labels = this.crPost.lastCall.args[0].split(',\n');

      test.equal(labels[0], 't2-cli');
      test.equal(labels[1].startsWith('CLI version: '), true);
      test.equal(labels[2].startsWith('Node version: '), true);
      test.equal(labels[3].startsWith('OS platform: '), true);
      test.equal(labels[4].startsWith('OS release: '), true);
      test.equal(labels[5].startsWith('Connection Type: '), true);
      test.equal(labels[5].endsWith('FOO'), true);

      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  labelsWithoutConnectionType(test) {
    test.expect(6);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened'), {
      silent: true,
      argv: ''
    }).then(() => {
      var labels = this.crPost.lastCall.args[0].split(',\n');

      test.equal(labels[0], 't2-cli');
      test.equal(labels[1].startsWith('CLI version: '), true);
      test.equal(labels[2].startsWith('Node version: '), true);
      test.equal(labels[3].startsWith('OS platform: '), true);
      test.equal(labels[4].startsWith('OS release: '), true);
      test.equal(labels.indexOf('Connection Type: '), -1);

      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },
};


exports['CrashReporter.sanitize'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.info = this.sandbox.stub(log, 'info');
    this.pRead = this.sandbox.stub(Preferences, 'read').returns(Promise.resolve('on'));
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    this.crPrompt = this.sandbox.stub(CrashReporter, 'prompt').returns(Promise.resolve(true));
    this.crPost = this.sandbox.spy(CrashReporter, 'post');
    this.request = this.sandbox.stub(request, 'post', (opts, handler) => {
      return handler(null, {}, '{}');
    });
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  dirname(test) {
    test.expect(2);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    var error = new Error(`This happened at ${__dirname}. Line 1 in ${__filename}`);

    CrashReporter.submit(error).then(() => {
      test.equal(this.crPost.lastCall.args[0].includes(__dirname), false);
      test.equal(this.crPost.lastCall.args[1].includes(__dirname), false);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  filename(test) {
    test.expect(2);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    var error = new Error(`This happened at ${__dirname}. Line 1 in ${__filename}`);

    CrashReporter.submit(error).then(() => {
      test.equal(this.crPost.lastCall.args[0].includes(__filename), false);
      test.equal(this.crPost.lastCall.args[1].includes(__filename), false);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  home(test) {
    test.expect(2);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    var error = new Error(`permission denied, open '${path.join(os.homedir(), '.config')}'`);

    CrashReporter.submit(error).then(() => {
      test.equal(this.crPost.lastCall.args[0].includes(os.homedir()), false);
      test.equal(this.crPost.lastCall.args[1].includes(os.homedir()), false);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },
};

exports['CrashReporter.post'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.info = this.sandbox.stub(log, 'info');
    this.pRead = this.sandbox.stub(Preferences, 'read').returns(Promise.resolve('on'));
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    this.crPost = this.sandbox.spy(CrashReporter, 'post');
    this.crFingerPrint = '0xabcd';
    var crPostResponse = {
      crash_report: {
        fingerprint: this.crFingerPrint
      }
    };
    this.request = this.sandbox.stub(request, 'post', (opts, handler) => {
      return handler(null, {}, JSON.stringify(crPostResponse));
    });
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  post(test) {
    test.expect(5);

    var labels = 'foo';
    var report = 'Error: undefined is not a function';

    CrashReporter.post(labels, report).then(fingerprint => {
      var args = this.request.lastCall.args;
      test.equal(this.request.callCount, 1);
      test.equal(args[0].form.crash, report);
      test.equal(args[0].form.labels, labels);
      test.equal(args[0].form.f, 'json');
      test.equal(fingerprint, this.crFingerPrint);
      test.done();
    });
  },

  postError(test) {
    test.expect(2);

    var labels = 'foo';
    var report = 'Error: undefined is not a function';

    this.request.restore();
    this.request = this.sandbox.stub(request, 'post', (opts, handler) => {
      return handler(new Error('Bogus'));
    });

    CrashReporter.post(labels, report).catch(error => {
      test.equal(this.request.callCount, 1);
      test.equal(error.toString(), 'Error: Bogus');
      test.done();
    });
  },

  postWithBadResponse(test) {
    test.expect(2);

    this.request.restore();
    this.request = this.sandbox.stub(request, 'post', (opts, handler) => {
      return handler(null, {}, '** {Bad Response} **');
    });

    var message = 'Bad response should have caused a failure';
    CrashReporter.post().then(() => {
      test.ok(false, message);
      test.done();
    }).catch(error => {
      test.notEqual(error, null, 'Error cannot be null');
      test.ok(true, message);
      test.done();
    });
  },

  postWithGoodResponseThatSignifiesAnError(test) {
    test.expect(1);

    this.request.restore();
    this.request = this.sandbox.stub(request, 'post', (opts, handler) => {
      return handler(null, {}, '{"error": "Strange things are afoot at the Circle-K"}');
    });

    var message = 'Bad response should have caused a failure';
    CrashReporter.post().then(() => {
      test.ok(false, message);
      test.done();
    }).catch(error => {
      test.equal(error.toString(), 'Strange things are afoot at the Circle-K');
      test.done();
    });
  },
};

exports['CrashReporter.status'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.info = this.sandbox.stub(log, 'info');
    this.prefLoad = this.sandbox.stub(Preferences, 'load', () => {
      return Promise.resolve({
        'crash.reporter.preference': 'on'
      });
    });
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  status(test) {
    test.expect(1);

    CrashReporter.status().then(() => {
      test.equal(this.info.callCount, 1);
      test.done();
    });
  },
};

exports['CrashReporter.test'] = {
  setUp(done) {
    done();
  },

  tearDown(done) {
    done();
  },

  returnsRejectedPromise(test) {
    test.expect(1);
    CrashReporter.test().catch(error => {
      test.equal(error.toString(), 'Error: Testing the crash reporter');
      test.done();
    });
  },
};

exports['CrashReporter.onerror'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.submit = this.sandbox.stub(CrashReporter, 'submit', (stack) => {
      return Promise.resolve(stack);
    });

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  logsAndReturnsPromise(test) {
    test.expect(2);
    CrashReporter.onerror(new Error('Whatever')).then(stack => {
      test.equal(this.error.lastCall.args[0], 'Detected CLI crash');
      test.equal(this.error.lastCall.args[1].toString(), 'Error: Whatever');
      test.done();
    });
  },
};

exports['CrashReporter.prompt'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');

    // Because these are stored as strings...
    this.prefValue = 'true';
    this.prefRead = this.sandbox.stub(Preferences, 'read', (key, defaultValue) => {
      return Promise.resolve(this.prefValue);
    });
    this.selected = true;
    this.menuPrompt = this.sandbox.stub(Menu, 'prompt', (config) => {
      return Promise.resolve({
        selected: this.selected
      });
    });

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  reportingStateIsTrue(test) {
    test.expect(1);
    CrashReporter.prompt().then(reportState => {
      test.equal(reportState, true);
      test.done();
    });
  },

  reportingStateIsFalse(test) {
    test.expect(1);

    // Because these are stored as strings...
    this.prefValue = 'false';

    CrashReporter.prompt().then(reportState => {
      // It's not a first time crash, proceed
      test.equal(reportState, true);
      test.done();
    });
  },

  reportingStateIsTrueSelectedFalse(test) {
    test.expect(1);

    this.selected = false;
    CrashReporter.prompt().then(reportState => {
      test.equal(reportState, false);
      test.done();
    });
  },
};
