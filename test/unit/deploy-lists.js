// Test dependencies are required and exposed in common/bootstrap.js

exports['deploy-lists'] = {
  setUp: function(done) {
    done();
  },

  tearDown: function(done) {
    done();
  },

  checkIncludes: function(test) {
    test.expect(1);

    var includes = [
      'negotiator/**/*.js',
      'socket.io-client/socket.io.js',
      'mime/types/*.types'
    ];

    test.deepEqual(deployLists.includes, includes);
    test.done();
  }
};
