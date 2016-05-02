// Test dependencies are required and exposed in common/bootstrap.js

exports['deployment/lists/javascript'] = {
  setUp: function(done) {
    done();
  },

  tearDown: function(done) {
    done();
  },

  checkIncludes: function(test) {
    test.expect(1);

    var includes = [
      'aws-sdk/apis/*.json',
      'mime/types/*.types',
      'negotiator/**/*.js',
      'socket.io-client/socket.io.js',
    ];

    test.deepEqual(deployment.js.lists.includes, includes);
    test.done();
  },

  checkCompression: function(test) {
    test.expect(1);

    /*
      This test just ensures that no one accidentally
      messes up the contents of the deploy-lists file,
      specifically for the compression options field

     */
    var compressionOptions = {
      extend: {
        special: {
          rescope_after_mangle: true
        },
        compress: {
          keep_fnames: true
        },
        mangle: {}
      },
    };

    test.deepEqual(deployment.js.lists.compressionOptions, compressionOptions);
    test.done();
  }

};
