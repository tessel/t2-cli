var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');

exports['Tessel (endConnection)'] = {
  setUp: function(done) {

    this.mockConnection = {
      end: function() {}
    };

    this.end = sinon.spy(this.mockConnection, 'end');

    done();
  },

  tearDown: function(done) {
    this.end.restore();
    done();
  },

  sigintConnection: function(test) {
    test.expect(1);

    var processOnce = sinon.stub(process, 'once');

    new Tessel(this.mockConnection);

    var endConnection = processOnce.lastCall.args[1];

    endConnection();

    test.equal(this.end.callCount, 1);

    processOnce.restore();
    test.done();
  },

  closeConnection: function(test) {
    test.expect(2);

    var processremoveListener = sinon.stub(process, 'removeListener');
    var tessel = new Tessel(this.mockConnection);

    tessel.close();

    test.equal(processremoveListener.callCount, 1);
    test.equal(this.end.callCount, 0);

    processremoveListener.restore();
    test.done();
  },
};
