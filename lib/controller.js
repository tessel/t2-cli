var Tessel = require('./tessel/tessel');
var logs = require('./logs');
var init = require('./init');
var Promise = require('bluebird');
var _ = require('lodash');
var discover = require('./discover');
var sprintf = require('sprintf-js').sprintf;
var cp = require('child_process');
var async = require('async');
var controller = {};

Tessel.list = function(opts) {

  return new Promise(function(resolve, reject) {
    // Grab all attached Tessels
    logs.info('Searching for nearby Tessels...');

    // Keep a list of all the Tessels we discovered
    var foundTessels = [];
    // Start looking for Tessels
    var seeker = new discover.TesselSeeker().start();

    // When a Tessel is found
    seeker.on('tessel', function displayResults(tessel) {
      var note = '';

      // Add it to our array
      foundTessels.push(tessel);

      // Add a note if the user isn't authorized to use it yet
      if (tessel.connection.connectionType === 'LAN' && !tessel.connection.authorized) {
        note = '(USB connect and run `tessel provision` to authorize)';
      }

      // Print out details...
      logs.basic(sprintf('\t%s\t%s\t%s', tessel.name, tessel.connection.connectionType, note));
    });

    // Called after CTRL+C or timeout
    function stopSearch() {
      // If the seeker exists (it should)
      if (seeker !== undefined) {
        // Stop looking for more Tessels
        seeker.stop();
      }

      // If there were no Tessels found
      if (foundTessels.length === 0) {
        // Report the sadness
        reject('No Tessels Found');
      } else if (foundTessels.length === 1) {
        // Close all opened connections and resolve
        controller.closeTesselConnections(foundTessels)
          .then(resolve);
      }
      // If we have only one Tessel or two Tessels with the same name (just USB and LAN)
      else if (foundTessels.length === 1 ||
        (foundTessels.length === 2 && foundTessels[0].name === foundTessels[1].name)) {
        // Close all opened connections and resolve
        controller.closeTesselConnections(foundTessels)
          .then(resolve);
      }
      // Otherwise
      else {
        // Figure out which Tessel will be selected
        controller.runHeuristics(opts, foundTessels)
          .then(function logSelected(tessel) {
            // Report that selected Tessel to the user
            logs.info('Multiple Tessels found.');
            if (tessel) {
              logs.info('Will default to', tessel.name, '.');
            }
            // Helpful instructions on how to switch
            logs.info('Set default Tessel with environment variable (e.g. \'export TESSEL=bulbasaur\') or use the --name flag.');

            // Close all opened connections and resolve
            controller.closeTesselConnections(foundTessels)
              .then(resolve);
          });
      }
    }

    // If a timeout was provided and it's a number
    if (opts.timeout && typeof opts.timeout === 'number') {
      // Stop the search after that duration
      setTimeout(stopSearch, opts.timeout * 1000);
    }

    // Stop the search if CTRL+C is hit
    process.once('SIGINT', stopSearch);
  });
};

Tessel.get = function(opts) {
  return new Promise(function(resolve, reject) {
    logs.info('Connecting to Tessel...');
    // Store the amount of time to look for Tessel
    var timeout = opts.timeout || 1.5;
    // Collection variable as more Tessels are found
    var tessels = [];
    // Create a seeker object and start detecting any Tessels
    var seeker = new discover.TesselSeeker().start();
    // The handle for the search complete timeout
    var timeoutHandle;

    // When we find Tessels
    seeker.on('tessel', function(tessel) {
      // Check if this name matches the provided option (if any)
      // This speeds up development by immediately ending the search
      if (opts.name && opts.name === tessel.name) {
        // Stop searching
        seeker.stop();
        // Don't call the timeout
        clearTimeout(timeoutHandle);
        // Send this Tessel back to the caller
        logAndFinish(tessel);
      }
      // Otherwise
      else {
        // Store this Tessel with the others
        tessels.push(tessel);
      }
    });

    // Set the timeout for when we give up searching
    timeoutHandle = setTimeout(function() {
      // Stop the search
      seeker.stop();
      // If we found no Tessels
      if (tessels.length === 0) {
        // Report it
        reject('No Tessels Found.');
        return;
      }
      // If there was only one Tessel
      else if (tessels.length === 1) {
        // Return it immediately
        logAndFinish(tessels[0]);
      }
      // Otherwise
      else {
        // Combine the same Tessels into one object
        controller.reconcileTessels(tessels)
          .then(function(reconciledTessels) {
            tessels = reconciledTessels;
            // Run the heuristics to pick which Tessel to use
            return controller.runHeuristics(opts, tessels)
              .then(logAndFinish);
          });
      }
    }, timeout * 1000);

    // Accesses `tessels` in closure
    function logAndFinish(tessel) {
      // The Tessels that we won't be using should have their connections closed
      var connectionsToClose = tessels;

      if (tessel) {
        logs.info(sprintf('Connected to %s over %s', tessel.name, tessel.connection.connectionType));
        connectionsToClose.splice(tessels.indexOf(tessel), 1);

        controller.closeTesselConnections(connectionsToClose)
          .then(function() {
            return resolve(tessel);
          });
      } else {
        logs.info('Please specify a Tessel by name [--name <tessel name>]');
        controller.closeTesselConnections(connectionsToClose)
          .then(reject);
      }
    }
  });
};

/*
Takes a list of Tessels with connections that
may or may not be open and closes them

*/


controller.closeTesselConnections = function(tessels) {
  return new Promise(function(resolve, reject) {
    async.each(tessels, function closeThem(tessel, done) {
        // If not an unauthorized LAN Tessel, it's connected
        if (!(tessel.connection.connectionType === 'LAN' &&
            !tessel.connection.authorized)) {
          // Close the connection
          return tessel.close()
            .then(done, done);
        } else {
          done();
        }
      },
      function closed(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
  });
};

/*
Takes list of USB and LAN Tessels and merges
and Tessels that are the same origin with difference
connection methods.

Assumes tessel.getName has already been called for each.
*/
controller.reconcileTessels = function(tessels) {
  return new Promise(function(resolve) {
    // If there is only one, just return
    if (tessels.length <= 1) {
      return resolve(tessels);
    }

    var accounts = {};
    var reconciled = tessels.reduce(function(accum, tessel) {
      if (accounts[tessel.name]) {
        // Updates tessels in accum by reference
        accounts[tessel.name].connections.push(tessel.connection);
      } else {
        accounts[tessel.name] = tessel;
        accum.push(tessel);
      }
      return accum;
    }, []);

    resolve(reconciled);
  });
};

/*
0. using the --name flag
1. an environment variable in the terminal, set as export TESSEL=Bulbasaur
2. if there is a single tessel connected over USB, prefer that one
3. if there is only one tessel visible, use that one
4. if none of the above are found run tessel list automatically and prompt selection
*/
// Called when multiple tessels are found are we need to figure out
// Which one the user should act upon
controller.runHeuristics = function(opts, tessels) {
  var NAME_OPTION_PRIORITY = 0;
  var ENV_OPTION_PRIORITY = 1;
  var USB_CONN_PRIORITY = 2;
  var LAN_CONN_PRIORITY = 3;

  // For each of the Tessels found
  return Promise.reduce(tessels, function(collector, tessel) {
      // Create an object to keep track of what priority this Tessel has
      // The lower the priority, the more likely the user wanted this Tessel
      var entry = {
        tessel: tessel,
        priority: undefined
      };

      // If a name option was provided and it matches this Tessel
      if (opts.name && opts.name === tessel.name) {
        // Set it to the highest priority
        entry.priority = NAME_OPTION_PRIORITY;
        // Store the entry
        collector.push(entry);
        return collector;
      }

      // If an environment variable was set and it equals this Tessel
      if (process.env.TESSEL && process.env.TESSEL === tessel.name) {
        // Mark the priority level
        entry.priority = ENV_OPTION_PRIORITY;
        // Store the entry
        collector.push(entry);
        return collector;
      }

      // If this is a USB connection
      if (tessel.connection.connectionType === 'USB') {
        // Mark the priority
        entry.priority = USB_CONN_PRIORITY;
        // Store the entry
        collector.push(entry);
        return collector;
      }

      // This is a LAN connection so give it the lowest priority
      entry.priority = LAN_CONN_PRIORITY;
      // Store the entry
      collector.push(entry);
      return collector;

    }, [])
    .then(function selectTessel(collector) {
      var usbFound = false;
      var lanFound = false;

      // Sort all of the entries by priority
      collector = _.sortBy(collector, function(entry) {
        return entry.priority;
      });

      // For each entry
      for (var i = 0; i < collector.length; i++) {
        var collectorEntry = collector[i];
        // If this is a name option or environment variable option
        if (collectorEntry.priority === NAME_OPTION_PRIORITY ||
          collectorEntry.priority === ENV_OPTION_PRIORITY) {
          // Return the Tessel and stop searching
          return collectorEntry.tessel;
        }
        // If this is a USB Tessel
        else if (collectorEntry.priority === USB_CONN_PRIORITY) {
          // And no other USB Tessels have been found yet
          if (usbFound === false) {
            // Mark it as found and continue
            usbFound = true;
          }
          // We have multiple USB Tessels which is an issue
          else {
            // Return nothing because the user needs to be more specific
            return;
          }
        }
        // If this is a LAN Tessel
        else if (collectorEntry.priority === LAN_CONN_PRIORITY) {
          // And we haven't found any other Tessels
          if (lanFound === false) {
            // Mark it as found and continue
            lanFound = true;
          }
          // We have multiple LAN Tessels which is an issue
          else {
            // Return nothing because the user needs to be more specific
            return;
          }
        }
      }

      // At this point, we know that no name option or env variable was set
      // and we know that there is only one USB and/or on LAN Tessel
      // We'll return the highest priority available
      return collector[0].tessel;
    });
};

controller.provisionTessel = function(opts) {
  opts = opts || {};
  return new Promise(function(resolve, reject) {
      if (Tessel.isProvisioned()) {
        if (opts.force) {
          cp.exec('rm -r ' + Tessel.TESSEL_AUTH_PATH, function(error) {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        } else {
          // ~/.tessel exists with keys
          resolve();
        }
      } else {
        // There is no ~/.tessel
        resolve();
      }
    })
    .then(Tessel.get.bind(null, opts))
    .then(function(tessel) {
      return tessel.provisionTessel(opts)
        .then(function() {
          return controller.closeTesselConnections(tessel);
        });
    });
};

controller.deployScript = function(opts, push) {
  // Grab the preferred Tessel
  return Tessel.get(opts)
    .then(function(tessel) {
      // Run the script on Tessel
      return tessel.deployScript(opts, push)
        .then(function() {
          return controller.closeTesselConnections(tessel);
        });
    });
};

controller.eraseScript = function(opts) {
  // Grab the preferred Tessel
  return Tessel.get(opts)
    .then(function(tessel) {
      // Run the script on Tessel
      return tessel.eraseScript(opts, false)
        .then(function() {
          return controller.closeTesselConnections(tessel);
        });
    });
};

controller.renameTessel = function(opts) {
  opts = opts || {};

  // Grab the preferred tessel
  return new Promise(function(resolve, reject) {
      if (!opts.reset && !opts.newName) {
        reject('A new name must be provided.');
      } else {
        if (!Tessel.isValidName(opts.newName)) {
          reject('Invalid name: ' + opts.newName + '. The name must be a valid hostname string. See http://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names.');
        } else {
          resolve();
        }
      }
    })
    .then(Tessel.get.bind(null, opts))
    .then(function(tessel) {
      return tessel.rename(opts)
        .then(function() {
          return controller.closeTesselConnections(tessel);
        });
    });
};

controller.printAvailableNetworks = function(opts) {
  // Grab the preferred Tessel
  return Tessel.get(opts)
    .then(function(selectedTessel) {
      // Run the script on Tessel
      return selectedTessel.findAvailableNetworks()
        .then(function(networks) {
          logs.info('Currently visible networks (' + networks.length + '):');

          // Print out networks
          networks.forEach(function(network) {
            logs.info('\t', network.ssid, '(' + network.quality + '/' + network.quality_max + ')');
          });
        })
        .then(function() {
          return controller.closeTesselConnections(selectedTessel);
        });
    });
};

controller.connectToNetwork = function(opts) {
  // Grab the preferred Tessel
  return Tessel.get(opts)
    .then(function(selectedTessel) {
      // Connect to the network with provided options
      return selectedTessel.connectToNetwork(opts)
        .then(function() {
          return controller.closeTesselConnections(selectedTessel);
        });
    });
};

controller.init = function(opts) {
  return init(opts);
};

module.exports = controller;

// Shared exports
module.exports.listTessels = Tessel.list;
module.exports.getTessel = Tessel.get;
