var setup = require('./tessel/setup');

module.exports = function(opts) {
  return new Promise( function (resolve, reject) {
    setup.setupLocal(function(err, created) {
      if (!created) {
        reject(new Error('Key already exists. No new key created.'));
      }
      else {
        resolve();
      }
    });
  });
}