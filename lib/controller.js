var usb = require('./usb_connection')
  , lan = require('./lan_connection')
  , Tessel = require('./tessel/tessel')
  , async = require('async')
  , tessel = require('tessel');
  ;
    
/*
  Fetches Tessels and prints them out
    param callback: called upon completion in the form (err)
*/
function listTessels(callback) {
  // Fetch connected Tessels
  fetchTessels(function(err, tessels) {
    if (err) {
      return callback && callback(err);
    }
    else {
      // Iterate over each Tessel
      tessels.forEach(function(tessel) {
        // Print it out in a special way
        // TODO: Print it in a way that's actually useful
        if (tessel.connection.connectionType == 'USB') {
          console.log('USB CONNECTION: ', tessel.connection.serialNumber);
        }
        if (tessel.connection.connectionType == 'LAN') {
          console.log('WIFI CONNECTION: ', tessel.connection.ip);
        }
        // Call the callback and return
        return callback && callback();
      });
    }
  });
}

/*
  Find all USB and LAN Tessels
    param callback: called upon completion in the form (err, [tessels])
*/
function fetchTessels(callback) {
  // Gather USB connections
  usb.findConnections(function(err, usbConnections) {
    if (err) {
      return callback && callback(err);
    }

    // Gather LAN connections
    lan.findConnections(function(err, wifiConnections) {
      if (err) {
        return callback && callback(err);
      }
      // Concatenate our USB and LAN connections
      var tessels = wifiConnections.concat(usbConnections);

      // Turn these connections into Tessel objects
      tessels.forEach(function(connection, index) {
        tessels[index] = new Tessel(connection);
      });

      return callback && callback(err, tessels);
    });
  });
}

/*
  Returns an instance of the requested Tessel.
  If TESSEL_SERIAL env variable is set, that Tessel is returned.
  If it is not set, the first USB listed Tessel is returned.
    param opts: an object that can contain the field of serial, eg. {serial: "SOME_SERIAL"}
    param callback: called upon completion in the form (err, tessel)
*/
function getTessel(opts, callback) {
  tessel.logs.info("Connecting to Tessel...");
  // Grab all attached Tessels
  fetchTessels(function (err, tessels) {
    // Bail if there are any errors
    if (err) {
      return callback && callback(err);
    }

    if (!tessels.length) {
      tessel.logs.error("No Tessels found.");
      return callback && callback();
    }

    // Iterate through each and look for a match on the provided serial
    // number of the return the first Tessel if one wasn't provided
    for (var i=0; i<tessels.length; i++) {
      if (!opts.serial || opts.serial === tessels[i].serialNumber) {
        var selectedTessel = tessels[i];
        tessel.logs.info("Connected over", selectedTessel.connection.connectionType + ".");
        return callback && callback(null, selectedTessel);
      }
    }

    return callback && callback();
  });
}

function deployScript(opts, push, callback) {

  // Grab the preferred Tessel
  getTessel({}, function(err, tessel) {
    if (err) {
      return callback(err);
    }
    // Run the script on Tessel
    tessel.deployScript(opts, push);
  });
}

function eraseScript(opts, callback) {

  // Grab the preferred Tessel
  getTessel({}, function(err, tessel) {
    if (err) {
      return callback(err);
    }

    // Run the script on Tessel
    tessel.eraseScript(opts, false);
  });
}

function printAvailableNetworks(opts, callback) {
  // Grab the preferred Tessel
  getTessel({}, function(err, selectedTessel) {
    if (err) {
      return callback && callback(err);
    }

    // Run the script on Tessel
    selectedTessel.findAvailableNetworks(function(err, networks) {
      if (err) return callback && callback(err);

      tessel.logs.info("Currently visible networks (" + networks.length + "):");

      // Print out networks
      networks.forEach(function(network) {
        tessel.logs.info("\t", network.ssid, "(" + network.quality + "/" + network.quality_max + ")");
      });

      return callback && callback();
    });
  });
}


function printIPAddress(opts, callback) {
 // Grab the preferred Tessel
  getTessel({}, function(err, selectedTessel) {
    if (err) {
      return callback && callback(err);
    }

    // Fetch it's IP Address
    selectedTessel.getIPAddress(function(err, ip) {
      if (err) return callback && callback(err);

      // Print the fetched IP
      printIP(ip);
      return callback && callback();
    });
  });

  function printIP(ip) {
    tessel.logs.info("IP ADDRESS: ", ip);
  }
}

function connectToNetwork(opts, callback) {
  // Grab the preferred Tessel
  getTessel({}, function(err, selectedTessel) {
    if (err) {
      return callback && callback(err);
    }

    // Connect to the network with provided options
    selectedTessel.connectToNetwork(opts, function(err) {
      return callback && callback(err);
    });
  });
}

module.exports.listTessels = listTessels;
module.exports.deployScript = deployScript;
module.exports.eraseScript = eraseScript;
module.exports.printAvailableNetworks = printAvailableNetworks;
module.exports.printIPAddress = printIPAddress;
module.exports.connectToNetwork = connectToNetwork;