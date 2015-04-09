var usb = require('./usb_connection')
  , lan = require('./lan_connection')
  , Tessel = require('./tessel/tessel')
  , async = require('async')
  , tessel = require('tessel')
  , Promise = require('bluebird')
  , _ = require('lodash')
  ;


/*
  Fetches Tessels and prints them out
    param callback: called upon completion in the form (err)
*/
function listTessels(opts) {
  // If delay is undefined, default to 1.5 second
  var timeout = opts.timeout || 1500;
  tessel.logs.info('Scanning for connections...');
  return Promise.all([
          // Fetch usb connected Tessels
          usb.findConnections()
            .map(function(usb_connection){
              tessel.logs.info('USB CONNECTION ', usb_connection.serialNumber);
              // Pass connections through for consistency
              return usb_connection;
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
              // If connection is not authorized and option to show all is not given
              if(!lan_connection.authorized && !opts.all){
                // return early and do not log or add a valid connection
                return validConnections;
              }
      // TODO: Remove slice and use .name once USB is implemented
              tessel.logs.info('LAN CONNECTION ip: ', lan_connection.ip, ', name: ', lan_connection.auth.host.slice(0,-6), ', Authorized: ', lan_connection.authorized);
              // Add valid connection
              validConnections.push(lan_connection);
              // Pass connections through for consistency
              return validConnections;
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
  tessel.logs.info("Connecting to Tessel...");
  // Grab all attached Tessels
  return Promise.settle([usb.findConnections(),lan.findConnections()])
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

        // Log connection info
        var message = "Connected over " + connection.connectionType + "."
        if (connection.connectionType === 'LAN'){
          message += " IP ADDRESS: " + connection.ip;
        }
        tessel.logs.info(message);
        // Resolve with new instance of Tessel;
        resolve(new Tessel(connection));
      });
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
  getTessel(opts)
    .then(function(tessel) {
      // Run the script on Tessel
      tessel.eraseScript(opts, false);
    });
}

function printAvailableNetworks(opts) {
  // Grab the preferred Tessel
  return getTessel(opts)
    .then(function(selectedTessel) {
      // Run the script on Tessel
      return selectedTessel.findAvailableNetworks()
      .then(function(networks) {
        tessel.logs.info("Currently visible networks (" + networks.length + "):");

        // Print out networks
        networks.forEach(function(network) {
          tessel.logs.info("\t", network.ssid, "(" + network.quality + "/" + network.quality_max + ")");
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
    tessel.logs.info("IP ADDRESS: ", ip);
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

        tessel.logs.info("Currently visible networks (" + networks.length + "):");

        // Print out networks
        networks.forEach(function(network) {
          tessel.logs.info("\t", network.ssid, "(" + network.quality + "/" + network.quality_max + ")");
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
    tessel.logs.info("IP ADDRESS: ", ip);
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
module.exports.deployScript = deployScript;
module.exports.eraseScript = eraseScript;
module.exports.printAvailableNetworks = printAvailableNetworks;
module.exports.printIPAddress = printIPAddress;
module.exports.connectToNetwork = connectToNetwork;
