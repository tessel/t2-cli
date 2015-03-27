var mdns = require('mdns-js');
var _ = require('lodash');

//if you have another mdns daemon running, like avahi or bonjour, uncomment following line
mdns.excludeInterface('0.0.0.0');

function list(callback){
  // Initial list of Tessels
  var tessels = [];

  // Create a Tessel browser
  var browser = mdns.createBrowser('_tessel._tcp');

  // When the browser finds a new device
  browser.on('update', function (data) {
    // Check if it's a Tessel
    if( _.findIndex(tessels, data) > -1){
      return;
    }
    // Push it to our array
    tessels.push(data);
  });

  // When the browser becomes ready
  browser.on('ready', function(){
    try {
      // Start discovering Tessels
      browser.discover();
    } catch(error) {
      // Return if there was an error
      return callback && callback(error);
    }

    // Otherwise, check back in after two seconds
    setTimeout(function(){
      // Return the discovered Tessels
      callback && callback(null, tessels)
      // Stop discovering
      browser.stop();
    // TODO: figure out a way to not make this a hardcoded number of seconds... just keep scanning?
    }, 1000);
  })
}

module.exports = list
