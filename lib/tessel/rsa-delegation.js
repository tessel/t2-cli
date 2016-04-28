function MockRSA() {}

MockRSA.prototype.exportKey = function() {};

module.exports = global.IS_TEST_ENV ? MockRSA : require('node-rsa');
