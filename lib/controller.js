var Tessel = require('./tessel/tessel');
var logs = require('./logs');
var Promise = require('bluebird');
var _ = require('lodash');
var discover = require('./discover');
var sprintf = require('sprintf-js').sprintf;
var cp = require('child_process');
var async = require('async');
var updates = require('./update-fetch');
var controller = {};

Tessel.list = function(opts) {

  return new Promise(function(resolve, reject) {
    // Grab all attached Tessels
    logs.info('Searching for nearby Tessels...');

    // Keep a list of all the Tessels we discovered
    var foundTessels = [];
    // Start looking for Tessels
    var seeker = new discover.TesselSeeker().start(opts.timeout * 1000);

    // When a Tessel is found
    seeker.on('tessel', function displayResults(tessel) {
      if ((tessel.connection.connectionType === 'LAN' && opts.usb && !opts.lan) ||
        (tessel.connection.connectionType === 'USB' && opts.lan && !opts.usb)) {
        return;
      }

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
    seeker.once('end', function stopSearch() {
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
    });

    // Stop the search if CTRL+C is hit
    process.once('SIGINT', function() {
      // If the seeker exists (it should)
      if (seeker !== undefined) {
        // Stop looking for more Tessels
        seeker.stop();
      }
    });
  });
};

Tessel.get = function(opts) {
  return new Promise(function(resolve, reject) {
    logs.info('Looking for your Tessel...');
    // Store the amount of time to look for Tessel in seconds
    var timeout = (opts.timeout || 2) * 1000;
    // Collection variable as more Tessels are found
    var tessels = [];
    // Create a seeker object and start detecting any Tessels
    var seeker = new discover.TesselSeeker().start(timeout);

    function searchComplete() {
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
    }

    // When we find Tessels
    seeker.on('tessel', function(tessel) {
      // Check if this name matches the provided option (if any)
      // This speeds up development by immediately ending the search
      if (opts.name && opts.name === tessel.name) {
        // Remove this listener because we don't need to search for the Tessel
        seeker.removeListener('end', searchComplete);
        // Stop searching
        seeker.stop();
        // Send this Tessel back to the caller
        logAndFinish(tessel);
      }
      // Otherwise
      else {
        // Store this Tessel with the others
        tessels.push(tessel);
      }
    });

    seeker.once('end', searchComplete);

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
          .then(function() {
            reject('Multiple possible Tessel connections found.');
          });
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
        accounts[tessel.name].addConnection(tessel.connection);
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

      // If this has a USB connection
      if (tessel.usbConnection) {
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

controller.deployScript = function(opts) {
  // Grab the preferred Tessel
  return Tessel.get(opts)
    .then(function(tessel) {
      // Run the script on Tessel
      return tessel.deployScript(opts)
        .then(function() {
          return controller.closeTesselConnections(tessel);
        });
    });
};

controller.restartScript = function(opts) {
  // Grab the preferred Tessel
  return Tessel.get(opts)
    .then(function(tessel) {
      // Run the script on Tessel
      return tessel.restartScript(opts)
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

controller.printAvailableUpdates = function() {
  return new Promise(function(resolve, reject) {
    return updates.requestBuildList().then(function(builds) {
      logs.info('Latest builds:');

      // Reverse the list to show the latest version first
      builds.reverse().slice(-10).forEach(function(build) {
        logs.basic('\t Version:', build.version, '\tPublished:', build.released.toLocaleString());
      });

      // Finish up
      return resolve();
    }).catch(reject);
  });
};

controller.update = function(opts) {
  return new Promise(function(resolve, reject) {
    return Tessel.get(opts).then(function(tessel) {

      // If it's not connected via USB, we can't update it
      if (!tessel.usbConnection) {
        return reject('Must have Tessel connected over USB to complete update. Aborting update.');
      }

      // // If this Tessel isn't connected to the LAN
      if (!tessel.lanConnection || !tessel.lanConnection.authorized) {
        // Warn the user that it's going to take a while
        logs.warn('Warning: Authorized LAN connection not detected for this Tessel. For a faster update, cancel and connect Tessel to LAN with the `tessel wifi` command before update.');
      }

      return updates.requestBuildList().then(function(builds) {

        var version = opts.version || 'latest';
        var versionFromSHA = Promise.resolve(version);

        // If we aren't forcing, we'll want to get the current SHA on Tessel
        if (!opts.force) {
          // Once we have the Tessel
          // Over-ride the resolved Promise
          versionFromSHA = new Promise(function(resolve, reject) {
            // Figure out what commit SHA is running on it
            return tessel.fetchCurrentBuildInfo()
              // Once we have the current SHA, provide the version
              .then(function(currentSHA) {
                return resolve(updates.findBuild(builds, 'sha', currentSHA).version);
              })
              .catch(function(err) {
                // If there was an error because the version file doesn't exist
                if (err.message.search('No such file or directory') !== -1) {
                  // Warn the user
                  logs.warn('Could not find firmware version on', tessel.name);

                  if (opts.force !== false) {
                    // Force the update
                    opts.force = true;
                    // Notify the user
                    logs.warn('Forcefully updating...');
                    // Resolve instead of reject (the string isn't used anywhere)
                    return resolve('unknown version');
                  } else {
                    // Reject because the user specifically did not want to force
                    return reject(err);
                  }
                } else {
                  // Reject because an unknown error occurred
                  return reject(err);
                }
              });
          });
        }

        return versionFromSHA.then(function(currentVersion) {
          var build = updates.findBuild(builds, 'version', version);
          var verifiedVersion;

          // If the update is forced or this version was requested,
          // and a valid build exists for the version provided.
          if (version && build) {
            // Fetch and Update with the requested version
            return controller.updateTesselWithVersion(opts.force, tessel, currentVersion, build)
              .then(resolve, reject);
          } else {
            // If they have requested the latest firmware
            if (version === 'latest') {
              build = builds[builds.length - 1];
              verifiedVersion = build.version;
            } else {
              // They provided a valid version that matches a known build.
              if (build) {
                verifiedVersion = build.version;
              }
            }

            // If we've reached this point and no verified version has
            // been identified, then we need to abord the operation and
            // notify the user.
            if (!verifiedVersion) {
              return reject('The requested build was not found. Please see the available builds with `tessel update -l`.');
            }

            // Check if the current build is the same or newer if this isn't a forced update
            if (!opts.force && currentVersion >= verifiedVersion) {
              // If it's not, close the Tessel connection and print the error message
              var message = tessel.name + ' is already on the latest firmware version (' + currentVersion + '). You can force an update with "tessel update --force".';

              logs.warn(message);

              return controller.closeTesselConnections([tessel]).then(resolve);
            } else {
              if (!opts.force) {
                // If it is a newer version, let's update...
                logs.info('New firmware version found...' + verifiedVersion);
              }

              logs.info('Updating ' + tessel.name + ' to latest version (' + verifiedVersion + ')...');

              // Fetch the requested version
              return controller.updateTesselWithVersion(opts.force, tessel, currentVersion, build)
                .then(resolve, reject);
            }
          }
        });
      });
    }).catch(reject);
  });
};

controller.updateTesselWithVersion = function(force, tessel, currentVersion, build) {

  // Fetch the requested build
  return updates.fetchBuild(build)
    .then(function startUpdate(image) {
      // Update Tessel with it
      return tessel.update(image)
        // Log that the update completed
        .then(function logCompletion() {
          if (!force) {
            logs.info('Updated', tessel.name, 'from ', currentVersion, ' to ', build.version);
          } else {
            logs.info('Force updated', tessel.name, 'to version', build.version);
          }
        })
        .then(function() {
          // Close the connection to the tessel
          return controller.closeTesselConnections([tessel]);
        })
        .catch(function(err) {
          return new Promise(function(resolve, reject) {
            // Close the connection because the update failed
            controller.closeTesselConnections([tessel]);
            // Then reject the process
            return reject(err);
          });
        });
    });
};

controller.tesselFirmwareVerion = function(opts) {
  return Tessel.get(opts)
    .then(function(tessel) {
      return tessel.fetchCurrentBuildInfo()
        .then(function(versionSha) {
          return updates.requestBuildList().then(function(builds) {
            // Figure out what commit SHA is running on it
            var version = updates.findBuild(builds, 'sha', versionSha).version;
            logs.info('Tessel [' + tessel.name + '] version: ' + version);

            return controller.closeTesselConnections(tessel);
          });
        })
        .catch(function() {
          logs.info('Tessel [' + tessel.name + '] version: unknown');

          return controller.closeTesselConnections(tessel);
        });
    });
};

module.exports = controller;

// Shared exports
module.exports.listTessels = Tessel.list;
module.exports.getTessel = Tessel.get;
