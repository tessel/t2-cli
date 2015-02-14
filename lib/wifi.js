var fs = require('fs')
  , tessel = require('tessel')
  , ssh = require('./tessel-ssh');

function scanForNetworks() {
  tessel.logs.info('Scanning for available networks...');

  ssh.createConnection(function sshConnected(err, conn) {
    if (err) throw err;
    // Command V2 to extract a tarball it receives on stdin to the remote deploy dir
    conn.exec('ubus call iwinfo scan \'{ "device": "wlan0" }\'', function(err, rstdin) {
      // Throw any unfortunate errors
      if (err) throw err;
      var resultsJSON = '';

      // Gather the results
      rstdin.on('data', function(d) {
        resultsJSON += d;
      });
      
      // Wait for the transfer to finish...
      rstdin.once('finish', function() {
        var networks;
        var someFound = false;

        // Parse the response
        try {
          networks = JSON.parse(resultsJSON).results;
        }
        catch(err) {
          tessel.logs.warn("Unable to parse network list from Tessel!");
          rstdin.close();
          conn.close();
        }

        // Sort by signal strength
        networks.sort(compareBySignal)

        // Remove networks without SSIDs
        networks.forEach(function(network, index) {
          if (!network.ssid) {
            networks.splice(index,1);
          }
        });

        tessel.logs.info("Currently visible networks (" + networks.length + "):");

        // Print out networks
        networks.forEach(function(network) {
          tessel.logs.info("\t", network.ssid, "(" + network.quality + "/" + network.quality_max + ")");
        })

        rstdin.close();
        conn.end();
      });
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

function printIPAddress() {
  ssh.createConnection( function sshConnected(err, conn) {
    if (err) throw err;

    conn.exec('ubus call network.interface.lan status', function (err, rstdin) {
      if (err) throw err;

      var resultsJSON = '';

      // Gather the results
      rstdin.on('data', function(d) {
        resultsJSON += d;
      });

      // Wait for the transfer to finish...
      rstdin.once('finish', function() {
        var status;
        var someFound = false;

        // Parse the response
        try {
          status = JSON.parse(resultsJSON);
        }
        catch(err) {
          tessel.logs.warn("Unable to fetch IP Address from Tessel!");
          rstdin.close();
          conn.end();
        }

        tessel.logs.info("IP Address:", status['ipv4-address'][0].address);
        conn.end();
      });
    });
  });
}

module.exports.printIPAddress = printIPAddress;
module.exports.scanForNetworks = scanForNetworks