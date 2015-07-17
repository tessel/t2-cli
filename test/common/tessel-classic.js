module.exports = {
  analyzeScript: function(entrypoint) {
    return {
      pushdir: entrypoint.indexOf('fail.js') > -1 ? 'fail' : 'test',
      relpath: 'unit/tmp/app.js',
      files: {
        'file.js': '/test/file.js'
      },
      size: 0
    };
  },
  tarCode: function(dir, opts, callback) {
    if (dir === 'fail') {
      callback(new Error());
    } else {
      callback(null, new Buffer('console.log("testing deploy");'));
    }
  }
};
