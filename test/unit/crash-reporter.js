/*global CrashReporter */
/*global Preferences */

exports['CrashReporter'] = {
  surface: function(test) {
    test.expect(5);
    test.equal(typeof CrashReporter.on, 'function');
    test.equal(typeof CrashReporter.off, 'function');
    test.equal(typeof CrashReporter.post, 'function');
    test.equal(typeof CrashReporter.submit, 'function');
    test.equal(typeof CrashReporter.test, 'function');
    test.done();
  },

  noProcessExceptionOrRejectionHandlers: function(test) {
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
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsErr = this.sandbox.stub(logs, 'err');
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  onSuccess: function(test) {
    test.expect(1);

    CrashReporter.on().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.done();
    });
  },

  onFailure: function(test) {
    test.expect(2);
    this.pWrite.restore();
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.reject());

    // Despite the write failure, we don't _want_ to crash the crash reporter
    CrashReporter.on().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.equal(this.logsErr.callCount, 1);
      test.done();
    });
  },

};

exports['CrashReporter.off'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsErr = this.sandbox.stub(logs, 'err');
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  offSuccess: function(test) {
    test.expect(1);

    CrashReporter.off().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.done();
    });
  },

  offFailure: function(test) {
    test.expect(2);
    this.pWrite.restore();
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.reject());

    // Despite the write failure, we don't _want_ to crash the crash reporter
    CrashReporter.off().then(() => {
      test.equal(this.pWrite.callCount, 1);
      test.equal(this.logsErr.callCount, 1);
      test.done();
    });
  },

};

exports['CrashReporter.submit'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsErr = this.sandbox.stub(logs, 'err');
    this.logsInfo = this.sandbox.stub(logs, 'info');
    this.pRead = this.sandbox.stub(Preferences, 'read').returns(Promise.resolve('on'));
    this.pWrite = this.sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    this.crPost = this.sandbox.spy(CrashReporter, 'post');
    this.request = this.sandbox.stub(request, 'post', (opts, handler) => {
      return handler(null, {}, '{}');
    });
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  submit: function(test) {
    test.expect(7);

    var report = 'Error: undefined is not a function';
    CrashReporter.submit(report).then(() => {
      var args = this.crPost.lastCall.args;
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

  removesIrrelevantPathData: function(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened')).then(() => {
      // the actual dirname should not appear in the posted report contents
      test.equal(this.crPost.lastCall.args[0].includes(__dirname), false);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  optionsSilentDefaultsFalse: function(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened')).then(() => {
      test.equal(this.logsInfo.callCount, 1);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

  optionsSilent: function(test) {
    test.expect(1);

    this.crPost.restore();
    this.crPost = this.sandbox.stub(CrashReporter, 'post').returns(Promise.resolve());

    CrashReporter.submit(new Error('This happened'), {
      silent: true
    }).then(() => {
      test.equal(this.logsInfo.callCount, 0);
      test.done();
    }).catch(error => {
      test.ok(false, error.message);
      test.done();
    });
  },

};

exports['CrashReporter.post'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsErr = this.sandbox.stub(logs, 'err');
    this.logsInfo = this.sandbox.stub(logs, 'info');
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

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  post: function(test) {
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

  postWithBadResponse: function(test) {
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
};

exports['CrashReporter.status'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsInfo = this.sandbox.stub(logs, 'info');
    this.prefLoad = this.sandbox.stub(Preferences, 'load', () => {
      return Promise.resolve({
        'crash.reporter.preference': 'on'
      });
    });
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  status: function(test) {
    test.expect(1);

    CrashReporter.status().then(() => {
      test.equal(this.logsInfo.callCount, 1);
      test.done();
    });
  },
};
