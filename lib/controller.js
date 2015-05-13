var usb = require('./usb_connection')
  , lan = require('./lan_connection')
  , Tessel = require('./tessel/tessel')
  , async = require('async')
  , logs = require('./logs')
  , Promise = require('bluebird')
  , _ = require('lodash')
  ;


/*
  Fetches Tessels and prints them out
    param callback: called upon completion in the form (err)
*/
function listTessels(opts) {
  // If delay is undefined, default to 1.5 second
  var timeout = opts.timeout || 1.5;
  logs.info('Scanning for connections...');
  return Promise.all([
          // Fetch usb connected Tessels
          usb.findConnections()
            .map(function(usb_connection){
              return new Promise(function(resolve, reject) {
                var t = new Tessel(usb_connection);
                t.getName(function(err) {
                  if (err) {
                    return reject(err);
                  }
                  // Pass connections through for consistency
                  logs.info('USB CONNECTION ', 'name: ', t.name);
                   // Pass connections through for consistency
                  resolve(usb_connection);
                });
              });
            })
            .then(function(connections){
              // Start spinner since mdns scans take a while
              Tessel.spinner.start();
              // Pass connections through for consistency
              return connections;
            }),
          // Fetch all mdns tessel's
          lan.findConnections(timeout)
            // Filter out tessels user is not authorized to use
            .reduce(function(validConnections, lan_connection){
              return new Promise(function(resolve, reject) {
                // Pass connections through for consistency
                logs.info('LAN CONNECTION ip: ', lan_connection.ip, ', name: ', lan_connection.auth.host.slice(0,-6), ', Authorized: ', lan_connection.authorized);
                // Add valid connection
                validConnections.push(lan_connection);
                // Pass connections through for consistency
                resolve(validConnections);
              });
            }, [])
            .then(function(connections){
              // Stop the spinner
              Tessel.spinner.stop();
              // Pass connections through for future use
              return connections;
            })
          ]);
}

/*
  Returns an instance of the requested Tessel.
  If TESSEL_SERIAL env variable is set, that Tessel is returned.
  If it is not set, the first USB listed Tessel is returned.
    param opts: an object that can contain the field of serial, eg. {serial: "SOME_SERIAL"}
    param callback: called upon completion in the form (err, tessel)
*/
function getTessel(opts) {
  logs.info("Connecting to Tessel...");
  // Grab all attached Tessels
  var timeout = opts.timeout || 1.5;
  var connectionTypes = [];
  if(opts.lan) {
    connectionTypes.push(lan.findConnections(timeout));
  }
  if(opts.usb) {
    connectionTypes.push(usb.findConnections(timeout));
  }
  if(connectionTypes.length < 1) {
    connectionTypes.push(lan.findConnections(timeout));
    connectionTypes.push(usb.findConnections(timeout));
  }
  return Promise.settle(connectionTypes)
    .reduce(function(connections, result){
      // Check if the promises have been fulfilled
      if(result.isFulfilled()){
        // If so concat the results which should be an array
        var connections = connections.concat(result.value());
      }
      return connections;
    }, [])
    .then(function(connections){
      return new Promise(function(resolve, reject) {
      if(!connections.length){
        reject('No Tessels Found');
      }
      resolve(connections);
      });
    })
    // Sort by ip address
    .then(function(connections){
      return _.sortBy(connections, 'ip');
    })
    // Filter by the options provided
    .reduce(function(collector, connection){
      // TODO: Refactor to use UUID once implemented
      // TODO: Put logic in for USB once implemented remove following case
      if(connection.connectionType === 'USB'){
        collector.default = connection;
        collector.selected = connection;
        return collector;
      }

      var match;
      // Start with tessel selected by the command `tessel select`
      // TODO: Remove slice and use .name once USB is implemented
      if(process.env.SELECTED_TESSEL && process.env.SELECTED_TESSEL === connection.auth.host.slice(0,-6) ){
        match = connection;
      }

      // Over ride with command line options
      // Match name
      if(opts.name && opts.name === connection.auth.host.slice(0,-6)){
        match = connection;
      }

      // If double match, warn user
      // Return early with no change
      if(match && collector.selected){
        tessel.log.warn("Multiple matches found. Using tessel at IP address: " + connection.ip);
        return collector;
      }

      // Assign selected to match
      if(match){
        collector.selected = match;
      }

      // Default with no option flags will be taken from environment variable if it exists
      // TODO: Remove slice and use .name once USB is implemented
      if(process.env.SELECTED_TESSEL && process.env.SELECTED_TESSEL === connection.auth.host.slice(0,-6)){
        collector.default = connection;
      }

      // If the default hasn't been assigned yet, assign it
      if(!collector.default){
        collector.default = connection;
      }

      // Return with default and selected, if any
      return collector;
    }, {default: null, selected: null} )
    .then(function(connections){
      return new Promise(function(resolve, reject) {
        // If name option provided and no device selected
        if(opts.name && !connections.selected){
          // Reject with warning message
          return reject('No Tessel Found with name: ' + opts.name);
        }

        // Select default, either first in list or SELECTED_TESSEL
        var connection = connections.default;

        // If name option provided
        if(opts.name && connections.selected){
          // Use selected tessel instead
          connection = connections.selected;
        }

        // If this is a remote device and the user isn't authorized
        if (connection.connectionType === "LAN" && !connection.authorized) {
          // Reject the request and provide a helpful error message
          return reject("Not authorized to deploy to this device. If you're connecting to Tessel 2 hardware, physically connect via USB and run `tessel provision`. If you're connecting to a VM, run `tessel key generate` prior to launching the VM.");
        }

        // Log connection info
        var message = "Connected over " + connection.connectionType + "."
        if (connection.connectionType === 'LAN'){
          message += " IP ADDRESS: " + connection.ip;
        }
        logs.info(message);
        // Resolve with new instance of Tessel;
        resolve(new Tessel(connection));
      });
    })
}

function provisionTessel(opts) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(tessel) {
      tessel.provisionTessel(opts);
    })
}

function deployScript(opts, push) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(tessel){
      // Run the script on Tessel
      tessel.deployScript(opts, push);
    });
}

function eraseScript(opts) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(tessel) {
      // Run the script on Tessel
      tessel.eraseScript(opts, false);
    });
}

function renameTessel(opts) {
  // Grab the preferred tessel
  return new Promise(function(resolve, reject) {
    if (!opts.reset && !opts.newName) {
      reject("A new name must be provided.");
    }
    else {
      resolve();
    }
  })
  .then(getTessel.bind(null, opts))
  .then(function(tessel) {
    return new Promise(function(resolve, reject) {
      tessel.rename(opts, function(err) {
        if (err) return reject(err);
        else resolve();
      });
    });
  });
}

function printAvailableNetworks(opts) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(selectedTessel) {
      // Run the script on Tessel
      return selectedTessel.findAvailableNetworks()
      .then(function(networks) {
        logs.info("Currently visible networks (" + networks.length + "):");

        // Print out networks
        networks.forEach(function(network) {
          logs.info("\t", network.ssid, "(" + network.quality + "/" + network.quality_max + ")");
        });
        return;
      });
    });
}


function printIPAddress(opts) {
 // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(selectedTessel) {
    // Fetch it's IP Address
    // Return to propagate promise
    return selectedTessel
      .getIPAddress()
      // Print the fetched IP
      .then(printIP)
    });

  function printIP(ip) {
    logs.info("IP ADDRESS: ", ip);
  }
}

function connectToNetwork(opts) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(selectedTessel) {
      // Connect to the network with provided options
      return selectedTessel.connectToNetwork(opts);
  });
}

function printAvailableNetworks(opts) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(selectedTessel) {
    // Run the script on Tessel
    // Return to propagate promise
    return selectedTessel.findAvailableNetworks()
      .then(function(networks) {

        logs.info("Currently visible networks (" + networks.length + "):");

        // Print out networks
        networks.forEach(function(network) {
          logs.info("\t", network.ssid, "(" + network.quality + "/" + network.quality_max + ")");
        });
        return;
    });
  });
}


function printIPAddress(opts) {
 // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(selectedTessel) {
      // Fetch it's IP Address
      // Return to propagate promise
      return selectedTessel
        .getIPAddress()
        // Print the fetched IP
        .then(printIP)
    });

  function printIP(ip) {
    logs.info("IP ADDRESS: ", ip);
  }
}

function connectToNetwork(opts) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(selectedTessel) {
      // Connect to the network with provided options
      // Return to propagate promise
      return selectedTessel.connectToNetwork(opts);
    });
}

module.exports.listTessels = listTessels;
module.exports.provisionTessel = provisionTessel;
module.exports.deployScript = deployScript;
module.exports.eraseScript = eraseScript;
module.exports.renameTessel = renameTessel;
module.exports.printAvailableNetworks = printAvailableNetworks;
module.exports.printIPAddress = printIPAddress;
module.exports.connectToNetwork = connectToNetwork;
