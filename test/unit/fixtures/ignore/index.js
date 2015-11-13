var fs = require('fs');

fs.readFile('mock-foo.js', 'utf8', function(error, contents) {
  if (error) {
    process.exit(1);
  }
  console.log(contents);
  process.exit(0);
});
