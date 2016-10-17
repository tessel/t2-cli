// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

// This was removed from bootstrap due to issues that surface
// when running the test suite on appveyor.
global.cargo = require('../../bin/cargo-tessel');

exports['Cargo Subcommand (cargo tessel ...)'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.info = this.sandbox.stub(log, 'info');
    this.warn = this.sandbox.stub(log, 'warn');
    this.error = this.sandbox.stub(log, 'error');
    this.parse = this.sandbox.spy(cargo.nomnom, 'parse');
    this.runBuild = this.sandbox.stub(rust, 'runBuild').returns(Promise.resolve());

    done();
  },
  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  build(test) {
    test.expect(4);

    var tarball = new Buffer([0x00]);
    var bresolve = Promise.resolve(tarball);

    // Prevent the tarball from being logged
    this.sandbox.stub(console, 'log');

    this.runBuild.returns(bresolve);

    cargo(['build']);

    bresolve.then(() => {
      test.equal(console.log.callCount, 1);
      test.equal(console.log.lastCall.args[0], tarball);
      test.deepEqual(this.parse.lastCall.args, [['build']]);
      test.deepEqual(this.runBuild.lastCall.args, [ { isCli: false, binary: undefined } ]);
      test.done();
    });
  },

  sdkInstall(test) {
    test.expect(2);

    var iresolve = Promise.resolve();

    this.install = this.sandbox.stub(rust.cargo, 'install').returns(iresolve);

    cargo.nomnom.globalOpts({subcommand: 'install'});
    cargo(['sdk', 'install']);

    iresolve.then(() => {
      test.equal(this.install.callCount, 1);
      test.deepEqual(this.install.lastCall.args[0], { '0': 'sdk', subcommand: 'install', _: [ 'sdk', 'install' ] });
      test.done();
    });
  },
  sdkUninstall(test) {
    test.expect(2);

    var iresolve = Promise.resolve();

    this.uninstall = this.sandbox.stub(rust.cargo, 'uninstall').returns(iresolve);

    cargo.nomnom.globalOpts({subcommand: 'uninstall'});
    cargo(['sdk', 'uninstall']);

    iresolve.then(() => {
      test.equal(this.uninstall.callCount, 1);
      test.deepEqual(this.uninstall.lastCall.args[0], { '0': 'sdk', subcommand: 'uninstall', _: [ 'sdk', 'uninstall' ] });
      test.done();
    });
  },
};
