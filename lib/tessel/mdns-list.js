var mdns = require('mdns-js')
  , _ = require('lodash')
  , Promise = require('bluebird');


//if you have another mdns daemon running, like avahi or bonjour, uncomment following line
mdns.excludeInterface('0.0.0.0');

function list(delay){
  return new Promise(function(resolve, reject) {
    // If delay is undefined, default to 1 second
    delay = delay || 1000;

    // If delay given is not a number, reject
    if(typeof delay !== 'number'){
      reject(new Error('mdns-list.js | delay should be a number'));
      return;
    }

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
    browser.once('ready', function(){
      try {
        // Start discovering Tessels
        browser.discover();
      } catch(error) {
        // Return if there was an error
        return callback && callback(error);
      }

      // Otherwise, check back in after two seconds
      setTimeout(function(){
        // Stop discovering
        browser.stop();
        // Return the discovered Tessels
        resolve(tessels);
      // TODO: figure out a way to not make this a hardcoded number of seconds... just keep scanning?
      }, delay);
    });
  });
}

module.exports = list
