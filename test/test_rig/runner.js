var usb_test = require('./usb_test'),
    eth_test = require('./eth_test')

module.exports.runTests = function(selectedTessel) {
  return new Promise(function(resolve, reject) {
    usb_test(selectedTessel)
    .then(eth_test);
  });
}