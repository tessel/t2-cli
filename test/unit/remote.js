// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');


exports['remote.* consts'] = {
  setUp(done) {
    done();
  },

  tearDown(done) {
    done();
  },

  all(test) {
    test.expect(4);
    test.equal(remote.CRASH_REPORTER_HOSTNAME, 'crash-reporter.tessel.io');
    test.equal(remote.BUILDS_HOSTNAME, 'builds.tessel.io');
    test.equal(remote.PACKAGES_HOSTNAME, 'packages.tessel.io');
    test.equal(remote.RUSTCC_HOSTNAME, 'rustcc.tessel.io');
    test.done();
  },
};

exports['remote.ifReachable(...)'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn');
    this.logInfo = this.sandbox.stub(log, 'info');
    this.logBasic = this.sandbox.stub(log, 'basic');

    this.error = null;
    this.lookup = this.sandbox.stub(dns, 'lookup').callsFake((hostname, handler) => {
      handler(this.error);
    });
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  success(test) {
    test.expect(2);
    remote.ifReachable('foo.bar.baz').then(() => {
      test.equal(this.lookup.callCount, 1);
      test.equal(this.lookup.lastCall.args[0], 'foo.bar.baz');
      test.done();
    });
  },

  failure(test) {
    test.expect(3);
    this.error = new Error('ENOTFOUND');
    remote.ifReachable('foo.bar.baz').then(() => {
      test.ok(false, 'This should not have been reached.');
      test.done();
    }).catch(error => {
      test.equal(error.message, 'This operation requires an internet connection');
      test.equal(this.lookup.callCount, 1);
      test.equal(this.lookup.lastCall.args[0], 'foo.bar.baz');
      test.done();
    });
  },
};
