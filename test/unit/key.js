var sinon = require('sinon');
var logs = require('../../lib/logs');

exports['provision.setDefaultKey'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  // Create tests here...
};
