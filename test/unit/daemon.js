// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

module.exports['Daemon._nextID'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  // Returns the next element in the list when ordered with no gaps
  selectSubsequentId: function(test) {
    test.expect(1);
    this.getIDsInUse = this.sandbox.stub(Daemon, 'getIDsInUse').returns([0, 1, 2]);
    var next = Daemon._nextID();
    test.equal(next, 3);
    test.done();
  },

  // Detects gaps at the front of the id array. Returns first element in gap
  selectMissingId: function(test) {
    test.expect(1);
    this.getIDsInUse = this.sandbox.stub(Daemon, 'getIDsInUse').returns([1, 2]);
    var next = Daemon._nextID();
    test.equal(next, 0);
    test.done();
  },

  // Detects gap in middle of array
  detectGapId: function(test) {
    test.expect(1);
    this.getIDsInUse = this.sandbox.stub(Daemon, 'getIDsInUse').returns([0, 1, 3]);
    var next = Daemon._nextID();
    test.equal(next, 2);
    test.done();
  },

  // Can handle out of order ids, returns next after max or first gap
  handleUnorderedIds: function(test) {
    test.expect(1);
    this.getIDsInUse = this.sandbox.stub(Daemon, 'getIDsInUse').returns([2, 3, 1]);
    var next = Daemon._nextID();
    test.equal(next, 0);
    test.done();
  },

  // Will not return a new id if we already have 255 processes running
  throwOnMaxIds: function(test) {
    test.expect(1);

    var maxIds = 255;
    var idsInUse = [];
    for (var i = 0; i < maxIds; i++) {
      idsInUse.push(i);
    }

    this.getIDsInUse = this.sandbox.stub(Daemon, 'getIDsInUse').returns(idsInUse);
    test.throws(Daemon._nextID());
    test.done();
  }
};
