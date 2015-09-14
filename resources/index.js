// Import the interface to Tessel hardware
var tessel = require('tessel');

// Set the led pins as outputs
var led1 = tessel.led[2];
var led2 = tessel.led[3];

// Set initial LED states
led1.output(1);
led2.output(0);

setInterval(function () {
    console.log("I'm blinking! (Press CTRL + C to stop)");
    // Toggle the led states
    led1.toggle();
    led2.toggle();
}, 100);
