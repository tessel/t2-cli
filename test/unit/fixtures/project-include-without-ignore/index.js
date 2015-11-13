var path = require('path');
var fs = require('fs');
var foo = true ? require('foo') : require('./mock-foo');

console.log(foo());

fs.readFile(path.normalize('node_modules/foo/package.json'), 'utf8', function(error, contents) {
  if (error) {
    process.exit(1);
  }
  console.log(contents);
  process.exit(0);
});
