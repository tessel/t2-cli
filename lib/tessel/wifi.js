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

Tessel.prototype.getIPAddress = function(callback) {
  var self = this;

  // If we're already connected over LAN
  if (self.connection.connectionType === "LAN") {
    // Return the IP Address
    return callback && callback(null, self.connection.ip);
  }

  self.connection.exec(commands.connectedNetworkStatus(), function (err, streams) {
    if (err) return callback && callback(err);

    var resultsJSON = '';

    // Gather the results
    streams.stdin.on('data', function(d) {
      resultsJSON += d;
    });

    // Wait for the transfer to finish...
    streams.stdin.once('finish', function() {
      var status;
      var someFound = false;

      // Parse the response
      try {
        status = JSON.parse(resultsJSON);
      }
      catch(err) {
        streams.stdin.close();
        self.connection.end();
        callback && callback(err);
      }

      // We've finished, close the connection
      streams.stdin.close();
      self.connection.end();
      // Call the callback
      callback && callback(null, status['ipv4-address'][0].address);
    });
  });
}

Tessel.prototype.connectToNetwork = function(opts, callback) {
  var self = this;
  var ssid = opts.ssid;
  var password = opts.password;

  if (!ssid || !password) {
    return callback && callback(new Error("Invalid credentials. Must set ssid and password"));
  }

  tessel.logs.info("Setting SSID:", ssid, "and password:", password);

  self.connection.exec(commands.connectToNetwork(ssid, password), function(err, streams) {
    if (err) return callback && callback(err);

    streams.stdin.once('close', function() {
      tessel.logs.info("Credentials set!");
      self.connection.end();
      return callback && callback();
    });
  });
}