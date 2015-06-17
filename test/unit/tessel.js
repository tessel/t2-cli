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
    test.expect(3);

    var length = process._events.SIGINT.length;
    var tessel = new Tessel(this.mockConnection);

    test.equal(process._events.SIGINT.length, length + 1);
    tessel.close();

    test.equal(process._events.SIGINT.length, length);
    test.equal(this.end.callCount, 0);
    test.done();
  },
};
