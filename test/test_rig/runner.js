var usb_test = require('./usb_test'),
    eth_test = require('./eth_test')

module.exports.runTests = function(opts, selectedTessel) {
  return new Promise(function(resolve, reject) {
    // Turn all of the LEDs off, just in case
    resetLEDStates(selectedTessel)
    // Then run the USB Test
    .then(function() {
      return usb_test(opts, selectedTessel)
    })
    // Then run the Ethernet Test
    // .then(eth_test)
    // If there were no issues, resolve
    .then(resolve)
    // Otherwise
    .catch(function(err) {
      // Throw up the error LED
      selectedTessel.setRedLED(1)
      // And reject this test
      .then(function() {
        reject(err)
      })
      // If setting the red led thew an error, return that
      .catch(reject);
    })
  }); 
}

function resetLEDStates(selectedTessel) {
  return selectedTessel.setRedLED(0)
  .then(function() {
    return selectedTessel.setGreenLED(0)
  })
  .then(function() {
    return selectedTessel.setBlueLED(0)
  });
}