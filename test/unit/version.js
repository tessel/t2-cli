// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['version *'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn', function() {});
    this.info = this.sandbox.stub(log, 'info', function() {});
    this.basic = this.sandbox.stub(log, 'basic', function() {});
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    this.tessel.mockClose();

    done();
  },

  'Tessel.prototype.fetchNodeProcessVersion': function(test) {
    test.expect(3);

    this.simpleExec = this.sandbox.stub(this.tessel, 'simpleExec').returns(Promise.resolve('v4.2.1'));

    this.tessel.fetchNodeProcessVersion()
      .then(version => {
        test.equal(this.simpleExec.callCount, 1);
        test.equal(this.simpleExec.calledWith(['node', '--version']), true);
        test.equal(version, '4.2.1');
        test.done();
      })
      .catch(error => {
        test.ok(false, `properVersionReturned failed: ${error.toString()}`);
        test.done();
      });
  },

  'Tessel.prototype.fetchNodeProcessVersions': function(test) {
    test.expect(3);
    this.simpleExec = this.sandbox.stub(this.tessel, 'simpleExec').returns(Promise.resolve(JSON.stringify(processVersions)));

    this.tessel.fetchNodeProcessVersions()
      .then(version => {
        test.equal(this.simpleExec.callCount, 1);
        test.equal(this.simpleExec.calledWith(['node', '-p', 'JSON.stringify(process.versions)']), true);
        test.deepEqual(version, processVersions);
        test.done();
      })
      .catch(error => {
        test.ok(false, `properVersionReturned failed: ${error.toString()}`);
        test.done();
      });
  }
};
