var provision = require('./tessel/provision'),
  Promise = require('bluebird');

module.exports = function() {
  return new Promise(function(resolve, reject) {
    provision.setupLocal(function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
