var foo = true ? require('foo') : require('./mock-foo');

console.log(foo());
