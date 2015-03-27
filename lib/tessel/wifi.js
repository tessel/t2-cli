var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  ;

Tessel.prototype.findAvailableNetworks = function(callback) {
  var self = this;
  tessel.logs.info('Scanning for available networks...');

  self.connection.exec(commands.scanWiFi(), function(err, streams) {
    if (err) return callback && callback(err);

    var resultsJSON = '';

    // Gather the results
    streams.stdin.on('data', function(d) {
      resultsJSON += d;
    });
    
    // Wait for the transfer to finish...
    streams.stdin.once('finish', function() {
      var networks;
      var someFound = false;

      // Parse the response
      try {
        networks = JSON.parse(resultsJSON).results;
      }
      catch(err) {
        streams.stdin.close();
        self.connection.end();
        // Throw any unfortunate errors
        if (err) return callback && callback(err);
      }

      // Sort by signal strength
      networks.sort(compareBySignal)

      // Remove networks without SSIDs
      networks.forEach(function(network, index) {
        if (!network.ssid) {
          networks.splice(index,1);
        }
      });
      // Close our stream and ssh connection
      streams.stdin.close();

      self.connection.end();
      // Return the networks
      return callback && callback(null, networks);
    });
  });
}

function compareBySignal(a,b) {
  if ((a.quality/a.quality_max) > (b.quality/b.quality_max))
     return -1;
  if ((a.quality/a.quality_max) < (b.quality/b.quality_max))
    return 1;
  return 0;
}