var tessel = require('tessel');
var other = require('./other');

tessel.led[2].on();

setInterval(function() {
  tessel.led[2].toggle();
  tessel.led[3].toggle();
}, 100);
