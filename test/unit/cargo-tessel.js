// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

/*global CrashReporter */

exports['Cargo Subcommand (cargo tessel ...)'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.info = this.sandbox.stub(log, 'info');
    this.error = this.sandbox.stub(log, 'error');
    this.parse = this.sandbox.spy(cargo.nomnom, 'parse');
    this.runBuild = this.sandbox.stub(rust, 'runBuild').returns(Promise.resolve());

    done();
  },
  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  build: function(test) {
    // test.expect(3);

    var tarball = new Buffer([0x00]);
    var buildOp = Promise.resolve(tarball);

    // Prevent the tarball from being logged
    this.sandbox.stub(console, 'log');

    this.runBuild.returns(buildOp);

    cargo(['build']);

    buildOp.then(() => {
      test.equal(console.log.callCount, 1);
      test.equal(console.log.lastCall.args[0], tarball);
      test.deepEqual(this.parse.lastCall.args, [['build']]);
      test.deepEqual(this.runBuild.lastCall.args, [ { isCli: false, binary: undefined } ]);
      test.done();
    });
  }
};
