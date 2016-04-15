// Test dependencies are required and exposed in common/bootstrap.js

exports['Tessel.prototype.fetchCurrentNodeVersion'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});
    this.tessel = TesselSimulator();

    this.simpleExec = this.sandbox.stub(Tessel.prototype, 'simpleExec', () => {
      return Promise.resolve('v4.2.1');
    });

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    this.tessel.mockClose();

    done();
  },

  properVersionReturned: function(test) {
    test.expect(3);

    this.tessel.fetchCurrentNodeVersion()
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
  }
};
