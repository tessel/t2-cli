// Import the interface to Tessel hardware
var tessel = require('tessel');

// Turn one of the LEDs on to start.
tessel.led[2].on();

setInterval(function () {
  console.log("I'm blinking! (Press CTRL + C to stop)");
  tessel.led[2].toggle();
  tessel.led[3].toggle();
}, 100);
