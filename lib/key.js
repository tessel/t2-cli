var provision = require('./tessel/provision');

module.exports = function() {
  return provision.setupLocal();
};
