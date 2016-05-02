// System Objects
var path = require('path');

// Third Party Dependencies
var tags = require('common-tags');

// Internal
var commands = require('./commands');
var deployment = require('./deployment/');
var logs = require('../logs');
var Preferences = require('../preferences');
// Necessary to ensure that the next line has had the LOCAL_AUTH_PATH descriptor added.
var provision = require('./provision'); // jshint ignore:line
var Tessel = require('./tessel');

// Used to store local functionality and allow
// exporting those definitions for testing.
var actions = {};

// Language: *
var rMemoryRow = /(.*):(?:\s+)([0-9]{1,9})/;
var replacements = {
  '(anon)': '_anon',
  '(file)': '_file',
};
// Language: *
function transformKey(value) {
  return Object.keys(replacements).reduce(function(value, key) {
    return value.replace(key, replacements[key]);
  }, value);
}

// Language: *
const PUSH_START_SH_SCRIPT = path.posix.join(Tessel.REMOTE_PUSH_PATH, 'start');
const CLI_ENTRYPOINT = 'cli.entrypoint';


/*
  Get the results of `cat /proc/meminfo` and create an object with the data.

  The produced object will look approximately like the following, where only the
  values will vary:

  {
    MemTotal: 61488000,
    MemFree: 28396000,
    MemAvailable: 42852000,
    Buffers: 4224000,
    Cached: 11860000,
    SwapCached: 0,
    Active: 11200000,
    Inactive: 8172000,
    Active_anon: 3320000,
    Inactive_anon: 52000,
    Active_file: 7880000,
    Inactive_file: 8120000,
    Unevictable: 0,
    Mlocked: 0,
    SwapTotal: 0,
    SwapFree: 0,
    Dirty: 0,
    Writeback: 0,
    AnonPages: 3304000,
    Mapped: 5260000,
    Shmem: 84000,
    Slab: 7480000,
    SReclaimable: 1836000,
    SUnreclaim: 5644000,
    KernelStack: 352000,
    PageTables: 388000,
    NFS_Unstable: 0,
    Bounce: 0,
    WritebackTmp: 0,
    CommitLimit: 30744000,
    Committed_AS: 7696000,
    VmallocTotal: 1048372000,
    VmallocUsed: 1320000,
    VmallocChunk: 1040404000
  }

  Note that the values are in BYTES!
*/

/**
 * Retrieve memory information from a Tessel 2.
 * Language: *
 *
 * @return {Promise}
 */
Tessel.prototype.memoryInfo = function() {
  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.getMemoryInfo())
      .then((response) => {
        if (!response || !response.length) {
          return reject('Could not read device memory information.');
        }

        var meminfo = response.split('\n').reduce(function(result, row) {
          var parts = row.match(rMemoryRow);
          var key, value;

          if (parts && parts.length) {
            key = transformKey(parts[1]);
            value = parseInt(parts[2], 10) * 1000;
            result[key] = value;
          }
          return result;
        }, {});

        resolve(meminfo);
      })
      .catch(reject);
  });
};
/**
 * Deploy project to a Tessel 2.
 * Language: *
 *
 * @return {Promise}
 */
Tessel.prototype.deploy = function(opts) {
  // Only an _explicit_ `true` will set push mode
  var isPush = opts.push === true;
  var entryPoint = opts.entryPoint;

  // Resolve the application's language/runtime
  opts.lang = deployment.resolveLanguage(opts.lang || path.extname(opts.entryPoint).slice(1));

  return new Promise((resolve, reject) => {
    // Stop running an existing applications
    return this.simpleExec(commands.app.stop())
      .catch((error) => {
        // This _must_ be inline
        if (error.length > 0) {
          throw new Error(`Remote command: ${commands.app.stop().join(' ')} failed.`);
        }
      })
      .then(() => {
        var prom;

        if (opts.single) {
          // Always be sure the appropriate dir is created
          prom = this.simpleExec(commands.createFolder(Tessel.REMOTE_RUN_PATH));
        } else {
          // Delete any code that was previously at this file path
          prom = this.simpleExec(commands.deleteFolder(Tessel.REMOTE_RUN_PATH));
          // Create the folder again
          prom = prom.then(() => {
            return this.simpleExec(commands.createFolder(Tessel.REMOTE_RUN_PATH));
          });

          // If we are pushing code
          if (opts.push) {
            // Delete any old flash folder
            prom = prom.then(() => {
                return this.simpleExec(commands.deleteFolder(Tessel.REMOTE_PUSH_PATH));
              })
              // Create a new flash folder
              .then(() => {
                return this.simpleExec(commands.createFolder(Tessel.REMOTE_PUSH_PATH));
              });
          }
        }

        // Bundle and send tarred code to T2
        return prom.then(() => {
            // This is where the language/runtimes will diverge.

            return actions.sendBundle(this, opts);
          })
          .then(() => {
            return Preferences.write(CLI_ENTRYPOINT, entryPoint).then(() => {
              if (isPush) {
                // Push the application into flash
                return actions.push(this, opts).then(resolve);
              } else {
                // Run the application from ram
                return actions.run(this, opts).then(resolve);
              }
            });
          });
      })
      .catch(reject);
  });
};

/**
 * Restart the last project deployed to a Tessel 2.
 * Language: *
 *
 * @return {Promise}
 */
Tessel.prototype.restart = function(opts) {
  var isPush = opts.type === 'flash';
  var filepath = isPush ? Tessel.REMOTE_PUSH_PATH : Tessel.REMOTE_RUN_PATH;

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.readFile(filepath + opts.entryPoint))
      .then(() => {
        if (isPush) {
          // Start the script from flash memory
          return actions.start(this, opts.entryPoint, opts)
            .then(resolve).catch(reject);
        } else {
          // Start the script in RAM
          return actions.run(this, opts)
            .then(resolve).catch(reject);
        }
      })
      .catch((error) => {
        if (error.message.includes('No such file or directory')) {
          error = `"${opts.entryPoint}" not found on ${this.name}`;
        }

        return reject(error);
      });
  });
};


actions.sendBundle = function(tessel, opts) {
  return new Promise(function(resolve, reject) {
    // Execute the remote untar process command
    tessel.connection.exec(commands.untarStdin(Tessel.REMOTE_RUN_PATH), (err, remoteProcess) => {
      // Once the process starts running
      return opts.lang.findProject(opts).then(function(project) {
        opts.target = path.resolve(process.cwd(), project.pushdir);
        opts.resolvedEntryPoint = project.entryPoint;

        return opts.lang.preBundling(opts).then(function() {
          return opts.lang.tarBundle(opts).then(function(bundle) {
            // RAM or Flash for log
            var memtype;
            if (opts.push) {
              memtype = 'Flash';
            } else {
              memtype = 'RAM';
            }

            // Log write
            logs.info('Writing project to %s on %s (%d kB)...', memtype, tessel.name, bundle.length / 1000);

            // Calling receive to know when the process closes
            tessel.receive(remoteProcess, (err) => {
              if (err) {
                return reject(err);
              } else {
                logs.info('Deployed.');
                resolve(project.entryPoint);
              }
            });

            // Write the code bundle to the hardware
            remoteProcess.stdin.end(bundle);
          });
        });
      }).catch(reject);
    });
  });
};


actions.run = function(tessel, opts) {
  if (opts.resolvedEntryPoint === undefined) {
    opts.resolvedEntryPoint = opts.entryPoint;
  }

  logs.info('Running %s...', opts.resolvedEntryPoint);

  return new Promise(function(resolve, reject) {
    tessel.connection.exec(commands.js.execute(Tessel.REMOTE_RUN_PATH, opts.resolvedEntryPoint), {
      pty: true
    }, (error, remoteProcess) => {
      if (error) {
        return reject(error);
      }

      // When the stream closes, return from the function
      remoteProcess.once('close', resolve);

      // Pipe data and errors
      remoteProcess.stdout.pipe(process.stdout);
      remoteProcess.stderr.pipe(process.stderr);
    });
  });
};

actions.push = function(tessel, opts) {
  // Write the node start file
  if (opts.resolvedEntryPoint === undefined) {
    opts.resolvedEntryPoint = opts.entryPoint;
  }

  return actions.createShellScript(tessel, opts)
    .then(() => actions.start(tessel, opts.resolvedEntryPoint));
};


/**
 * Write remote shell script
 * Language: js (BUT NOT OBIGATED!!)
 *
 * @param {Object} options  Specify how dependency graphing is configured and behaves.
 */
actions.createShellScript = function(tessel, opts) {
  return new Promise((resolve, reject) => {
    // Open a stdin pipe tp the file
    tessel.connection.exec(commands.openStdinToFile(PUSH_START_SH_SCRIPT), (err, remoteProcess) => {
      if (err) {
        return reject(err);
      }
      // When the remote process finishes
      remoteProcess.once('close', function() {
        // Set the perimissions on the file to be executable
        tessel.connection.exec(commands.chmod('+x', PUSH_START_SH_SCRIPT), (err, remoteProcess) => {
          if (err) {
            return reject(err);
          }
          // When that process completes
          remoteProcess.once('close', function() {
            // Let the user know
            logs.info('Your Tessel may now be untethered.');
            logs.info('The application will run whenever Tessel boots up.\n     To remove this application, use "t2 erase".');
            return resolve();
          });
        });
      });

      var shellScript = tags.stripIndent `
        #!/bin/sh
        exec ${opts.lang.binary} /app/remote-script/${opts.resolvedEntryPoint}
      `;

      remoteProcess.stdin.end(new Buffer(shellScript.trim()));
    });
  });
};


/**
 * Execute from the entry point on the tessel
 * Language: *
 *
 * @param  {Tessel} tessel     The Tessel board that has just been deployed to.
 * @param  {String} entryPoint The name of the file or executable to start on the board.
 * @return {Promise}
 */
actions.start = function(tessel, entryPoint) {
  return tessel.simpleExec(commands.moveFolder(Tessel.REMOTE_RUN_PATH, Tessel.REMOTE_PUSH_PATH))
    .then(() => {
      return tessel.simpleExec(commands.app.start())
        .then(() => {
          logs.info('Running %s...', entryPoint);
          return Promise.resolve();
        });
    });
};

if (global.IS_TEST_ENV) {
  module.exports = actions;
}
