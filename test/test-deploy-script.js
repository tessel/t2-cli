console.log('running this code on V2!');

var fs = require('fs');
fs.writeFile('/sys/class/leds/tessel\:blue\:user2/trigger', 'timer', function (err) {
  if(err) throw err;
  console.log('Blue light should be blinking. To turn it off, run echo none > /sys/class/leds/tessel\:blue\:user2/trigger on the Tessel.');
});
