var mdns = require('mdns-js');
var _ = require('lodash');

//if you have another mdns daemon running, like avahi or bonjour, uncomment following line
mdns.excludeInterface('0.0.0.0');

var browser = mdns.createBrowser('_tessel._tcp');
var tessels = [];

browser.on('update', function (data) {
  if( _.findIndex(tessels, data) > -1){
    return;
  }
  tessels.push(data);
});

function list(callback){
  browser.on('ready', function(){
    try {
      browser.discover();
    } catch(error) {
      callback(error);
    }
    setTimeout(function(){
      if(tessels.length){
        callback(null, tessels);
        return;
      }
      callback(tessels)
      browser.stop();
    }, 2000);
    return;
  })
}

module.exports = list
