'use strict';

// System Objects
var cp = require('child_process');
var util = require('util');

// Third Party Dependencies
var async = require('async');
var colors = require('colors');
var semver = require('semver');

// Internal
var CrashReporter = require('./crash-reporter');
var discover = require('./discover');
var init = require('./init');
var installer = require('./installer');
var log = require('./log');
var Menu = require('./menu');
var updates = require('./update-fetch');
var provision = require('./tessel/provision');
var Tessel = require('./tessel/tessel');

var controller = {
  // This will be assigned with the Tessel that is found or selected.
  tessel: null,
};

var responses = {
  noAuth: 'No Authorized Tessels Found.',
  auth: 'No Tessels Found.'
};

// Wrapper function for Tessel.list to set SSH key path
controller.list = function(opts) {
  return controller.defaultHelpers(opts, Tessel.list);
};

// Wrapper function for Tessel.get to set SSH key path
controller.get = function(opts) {
  return controller.defaultHelpers(opts, Tessel.get);
};

// Calls any helpers for the get and list codepaths
controller.defaultHelpers = function(opts, next) {
  // First disable output if necessary
  return controller.outputHelper(opts)
    // Then make sure our SSH Key path is updated
    .then(() => controller.keyHelper(opts))
    // before continuing to the next function
    .then(() => next(opts));
};

controller.keyHelper = function(opts) {
  var keyPromise = Promise.resolve();
  if (opts.key) {
    // Set the default SSH key path before we search
    keyPromise = provision.setDefaultKey(opts.key);
  }
  return keyPromise;
};

controller.outputHelper = function(opts) {
  // If the user doesn't want output
  if (opts.output === false) {
    // Turn off logging
    log.disable();
  }
  return Promise.resolve();
};

controller.setupLocal = function(opts) {
  return provision.setupLocal(opts);
};


Tessel.list = function(opts) {
  return new Promise(function(resolve, reject) {
    // Grab all attached Tessels
    log.info('Searching for nearby Tessels...');

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
      log.basic(`\t${tessel.connection.connectionType}\t${tessel.name}\t${note}`);
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
          .then(() => resolve(foundTessels));
      }
      // If we have only one Tessel or two Tessels with the same name (just USB and LAN)
      else if (foundTessels.length === 1 ||
        (foundTessels.length === 2 && foundTessels[0].name === foundTessels[1].name)) {
        // Close all opened connections and resolve
        controller.closeTesselConnections(foundTessels)
          .then(() => resolve(foundTessels));
      }
      // Otherwise
      else {
        log.info('Multiple Tessels found.');
        // Figure out which Tessel will be selected
        return controller.runHeuristics(opts, foundTessels)
          .then(tessel => {
            // Report that selected Tessel to the user
            log.info('Will default to %s.', tessel.name);
          })
          .catch(error => {
            /* istanbul ignore else */
            if (!(error instanceof controller.HeuristicAmbiguityError)) {
              return controller.closeTesselConnections(foundTessels)
                .then(() => reject(error));
            }
          })
          .then(() => {
            // Helpful instructions on how to switch
            log.info('Set default Tessel with environment variable (e.g. "export TESSEL=bulbasaur") or use the --name flag.');
            // Close all opened connections and resolve
            controller.closeTesselConnections(foundTessels).then(() => resolve(foundTessels));
          });
      }
    });

    // Stop the search if CTRL+C is hit
    /* istanbul ignore next */
    process.once('SIGINT', function() {
      // If the seeker exists (it should)
      /* istanbul ignore if */
      if (seeker !== undefined) {
        // Stop looking for more Tessels
        seeker.stop();
      }
    });
  });
};

Tessel.get = function(options) {
  return new Promise((resolve, reject) => {
    log.info('Looking for your Tessel...');
    // Collection variable as more Tessels are found
    let tessels = [];

    // Store the amount of time to look for Tessel in seconds
    const seekerOpts = {
      timeout: (options.timeout || 2) * 1000,
      usb: options.usb,
      lan: options.lan,
      authorized: true,
      altSetting: options.altSetting
    };

    if (options.authorized !== undefined) {
      seekerOpts.authorized = options.authorized;
    }

    // Create a seeker object and start detecting any Tessels
    const seeker = new discover.TesselSeeker().start(seekerOpts);
    const noTessels = options.authorized ?
      responses.noAuth :
      responses.auth;

    function onEnd() {
      // If we found no Tessels
      if (tessels.length === 0) {
        // Report it
        return reject(noTessels);
      }
      // The name match for a given Tessel happens upon discovery, not at
      // the completion of discovery. So if we got to this point, no Tessel
      // was found with that name
      else if (options.name !== undefined) {
        return reject(`No Tessel found by the name ${options.name}`);
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
          .then(reconciledTessels => {
            tessels = reconciledTessels;
            // Run the heuristics to pick which Tessel to use
            return controller.runHeuristics(options, tessels)
              .then(logAndFinish)
              .catch(error => {
                /* istanbul ignore else */
                if (error instanceof controller.HeuristicAmbiguityError) {
                  const map = {};
                  // Open up an interactive menu for the user to choose
                  return Menu.prompt({
                    prefix: colors.grey('INFO '),
                    prompt: {
                      name: 'selected',
                      type: 'list',
                      message: 'Which Tessel do want to use?',
                      choices: tessels.map((tessel, i) => {
                        const isLAN = !!tessel.lanConnection;
                        const isAuthorized = isLAN && tessel.lanConnection.authorized;
                        // show "(not authorized)" if there is a lanConnection
                        /* istanbul ignore next */
                        const authorization = isAuthorized || !!tessel.usbConnection ? '' : '(not authorized)';
                        const display = `\t${tessel.connection.connectionType}\t${tessel.name}\t${authorization}`;

                        // Map displayed name to tessel index
                        map[display] = i;

                        return display;
                      })
                    },
                    // This code is not our responsibility to test
                    /* istanbul ignore next */
                    translate(answer) {
                      /* istanbul ignore next */
                      return tessels[map[answer.selected]];
                    }
                  }).then(tessel => {
                    /* istanbul ignore else */
                    if (!tessel) {
                      return controller.closeTesselConnections(tessels)
                        .then(() => reject('No Tessel selected, mission aborted!'));
                    } else {
                      // Log we found it and return it to the caller
                      // This cannot be tested without human interaction
                      return logAndFinish(tessel);
                    }
                  });

                } else {
                  controller.closeTesselConnections(tessels)
                    .then(() => reject(error));
                }
              });
          });
      }
    }

    function onTessel(tessel) {
      tessel.setLANConnectionPreference(options.lanPrefer);
      // Check if this name matches the provided option (if any)
      // This speeds up development by immediately ending the search
      if (options.name && options.name === tessel.name) {
        stopSeekingThenLogAndFinish(tessel);
      } else {
        // Store this Tessel with the others
        tessels.push(tessel);
      }
    }

    function stopSeekingThenLogAndFinish(tessel) {
      // Remove this listener because we don't need to search for the Tessel
      seeker.removeAllListeners();
      // Stop searching
      seeker.stop();
      // Send this Tessel back to the caller
      logAndFinish(tessel);
    }

    // When we find Tessels
    seeker.on('tessel', onTessel);
    seeker.once('end', onEnd);

    // Accesses `tessels` in closure
    function logAndFinish(tessel) {
      // The Tessels in `tessels` that we won't be using MUST
      // have their connections closed
      /* istanbul ignore else */
      if (tessel) {
        log.info(`Connected to ${colors.magenta(tessel.name)}.`);
        controller.closeTesselConnections(tessels.filter(closable => closable !== tessel))
          .then(() => resolve(tessel));
      } else {
        log.info('Please specify a Tessel by name [--name <tessel name>]');
        controller.closeTesselConnections(tessels)
          .then(() => reject('Multiple possible Tessel connections found.'));
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
controller.standardTesselCommand = function(options, command) {
  return new Promise((resolve, reject) => {
    // Fetch a Tessel
    return controller.get(options)
      // Once we have it
      .then((tessel) => {
        // Make the active tessel available controller-wide.
        // This will be used by "out of reach" operations,
        // such as crash reporting (which responds to uncaught
        // exceptions for the process and will be out of scope)
        controller.tessel = tessel;

        // Create a promise for a sigint
        var sigintPromise = new Promise(resolve => process.once('SIGINT', resolve));
        // It doesn't matter whether the sigint finishes first or the provided command
        Promise.race([sigintPromise, command(tessel)])
          // Once one completes
          .then(optionalValue => {
            // Close the open Tessel connection
            return controller.closeTesselConnections([tessel])
              // Then resolve with the optional value
              .then(() => resolve(optionalValue));
          })
          // If something threw an error
          .catch(error => {
            // Still close the open connections
            return controller.closeTesselConnections([tessel])
              // Then reject with the error
              .then(() => reject(error));
          });
      })
      .catch(reject);
  }).catch(error => Promise.reject(error));
};

/*
Takes a list of Tessels with connections that
may or may not be open and closes them
*/
controller.closeTesselConnections = function(tessels) {
  return new Promise((resolve, reject) => {
    async.each(tessels, (tessel, done) => {
        // If not an unauthorized LAN Tessel, it's connected
        if (!(tessel.connection.connectionType === 'LAN' &&
            !tessel.connection.authorized)) {

          // If this was a USB connection that was rebooted,
          // it can't be closed manually, because it's already closed.
          if (tessel.connection.connectionType === 'USB' &&
            tessel.connection.closed) {
            done();
          } else {
            // Close the connection
            return tessel.close()
              .then(done, done);
          }
        } else {
          done();
        }
      },
      (error) => {
        if (error) {
          reject(error);
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
  return Promise.resolve(tessels.reduce(function(collector, tessel) {
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
        return collector.concat([entry]);
      }

      // If an environment variable was set and it equals this Tessel
      /* istanbul ignore if */
      if (process.env.TESSEL &&
        /* istanbul ignore next */
        process.env.TESSEL === tessel.name) {
        // Mark the priority level
        entry.priority = ENV_OPTION_PRIORITY;
        return collector.concat([entry]);
      }

      // If this has a USB connection
      if (tessel.usbConnection) {
        // Mark the priority
        entry.priority = USB_CONN_PRIORITY;
        return collector.concat([entry]);
      }

      // This is a LAN connection so give it the lowest priority
      entry.priority = LAN_CONN_PRIORITY;
      return collector.concat([entry]);
    }, []))
    .then(function selectTessel(collector) {
      var usbFound = false;
      var lanFound = false;

      // Sort all of the entries by priority
      collector.sort((a, b) => {
        return a.priority > b.priority;
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
        else {
          /* istanbul ignore else */
          if (collectorEntry.priority === LAN_CONN_PRIORITY) {
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
  return new Promise((resolve, reject) => {
      if (Tessel.isProvisioned()) {
        if (opts.force) {
          cp.exec('rm -r ' + Tessel.LOCAL_AUTH_PATH, (error) => {
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
    .then(() => {
      // We should only be using a USB connection
      opts.usb = true;
      opts.authorized = false;
      // Fetch a Tessel
      return controller.standardTesselCommand(opts, (tessel) => {
        // Provision Tessel with SSH keys
        return tessel.provisionTessel(opts);
      });
    });
};


controller.restoreTessel = function(options) {
  options.usb = true;
  options.lan = false;
  options.altSetting = 1;
  return controller.get(options).then((tessel) => {
    return new Promise((resolve, reject) => {
      return tessel.restore(options).then(resolve).catch(reject);
    });
  });
};

controller.deploy = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => tessel.deploy(options));
};

controller.restart = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => tessel.restart(options));
};

controller.eraseScript = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => tessel.eraseScript(options, false));
};

controller.renameTessel = function(options) {
  options = options || {};
  options.authorized = true;
  // Grab the preferred tessel
  return new Promise((resolve, reject) => {
      if (!options.reset && !options.newName) {
        reject('A new name must be provided.');
      } else {
        if (!options.reset && !Tessel.isValidName(options.newName)) {
          reject(`Invalid name: ${options.newName}. The name must be a valid hostname string. See http://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names.`);
        } else {
          resolve();
        }
      }
    })
    .then(() => {
      return controller.standardTesselCommand(options, (tessel) => {
        log.info(`Renaming ${tessel.name} to ${options.newName}`);
        return tessel.rename(options);
      });
    });
};

controller.printAvailableNetworks = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => {
    log.info('Scanning for visible networks...');

    // Ask Tessel what networks it finds in a scan
    return tessel.findAvailableNetworks()
      .then((networks) => {
        log.info(`Found ${networks.length} network${networks.length !== 1 ? 's' : ''} visible to ${tessel.name}:`);

        // Print out networks
        networks.forEach((network) => {
          log.basic(`\t${network.ssid} (${network.quality})`);
        });
      });
  });
};

controller.getWifiInfo = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, function(tessel) {
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

        log.info('Connected to "' + network.ssid + '"');
        ips.forEach(function(ip) {
          log.info('IP Address: ' + ip);
        });
        log.info('Signal Strength: (' + network.quality + '/' + network.quality_max + ')');
        log.info('Bitrate: ' + Math.round(network.bitrate / 1000) + 'mbps');
      })
      .then(() => {
        return controller.closeTesselConnections([tessel]);
      });
  });
};

controller.connectToNetwork = function(options) {
  options.authorized = true;
  var ssid = options.ssid;
  var password = options.password;
  var security = options.security;
  var securityOptions = ['none', 'wep', 'psk', 'psk2', 'wpa', 'wpa2'];
  return new Promise(function(resolve, reject) {
      if (!ssid) {
        return reject('Invalid credentials: must set SSID with the -n or --ssid option.');
      }

      if (security && !password) {
        return reject('Invalid credentials: must set a password with the -p or --password option.');
      }

      if (security) {
        if (securityOptions.indexOf(security) === -1) {
          return reject(`"${security}" is not a valid security option. Please choose one of the following: ${securityOptions.join(', ')}`);
        } else if (security.match(/wpa2?/)) {
          return reject(`"${security}" security is not yet implemented. Please see this issue for more details -> https://github.com/tessel/t2-cli/issues/803`);
        }
      }
      resolve();
    })
    .then(() => {
      return controller.standardTesselCommand(options, (tessel) => tessel.connectToNetwork(options));
    });
};

controller.setWiFiState = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => tessel.setWiFiState(options.on));
};

controller.createAccessPoint = function(options) {
  options.authorized = true;
  var ssid = options.ssid;
  var password = options.password;
  var security = options.security;
  var securityOptions = ['none', 'wep', 'psk', 'psk2'];

  return new Promise((resolve, reject) => {
      if (!ssid) {
        reject('Invalid credentials. Must set ssid');
      }

      if (security && !password) {
        reject('Invalid credentials. Must set a password with security option');
      }

      if (security && securityOptions.indexOf(security) === -1) {
        reject(`${security} is not a valid security option. Please choose on of the following: ${securityOptions.join(', ')}`);
      }

      if (security === 'wep') {
        // WEP passphrases can be 10, 26, or 58 hexadecimal digits long.
        // Reference -> http://ieeexplore.ieee.org/xpl/articleDetails.jsp?arnumber=654749&isnumber=14251&punumber=5258&k2dockey=654749@ieeestds&query=%28802.11+1997%29%3Cin%3Emetadata&pos=0
        // Match for hexadecimal characters:
        if (isNaN(`0x${password}`)) {
          return reject('Invalid passphrase: WEP keys must consist of hexadecimal digits, i.e. 0 through 9 and "a" through "f".');
        }
        // Then test for length:
        const length = password.length;
        if (length !== 10 && length !== 26 && length !== 58) {
          return reject('Invalid passphrase: WEP keys must be 10, 26, or 58 digits long for 64-, 128-, and 256-bit WEP.');
        }
      }

      if (security === 'psk' || security === 'psk2') {
        // WPA/WPA2-PSK passphrases can be 8-63 ASCII characters, or 64 hexadecimal digits.
        // Reference -> http://standards.ieee.org/getieee802/download/802.11i-2004.pdf
        // Match ASCII codes for all 127 printable ASCII characters:
        const asciiRegex = /^[\x00-\x7F]{8,63}$/;
        // Match exactly 64 hexadecimal digits:
        const hexTest = !isNaN(`0x${password}`) && password.length === 64;
        // Reject if both tests fail.
        if (!asciiRegex.test(password) && !hexTest) {
          return reject('Invalid passphrase: WPA/WPA2-PSK passkeys must be 8-63 ASCII characters, or 64 hexadecimal digits.');
        }
      }
      resolve();
    })
    .then(() => {
      return controller.standardTesselCommand(options, (tessel) => tessel.createAccessPoint(options));
    });
};

controller.enableAccessPoint = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => tessel.enableAccessPoint());
};

controller.disableAccessPoint = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => tessel.disableAccessPoint());
};

controller.getAccessPointInfo = function(options) {
  options.authorized = true;
  return controller.standardTesselCommand(options, (tessel) => {
    return tessel.getAccessPointInfo()
      .then((ap) => {
        if (ap.ssid) {
          log.info(`SSID: ${ap.ssid}`);

          if (ap.key || ap.encryption !== 'none') {
            log.info(`Password: ${ap.key}`);
          }

          log.info(`Security: ${ap.encryption}`);
          log.info(`IP Address: ${ap.ip}`);
          log.info(`State: ${(!Number(ap.disabled) ? 'Enabled' : 'Disabled')}`);
        } else {
          log.info(`${tessel.name} is not configured as an access point (run "t2 ap --help" to learn more)`);
        }
      });
  });
};

/*
  The T2 root command is used to login into the Tessel's root shell.
*/
controller.root = function(options) {
  // Only give us LAN connections
  options.lan = true;
  // We must already be authorized
  options.authorized = true;
  // Disable USB flag if passed
  if (options.usb) {
    options.usb = false;
    log.warn('You are trying to connect to Tessel via USB, but this command only works with Wifi.');
    log.warn('I will use Wifi to try and look for your Tessel.');
  }

  // Fetch a Tessel
  return controller.standardTesselCommand(options, function(tessel) {
    log.info('Starting SSH Session on Tessel. Type "exit" at the prompt to end.');
    return new Promise(function(resolve, reject) {
      // Spawn a new SSH process
      var child = cp.spawn('ssh', ['-i',
        // Use the provided key path
        Tessel.LOCAL_AUTH_KEY,
        // Connect to the Tessel's IP Address
        'root@' + tessel.lanConnection.ip
      ], {
        // Pipe our standard streams to the console
        stdio: 'inherit'
      });

      log.spinner.stop();

      // Report any errors on connection
      child.once('error', function(err) {
        return reject('Failed to start SSH session: ' + err.toString());
      });

      // Close the process when we no longer can communicate with the process
      child.once('close', resolve);
      child.once('disconnect', resolve);
    });
  });
};

controller.printAvailableUpdates = function() {
  return updates.requestBuildList().then((builds) => {
    log.info('Latest builds:');

    // Reverse the list to show the latest version first
    builds.reverse().slice(0, 10).forEach((build) => {
      var published = new Date(build.released).toLocaleString();
      log.basic(`Version: ${build.version}\tPublished: ${published}`);
    });
  });
};

controller.update = function(opts) {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, (tessel) => {
    if (opts['openwrt-path'] || opts['firmware-path']) {
      return controller.updateWithLocalBuilds(opts, tessel);
    } else {
      return controller.updateWithRemoteBuilds(opts, tessel);
    }
  });
};

controller.updateWithLocalBuilds = function(opts, tessel) {
  return updates.loadLocalBinaries(opts)
    .then((images) => tessel.update(opts, images))
    .then(() => log.info('Finished updating Tessel with local builds.'));
};

controller.updateWithRemoteBuilds = function(opts, tessel) {
  return new Promise((resolve, reject) => {
    // If it's not connected via USB, we can't update it
    if (!tessel.usbConnection) {
      return reject('Must have Tessel connected over USB to complete update. Aborting update.');
    }

    return updates.requestBuildList().then(builds => {

        var version = opts.version || 'latest';
        var versionFromSHA = Promise.resolve(version);

        // If we aren't forcing, we'll want to get the current SHA on Tessel
        if (!opts.force) {
          // Once we have the Tessel
          // Over-ride the resolved Promise
          versionFromSHA = new Promise((resolve, reject) => {
            // Figure out what commit SHA is running on it
            return tessel.fetchCurrentBuildInfo()
              // Once we have the current SHA, provide the version
              .then(currentSHA => resolve(updates.findBuild(builds, 'sha', currentSHA)))
              .catch(error => {
                // If there was an error because the version file doesn't exist
                if (error.message.search('No such file or directory') !== -1) {
                  // Warn the user
                  log.warn(`Could not find firmware version on ${tessel.name}`);

                  if (opts.force !== false) {
                    // Force the update
                    opts.force = true;
                    // Notify the user
                    log.warn('Forcefully updating...');
                    // Resolve instead of reject (the string isn't used anywhere)
                    return resolve('unknown version');
                  } else {
                    // Reject because the user specifically did not want to force
                    return reject(error);
                  }
                } else {
                  // Reject because an unknown error occurred
                  return reject(error);
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
            return controller.updateTesselWithVersion(opts, tessel, currentVersionInfo.version, build);
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
            if (!opts.force && semver.gte(currentVersionInfo.version, verifiedVersion)) {
              // If it's not, close the Tessel connection and print the error message
              var message = tessel.name + ' is already on the latest firmware version (' + currentVersionInfo.version + '). You can force an update with "t2 update --force".';

              log.warn(message);

              return resolve();
            } else {
              if (!opts.force) {
                // If it is a newer version, let's update...
                log.info('New firmware version found...' + verifiedVersion);
              }

              log.info('Updating ' + tessel.name + ' to latest version (' + verifiedVersion + ')...');

              // Fetch the requested version
              return controller.updateTesselWithVersion(opts, tessel, currentVersionInfo.version, build);
            }
          }
        });
      })
      .then(resolve)
      .catch(reject);
  });
};

controller.updateTesselWithVersion = function(opts, tessel, currentVersion, build) {

  // Fetch the requested build
  return updates.fetchBuild(build)
    .then(function startUpdate(image) {
      // Update Tessel with it
      return tessel.update(opts, image)
        // Log that the update completed
        .then(function logCompletion() {
          if (!opts.force) {
            log.info('Updated', tessel.name, 'from ', currentVersion, ' to ', build.version);
          } else {
            log.info('Force updated', tessel.name, 'to version', build.version);
          }
        });
    });
};

controller.tesselEnvVersions = opts => {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, tessel => {
    return new Promise((resolve, reject) => {
      Promise.all([
        updates.requestBuildList(),
        tessel.fetchCurrentBuildInfo(),
        tessel.fetchNodeProcessVersion(),
      ]).then(responses => {
        /*
          responses[0] => (array)  Entries contain released data, sha, version
          responses[1] => (string) SHA of current build
          responses[2] => (string) process.version (on board)
         */

        var cliVersion = require('../package.json').version;
        var firmwareVersion = updates.findBuild(responses[0], 'sha', responses[1]).version;
        var nodeVersion = responses[2];

        log.info('Tessel Environment Versions:');
        log.info(`t2-cli: ${cliVersion}`);
        log.info(`t2-firmware: ${firmwareVersion}`);
        log.info(`Node.js: ${nodeVersion}`);

        resolve();
        // If any of the requests for version data fail,
        // then this whole operation should fail.
      }, reject).catch(reject);
    });
  });
};

controller.reboot = opts => {
  opts.authorized = true;
  return controller.standardTesselCommand(opts, tessel => {
    return new Promise((resolve, reject) => {
      tessel.reboot().then(() => {
        log.info('Tessel Rebooting...');
        resolve();
      }).catch(error => reject(error));
    });
  });
};

controller.createNewProject = init.createNewProject;

controller.crashReporter = function(options) {
  var cr = Promise.resolve();

  // t2 crash-reporter --on
  if (options.on) {
    cr = CrashReporter.on();
  } else if (options.off) {
    // t2 crash-reporter --off
    cr = CrashReporter.off();
  }

  // t2 crash-reporter --test
  if (options.test) {
    // not handling failures, as we want to trigger a crash
    cr.then(CrashReporter.test)
      .then(module.exports.closeSuccessfulCommand);
  } else {
    cr.then(CrashReporter.status)
      .then(
        module.exports.closeSuccessfulCommand,
        module.exports.closeFailedCommand
      );
  }

  return cr;
};

controller.installer = function(options) {
  options.action = 'install';
  return installer[options.operation](options);
};

controller.uninstaller = function(options) {
  options.action = 'uninstall';
  return installer[options.operation](options);
};

// Primary export
module.exports = controller;

// Shared exports
module.exports.listTessels = controller.list;
module.exports.getTessel = controller.get;
