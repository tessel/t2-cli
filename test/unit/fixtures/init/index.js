const tessel = require('tessel');
const {
  2: green,
  3: blue
} = tessel.led;
green.on();
setInterval(() => {
  green.toggle();
  blue.toggle();
}, 100);

console.log(`I'm blinking! (Press CTRL + C to stop)`);
