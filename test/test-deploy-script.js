var fs = require('fs');
var ledFileName = '/sys/class/leds/tessel\:blue\:user2/trigger';


// Check if the file exists
fs.exists(ledFileName, function(exists) {
  // We're running on actual hardware
  if (exists) {
    fs.writeFile(ledFileName, 'timer', function(err) {
      if (err) {
        throw err;
      }
      console.log('Blue light should be blinking. To turn it off, run echo none > /sys/class/leds/tessel\:blue\:user2/trigger on the Tessel.');
    });
  }
  // This is running on the VM
  else {

    var state = 'on';

    setInterval(function() {
      console.log('If I had an actual LED, it would be', state, 'right now...');
      // Switch the LED state
      state = (state === 'on' ? 'off' : 'on');
    }, 1000);
  }
});
