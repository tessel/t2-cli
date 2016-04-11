var path = require('path');
var fs = require('fs');
var foo = require('./mock-foo');
var nested = require('./nested/another');

console.log(foo());
console.log(nested);

fs.readFile(path.normalize('node_modules/foo/package.json'), 'utf8', function(error, contents) {
  if (error) {
    process.exit(1);
  }
  console.log(contents);
  process.exit(0);
});
