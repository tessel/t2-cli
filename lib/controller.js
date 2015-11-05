var Tessel = require('./tessel/tessel');
var logs = require('./logs');
var Promise = require('bluebird');
var _ = require('lodash');
var discover = require('./discover');
var sprintf = require('sprintf-js').sprintf;
var cp = require('child_process');
var async = require('async');
var updates = require('./update-fetch');
var inquirer = require('inquirer');
var colors = require('colors');
var util = require('util');
var controller = {};
var responses = {
  noAuth: 'No Authorized Tessels Found.',
  auth: 'No Tessels Found.'
};


Tessel.list = function(opts) {

  return new Promise(function(resolve, reject) {
    // Grab all attached Tessels
    logs.info('Searching for nearby Tessels...');

    // Keep a list of all the Tessels we discovered
    var foundTessels = [];

    // Options for  Tessel discovery
    var seekerOpts = {
      timeout: opts.timeout * 1000,
      usb: opts.usb,
      lan: opts.lan,
      authorized: undefined
    };

    // Start looking for Tessels
    var seeker = new discover.TesselSeeker().start(seekerOpts);
    var noTessels = opts.authorized ?
      responses.noAuth :
      responses.auth;

    // When a Tessel is found
    seeker.on('tessel', function displayResults(tessel) {

      var note = '';

      // Add it to our array
      foundTessels.push(tessel);

      // Add a note if the user isn't authorized to use it yet
      if (tessel.connection.connectionType === 'LAN' && !tessel.connection.authorized) {
        note = '(USB connect and run `t2 provision` to authorize)';
      }

      // Print out details...
      logs.basic(sprintf('\t%s\t%s\t%s', tessel.name, tessel.connection.connectionType, note));
    });

    // Called after CTRL+C or timeout
    seeker.once('end', function stopSearch() {
      // If there were no Tessels found
      if (foundTessels.length === 0) {
        // Report the sadness
        return reject(noTessels);
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
        logs.info('Multiple Tessels found.');
        // Figure out which Tessel will be selected
        return controller.runHeuristics(opts, foundTessels)
          .then(function logSelected(tessel) {
            // Report that selected Tessel to the user
            logs.info('Will default to %s.', tessel.name);
          })
          .catch(function(err) {
            if (!(err instanceof controller.HeuristicAmbiguityError)) {
              return controller.closeTesselConnections(foundTessels)
                .then(reject.bind(this, err));
            }
          })
          .then(function() {
            // Helpful instructions on how to switch
            logs.info('Set default Tessel with environment variable (e.g. "export TESSEL=bulbasaur") or use the --name flag.');
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
    // Collection variable as more Tessels are found
    var tessels = [];

    // Store the amount of time to look for Tessel in seconds
    var seekerOpts = {
      timeout: (opts.timeout || 2) * 1000,
      usb: opts.usb,
      lan: opts.lan,
      authorized: true
    };

    if (opts.authorized !== undefined) {
      seekerOpts.authorized = opts.authorized;
    }

    // Create a seeker object and start detecting any Tessels
    var seeker = new discover.TesselSeeker().start(seekerOpts);
    var noTessels = opts.authorized ?
      responses.noAuth :
      responses.auth;

    function searchComplete() {
      // If we found no Tessels
      if (tessels.length === 0) {
        // Report it
        reject(noTessels);
        return;
      }
      // The name match for a given Tessel happens upon discovery, not at
      // the completion of discovery. So if we got to this point, no Tessel
      // was found with that name
      else if (opts.name !== undefined) {
        return reject('No Tessel found by the name ' + opts.name);
      }
      // If there was only one Tessel
      else if (tessels.length === 1) {
        // Return it immediately
        logAndFinish(tessels[0]);
      }
      // Otherwise
      else {
        // Combine the same Tessels into one object
        return controller.reconcileTessels(tessels)
          .then(function(reconciledTessels) {
            tessels = reconciledTessels;
            // Run the heuristics to pick which Tessel to use
            return controller.runHeuristics(opts, tessels)
              .then(function finalSection(tessel) {
                return logAndFinish(tessel);
              })
              .catch(function(err) {
                if (err instanceof controller.HeuristicAmbiguityError) {
                  var map = {};

                  // Open up an interactive menu for the user to choose
                  return controller.menu({
                    prefix: colors.grey('INFO '),
                    prompt: {
                      name: 'selected',
                      type: 'list',
                      message: 'Which Tessel do want to use?',
                      choices: tessels.map(function(tessel, i) {
                        var isLAN = !!tessel.lanConnection;
                        var isAuthorized = isLAN && tessel.lanConnection.authorized;
                        var authorization = isAuthorized ? '' : '(not authorized)';
                        var display = sprintf(
                          '\t%s\t%s\t%s',
                          tessel.name,
                          tessel.connection.connectionType,
                          authorization
                        );

                        // Map displayed name to tessel index
                        map[display] = i;

                        return display;
                      })
                    },
                    translate: function(answer) {
                      return tessels[map[answer.selected]];
                    }
                  }).then(function(tessel) {
                    if (!tessel) {
                      return controller.closeTesselConnections(tessels)
                        .then(function() {
                          reject('No Tessel selected, mission aborted!');
                        });
                    } else {
                      // Log we found it and return it to the caller
                      return logAndFinish(tessel);
                    }
                  });

                } else {
                  controller.closeTesselConnections(tessels)
                    .then(reject.bind(this, err));
                }
              });
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
1. Fetches a Tessel
2. Runs a given function that returns a promise
3. Whenever either a SIGINT is received, the provided promise resolves, or an error was thrown
4. All the open Tessel connections are closed
5. The command returns from whence it came (so the process can be closed)
*/
controller.standardTesselCommand = function(opts, command) {
  return new Promise(function(resolve, reject) {
    // Fetch a Tessel
    return Tessel.get(opts)
      // Once we have it
      .then(function(tessel) {
        // Create a promise for a sigint
        var sigintPromise = new Promise(function(resolve) {
          process.once('SIGINT', resolve);
        });
        // It doesn't matter whether the sigint finishes first or the provided command
        Promise.race([sigintPromise, command(tessel)])
          // Once one completes
          .then(function(optionalValue) {
            // Close the open Tessel connection
            return controller.closeTesselConnections([tessel])
              // Then resolve with the optional value
              .then(function closeComplete() {
                return resolve(optionalValue);
              });
          })
          // If something threw an error
          .catch(function(err) {
            // Still close the open connections
            return controller.closeTesselConnections([tessel])
              // Then reject with the error
              .then(function closeComplete() {
                return reject(err);
              });
          });
      })
      .catch(reject);
  }).catch(function(error) {
    return Promise.reject(error);
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
            return Promise.reject(new controller.HeuristicAmbiguityError());
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
          // If a USB connection wasn't found, we have too much ambiguity
          else if (!usbFound) {
            // Return nothing because the user needs to be more specific
            return Promise.reject(new controller.HeuristicAmbiguityError());
          }
        }
      }

      // At this point, we know that no name option or env variable was set
      // and we know that there is only one USB and/or on LAN Tessel
      // We'll return the highest priority available
      return collector[0].tessel;
    });
};

controller.HeuristicAmbiguityError = function() {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = 'It is unclear which device should be operated upon.';
};

util.inherits(controller.HeuristicAmbiguityError, Error);

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
    .then(function executeProvision() {
      // We should only be using a USB connection
      opts.usb = true;
      opts.authorized = false;
      // Fetch a Tessel
      return controller.standardTesselCommand(opts, function(tessel) {
        // Provision Tessel with SSH keys
        return tessel.provisionTessel(opts);
      });
    });
};

controller.deployScript = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    // Deploy a path to Tessel
    return tessel.deployScript(opts);
  });
};

controller.restartScript = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    // Tell Tessel to restart an existing script
    return tessel.restartScript(opts);
  });
};

controller.eraseScript = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    // Tell Tessel to erase any pushed script
    return tessel.eraseScript(opts, false);
  });
};

controller.renameTessel = function(opts) {
  opts = opts || {};
  opts.authorized = true;
  // Grab the preferred tessel
  return new Promise(function(resolve, reject) {
      if (!opts.reset && !opts.newName) {
        reject('A new name must be provided.');
      } else {
        if (!opts.reset && !Tessel.isValidName(opts.newName)) {
          reject('Invalid name: ' + opts.newName + '. The name must be a valid hostname string. See http://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names.');
        } else {
          resolve();
        }
      }
    })
    .then(function executeRename() {
      return controller.standardTesselCommand(opts, function(tessel) {
        return tessel.rename(opts);
      });
    });
};

controller.printAvailableNetworks = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    // Ask Tessel what networks it finds in a scan
    return tessel.findAvailableNetworks()
      .then(function(networks) {
        logs.info('Currently visible networks (' + networks.length + '):');

        // Print out networks
        networks.forEach(function(network) {
          logs.info('\t', network.ssid, '(' + network.quality + '/' + network.quality_max + ')');
        });
      });
  });
};

controller.printIpAddress = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    return tessel.getIPAddress()
      .then(function(address) {
        // Print out IP
        logs.info('IP Address: ', address);
      });
  });
};

controller.getWifiInfo = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    return tessel.getWifiInfo()
      .then(function(network) {
        // Grab inet lines, flatmap them, remove empty
        // Wanted to do this with awk and cut inside commands.js
        var ips = network.ips.filter(function(item) {
            return /inet/.exec(item);
          })
          .map(function(line) {
            return line.split(' ');
          })
          .reduce(function(a, b) {
            return a.concat(b);
          })
          .filter(function(item) {
            return /addr/.exec(item);
          })
          .map(function(chunk) {
            return chunk.split(':')[1];
          })
          .filter(function(addr) {
            return addr.length;
          });

        logs.info('Connected to "' + network.ssid + '"');
        ips.forEach(function(ip) {
          logs.info('IP Address: ' + ip);
        });
        logs.info('Signal Strength: (' + network.quality + '/' + network.quality_max + ')');
        logs.info('Bitrate: ' + Math.round(network.bitrate / 1000) + 'mbps');
      })
      .then(function() {
        return controller.closeTesselConnections([tessel]);
      });
  });
};

controller.connectToNetwork = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    return tessel.connectToNetwork(opts);
  });
};

controller.printAvailableUpdates = function() {
  return updates.requestBuildList().then(function(builds) {
    logs.info('Latest builds:');

    // Reverse the list to show the latest version first
    builds.reverse().slice(-10).forEach(function(build) {
      logs.basic('\t Version:', build.version, '\tPublished:', new Date(build.released).toLocaleString());
    });
  });
};

controller.update = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    return new Promise(function updateProcess(resolve, reject) {
      // If it's not connected via USB, we can't update it
      if (!tessel.usbConnection) {
        return reject('Must have Tessel connected over USB to complete update. Aborting update.');
      }

      // // If this Tessel isn't connected to the LAN
      if (!tessel.lanConnection || !tessel.lanConnection.authorized) {
        // Reject because USB updates are broken...
        return reject('No LAN connection found. USB-only updates do not work yet. Please ensure Tessel is connected to wifi and try again');
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
                  return resolve(updates.findBuild(builds, 'sha', currentSHA));
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

          return versionFromSHA.then(function(currentVersionInfo) {
            var build = updates.findBuild(builds, 'version', version);
            var verifiedVersion;

            // If the update is forced or this version was requested,
            // and a valid build exists for the version provided.
            if (version && build) {
              // Fetch and Update with the requested version
              return controller.updateTesselWithVersion(opts.force, tessel, currentVersionInfo.version, build);
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

              // If we've reached this point and no verified version has not
              // been identified, then we need to abord the operation and
              // notify the user.
              if (!verifiedVersion) {
                return reject('The requested build was not found. Please see the available builds with `t2 update -l`.');
              }

              // Check if the current build is the same or newer if this isn't a forced update
              if (!opts.force && currentVersionInfo.version >= verifiedVersion) {
                // If it's not, close the Tessel connection and print the error message
                var message = tessel.name + ' is already on the latest firmware version (' + currentVersionInfo.version + '). You can force an update with "t2 update --force".';

                logs.warn(message);

                return resolve();
              } else {
                if (!opts.force) {
                  // If it is a newer version, let's update...
                  logs.info('New firmware version found...' + verifiedVersion);
                }

                logs.info('Updating ' + tessel.name + ' to latest version (' + verifiedVersion + ')...');

                // Fetch the requested version
                return controller.updateTesselWithVersion(opts.force, tessel, currentVersionInfo.version, build);
              }
            }
          });
        })
        .then(resolve)
        .catch(reject);
    });
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
        });
    });
};

controller.tesselFirmwareVerion = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, function(tessel) {
    // Grab the version information
    return tessel.fetchCurrentBuildInfo()
      .then(function(versionSha) {
        return updates.requestBuildList().then(function(builds) {
          // Figure out what commit SHA is running on it
          var version = updates.findBuild(builds, 'sha', versionSha).version;
          logs.info('Tessel [' + tessel.name + '] version: ' + version);
        });
      })
      .catch(function() {
        logs.info('Tessel [' + tessel.name + '] version: unknown');
      });
  });
};

/*
controller.menu({
  // Custom prefix
  prefix: colors.grey('INFO '),
  prompt: [inquirer.prompt options],
  // Custom answer -> data translation
  translate: function(answer) {
    // answer =>
    // { [prompt.name]: ... }
    return answer[prompt.name];
  }
}) => Promise
*/

controller.menu = function(setup) {
  var options = setup.prompt;

  if (options.type === 'list') {
    options.choices.push('\tExit');
  }

  // Enforce a customized prompt prefix
  inquirer.prompt.prompts[options.type].prototype.prefix = function(str) {
    // String() used to coerce an `undefined` to ''. Do not change.
    return String(setup.prefix) + str;
  };

  return new Promise(function(resolve) {
    inquirer.prompt([options], function(answer) {
      if (setup.translate) {
        resolve(setup.translate(answer));
      } else {
        resolve(answer);
      }
    });
  });
};

module.exports = controller;

// Shared exports
module.exports.listTessels = Tessel.list;
module.exports.getTessel = Tessel.get;
