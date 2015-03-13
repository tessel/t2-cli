var fs = require('fs')
  , tessel = require('tessel')
  , ssh = require('./tessel-ssh');

function printAvailableNetworks() {
  findAvailableNetworksOverSSH(function(err, networks) {
    if (err) throw err;

    tessel.logs.info("Currently visible networks (" + networks.length + "):");

      // Print out networks
      networks.forEach(function(network) {
        tessel.logs.info("\t", network.ssid, "(" + network.quality + "/" + network.quality_max + ")");
      })
  })
}

function findAvailableNetworksOverSSH(callback) {
  tessel.logs.info('Scanning for available networks...');

  ssh.createConnection(function sshConnected(err, conn) {
    if (err) throw err;
    // Command V2 to extract a tarball it receives on stdin to the remote deploy dir
    conn.exec('ubus call iwinfo scan \'{ "device": "wlan0" }\'', function(err, rstdin) {
      // Throw any unfortunate errors
      if (err) return callback && callback(err);

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
          rstdin.close();
          conn.end();
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
        rstdin.close();
        conn.end();
        // Return the networks
        callback && callback(null, networks);
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
  // Fetch the address
  findIPAddressOverSSH(function(err, address) {
    if (err) throw err;
    // Print it out
    tessel.logs.info("IP Address:", address);
  })
}

function findIPAddressOverSSH(callback) {
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
          rstdin.close();
          conn.end();
          callback && callback(err);
        }

        // We've finished, close the connection
        conn.end();
        // Call the callback
        callback && callback(null, status['ipv4-address'][0].address);
      });
    });
  });
}

function setWiFiCredentialsOverSSH (options, callback) {
  ssh.createConnection(function(err, conn) {
    if (err) return callback && callback(err);

    var ssid = options.ssid;
    var password = options.password;

    if (!ssid || !password) {
      return callback && callback(new Error("Invalid credentials. Must set ssid and password"));
    }
    tessel.logs.info("Setting SSID: ", ssid, "and password:", password);

    var ssidCmd = "uci set wireless.@wifi-iface[0].ssid=" + ssid + ";";
    var pwdCmd = "uci set wireless.@wifi-iface[0].key=" + password + ";";
    conn.exec(ssidCmd + pwdCmd + "uci commit wireless; wifi;", function(err, stream) {
      if (err) return callback && callback(err);

      stream.close();
      conn.end();
      tessel.logs.info("Credentials set!");
    })
  })
}
module.exports.printIPAddress = printIPAddress;
module.exports.printAvailableNetworks = printAvailableNetworks
module.exports.setWiFiCredentialsOverSSH = setWiFiCredentialsOverSSH;