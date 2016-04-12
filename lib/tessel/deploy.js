// System Objects
var os = require('os');
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');

// Internal
var commands = require('./commands');
var deployment = require('./deployment/');
var log = require('../log');
var Preferences = require('../preferences');
// Necessary to ensure that the next line has had the LOCAL_AUTH_PATH descriptor added.
var provision = require('./provision'); // jshint ignore:line
var Tessel = require('./tessel');

// Used to store local functionality and allow
// exporting those definitions for testing.
var exportables = {};

// Language: *
var rMemoryRow = /(.*):(?:\s+)([0-9]{1,9})/;
var replacements = {
  '(anon)': '_anon',
  '(file)': '_file',
};
// Language: *
function transformKey(value) {
  return Object.keys(replacements).reduce((value, key) => value.replace(key, replacements[key]), value);
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

        var meminfo = response.split('\n').reduce((result, row) => {
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
  opts.lang = deployment.resolveLanguage(opts.lang || opts.entryPoint);

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

            return exportables.sendBundle(this, opts);
          })
          .then(() => {
            return Preferences.write(CLI_ENTRYPOINT, entryPoint).then(() => {
              if (isPush) {
                // Push the application into flash
                return exportables.push(this, opts).then(resolve);
              } else {
                // Run the application from ram
                return exportables.run(this, opts).then(resolve);
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

  // Resolve the application's language/runtime
  opts.lang = deployment.resolveLanguage(opts.lang || opts.entryPoint);

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.readFile(filepath + opts.entryPoint))
      .then(() => {
        if (isPush) {
          // Start the script from flash memory
          return exportables.start(this, opts.entryPoint, opts)
            .then(resolve).catch(reject);
        } else {
          // Start the script in RAM
          return exportables.run(this, opts)
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


exportables.findProject = function(opts) {
  return new Promise((resolve, reject) => {
    var single = opts.single;
    var file = opts.entryPoint;
    var home = os.homedir();
    var checkConfiguration = false;
    var isDirectory = false;

    // Addresses an encountered edge case where
    // paths wouldn't resolve correctly:
    //
    // > fs.realpathSync("~/foo");
    // Error: ENOENT, no such file or directory '/Users/me/foo/~'
    // > path.dirname("~/foo")
    // '~'
    // > path.resolve("~/foo")
    // '/Users/me/foo/~/foo'
    //
    //  ...And so on...
    //
    if (/^~/.test(file)) {
      file = file.replace(/^~/, home);
    }

    try {
      // This will throw if the file or directory doesn't
      // exist. The cost of the try/catch is negligible.
      isDirectory = fs.lstatSync(file).isDirectory();
    } catch (error) {
      reject(error.message);
    }

    if (isDirectory && single) {
      return reject('You can only push a single file, not a directory');
    }

    if (isDirectory) {
      file = path.join(file, opts.lang.meta.entry);
      checkConfiguration = true;
    }

    var pushdir = fs.realpathSync(path.dirname(file)) || '';
    var relpath = '';
    var useProgramDirname = false;

    if (!single) {
      while (path.dirname(pushdir) !== pushdir &&
        !fs.existsSync(path.join(pushdir, opts.lang.meta.configuration))) {
        relpath = path.join(path.basename(pushdir), relpath);
        pushdir = path.dirname(pushdir);

        if (pushdir === undefined) {
          pushdir = '';
        }
      }

      if (exportables.endOfLookup(pushdir)) {
        // Don't bother with configuration file check, it's not there.
        checkConfiguration = false;
        useProgramDirname = true;
      }
    }

    var program = path.join(pushdir, relpath, path.basename(file));
    var basename = '';
    var validated;

    if (checkConfiguration && !single) {
      validated = opts.lang.meta.checkConfiguration(pushdir, basename, program);
      basename = validated.basename;
      program = validated.program;
    }

    // If there was no directory found containing a configuration file,
    // ie. package.json or Cargo.toml, then fallback to using the program
    // entry point's path.dirname(...)
    if (useProgramDirname) {
      pushdir = path.dirname(program);
      relpath = '';
    }

    resolve({
      pushdir: pushdir,
      program: program,
      entryPoint: path.join(relpath, path.basename(program)),
    });
  });
};

exportables.endOfLookup = function(pushdir) {
  return path.dirname(pushdir) === pushdir;
};

exportables.sendBundle = function(tessel, opts) {
  return new Promise((resolve, reject) => {
    // Execute the remote untar process command
    tessel.connection.exec(commands.untarStdin(Tessel.REMOTE_RUN_PATH), (err, remoteProcess) => {
      // Once the process starts running
      return exportables.findProject(opts).then((project) => {
        opts.target = path.resolve(process.cwd(), project.pushdir);
        opts.resolvedEntryPoint = project.entryPoint;

        return opts.lang.preBundle(opts).then(() => {
          return opts.lang.tarBundle(opts).then((bundle) => {
            // RAM or Flash for log
            var memtype;
            if (opts.push) {
              memtype = 'Flash';
            } else {
              memtype = 'RAM';
            }

            // Log write
            log.info('Writing project to %s on %s (%d kB)...', memtype, tessel.name, bundle.length / 1000);

            // Calling receive to know when the process closes
            tessel.receive(remoteProcess, (err) => {
              if (err) {
                return reject(err);
              } else {
                log.info('Deployed.');
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


exportables.run = function(tessel, opts) {
  if (opts.resolvedEntryPoint === undefined) {
    opts.resolvedEntryPoint = opts.entryPoint;
  }

  log.info('Running %s...', opts.resolvedEntryPoint);

  return new Promise((resolve, reject) => {
    var prom = Promise.resolve();

    if (opts.lang.preRun) {
      prom = opts.lang.preRun(tessel, opts);
    }

    return prom.then(() => {
      tessel.connection.exec(
        commands[opts.lang.meta.extname].execute(Tessel.REMOTE_RUN_PATH, opts.resolvedEntryPoint), {
          pty: true
        }, (error, remoteProcess) => {
          if (error) {
            return reject(error);
          }

          // When the stream closes, return from the function
          remoteProcess.once('close', resolve);

          // Pipe input TO the remote process.
          process.stdin.pipe(remoteProcess.stdin);
          process.stdin.setRawMode(true);

          // Pipe output FROM the remote process.
          remoteProcess.stdout.pipe(process.stdout);
          remoteProcess.stderr.pipe(process.stderr);
        });
    });
  });
};

exportables.push = function(tessel, opts) {
  // Write the node start file
  if (opts.resolvedEntryPoint === undefined) {
    opts.resolvedEntryPoint = opts.entryPoint;
  }

  return exportables.createShellScript(tessel, opts)
    .then(() => exportables.start(tessel, opts.resolvedEntryPoint));
};


/**
 * Write remote shell script
 * Language: *
 *
 * @param {Object} options  Specify how dependency graphing is configured and behaves.
 */
exportables.createShellScript = function(tessel, opts) {
  return new Promise((resolve, reject) => {
    // Open a stdin pipe tp the file
    tessel.connection.exec(commands.openStdinToFile(PUSH_START_SH_SCRIPT), (err, remoteProcess) => {
      if (err) {
        return reject(err);
      }
      // When the remote process finishes
      remoteProcess.once('close', () => {
        // Set the perimissions on the file to be executable
        tessel.connection.exec(commands.chmod('+x', PUSH_START_SH_SCRIPT), (err, remoteProcess) => {
          if (err) {
            return reject(err);
          }
          // When that process completes
          remoteProcess.once('close', () => {
            // Let the user know
            log.info('Your Tessel may now be untethered.');
            log.info('The application will run whenever Tessel boots up.\n     To remove this application, use "t2 erase".');
            return resolve();
          });
        });
      });
      remoteProcess.stdin.end(new Buffer(opts.lang.meta.shell(opts).trim()));
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
exportables.start = function(tessel, entryPoint) {
  return tessel.simpleExec(commands.moveFolder(Tessel.REMOTE_RUN_PATH, Tessel.REMOTE_PUSH_PATH))
    .then(() => {
      return tessel.simpleExec(commands.app.enable())
        .then(() => {
          return tessel.simpleExec(commands.app.start())
            .then(() => {
              log.info('Running %s...', entryPoint);
              return Promise.resolve();
            });
        });
    });
};

if (global.IS_TEST_ENV) {
  module.exports = exportables;
}
