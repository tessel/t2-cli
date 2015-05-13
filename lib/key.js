var provision = require('./tessel/provision')
  , Promise = require('bluebird')
  ;

module.exports = function() {
  return new Promise(function(resolve, reject) {
    provision.setupLocal(function(err, created) {
      if (!created) {
        reject(new Error('Key already exists. No new key created.'));
      } else {
        resolve();
      }
    });
  });
};
