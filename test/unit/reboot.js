// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['reboot *'] = {
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
    this.tessel.mockClose();
    this.sandbox.restore();

    done();
  },

  'Tessel.prototype.reboot': function(test) {
    test.expect(2);

    this.simpleExec = this.sandbox.stub(this.tessel, 'simpleExec').returns(Promise.resolve());

    this.tessel.reboot()
      .then(() => {
        test.equal(this.simpleExec.callCount, 1);
        test.equal(this.simpleExec.calledWith(['sh', '-c', 'echo 39 > /sys/class/gpio/export && echo out > /sys/class/gpio/gpio39/direction && echo 0 > /sys/class/gpio/gpio39/value && reboot']), true);
        test.done();
      });
  }
};
