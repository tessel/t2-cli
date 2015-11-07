var Tessel = require('./tessel');
var commands = require('./commands');
var logs = require('../logs');
var fs = require('fs');
var path = require('path');
var tar = require('tar');
var Ignore = require('fstream-ignore');
var Reader = require('fstream').Reader;
var fsTemp = require('fs-temp');
var browserify = require('browserify');
var uglify = require('uglify-js');
var glob = require('glob');

var PUSH_START_SCRIPT_NAME = 'start';
var NODE_PUSH_SCRIPT = __dirname + '/../../resources/start_node_script.sh';

// Used to store local functionality and allow
// exporting those definitions for testing.
var actions = {};

var pattern = /(.*):(?:\s+)([0-9]{1,9})/;
var replacements = {
  '(anon)': '_anon',
  '(file)': '_file',
};

function transformKey(value) {
  return Object.keys(replacements).reduce(function(value, key) {
    return value.replace(key, replacements[key]);
  }, value);
}

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

Tessel.prototype.memoryInfo = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    return actions.execRemoteCommand(self, 'getMemoryInfo')
      .then(function(response) {
        if (!response || !response.length) {
          return reject('Could not read device memory information.');
        }

        var meminfo = response.split('\n').reduce(function(result, row) {
          var parts = row.match(pattern);
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
/*
  Run a script on a Tessel
    param opts: unused so far
*/
Tessel.prototype.deployScript = function(opts) {
  var self = this;
  // Only an _explicit_ `true` will set push mode
  var isPush = opts.push === true;

  return new Promise(function(resolve, reject) {
    var filepath = isPush ? Tessel.PUSH_PATH : Tessel.RUN_PATH;

    // Stop running any existing scripts
    return actions.execRemoteCommand(self, 'stopRunningScript', filepath)
      .then(function() {
        var prom;

        if (opts.single) {
          // Always be sure the appropriate dir is created
          prom = actions.execRemoteCommand(self, 'createFolder', filepath);
        } else {
          // Delete any code that was previously at this file path
          prom = actions.execRemoteCommand(self, 'deleteFolder', filepath);
          // Create the folder again
          prom = prom.then(function() {
            return actions.execRemoteCommand(self, 'createFolder', filepath);
          });
        }

        // Bundle and send tarred code to T2
        return prom.then(function() {
            return actions.sendBundle(self, filepath, opts);
          })
          .then(function(script) {
            if (isPush) {
              // Push the script into flash
              return actions.pushScript(self, script, opts).then(resolve);
            } else {
              // Push the code into ram
              return actions.runScript(self, filepath, script, opts).then(resolve);
            }
          });
      })
      .catch(reject);
  });
};

Tessel.prototype.restartScript = function(opts) {
  var self = this;
  var isPush = opts.type === 'flash';
  var filepath = isPush ? Tessel.PUSH_PATH : Tessel.RUN_PATH;

  return new Promise(function(resolve, reject) {
    return self.simpleExec(commands.readFile(filepath + opts.entryPoint))
      .then(function() {
        if (isPush) {
          // Start the script from flash memory
          return actions.startPushedScript(self, opts.entryPoint)
            .then(resolve).catch(reject);
        } else {
          // Start the script in RAM
          return actions.runScript(self, filepath, opts.entryPoint, opts)
            .then(resolve).catch(reject);
        }
      })
      .catch(function(error) {
        if (error.message.indexOf('No such file or directory') !== -1) {
          error = '"' + opts.entryPoint + '" not found on ' + self.name;
        }

        return reject(error);
      });
  });
};

actions.execRemoteCommand = function(tessel, command, filepath) {
  return tessel.simpleExec(commands[command](filepath))
    .catch(function() {});
};

actions.findProject = function(opts) {
  return new Promise(function(resolve, reject) {
    var single = opts.single;
    var file = opts.entryPoint;
    var home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
    var checkPkgJson = false;
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
      file = path.join(file, 'index.js');
      checkPkgJson = true;
    }

    var pushdir = fs.realpathSync(path.dirname(file));
    var relpath = '';

    while (path.dirname(pushdir) !== pushdir &&
      !fs.existsSync(path.join(pushdir, 'package.json'))) {
      relpath = path.join(path.basename(pushdir), relpath);
      pushdir = path.dirname(pushdir);
    }

    if (path.dirname(pushdir) === pushdir) {
      reject('Invalid project directory');
    }

    var program = path.join(pushdir, relpath, path.basename(file));
    var pkgJson = '';
    var basename = '';

    if (checkPkgJson && !single) {
      pkgJson = require(path.join(pushdir, 'package.json'));

      if (pkgJson.main) {
        basename = path.basename(program);
        program = path.normalize(program.replace(basename, pkgJson.main));
      }
    }

    resolve({
      pushdir: pushdir,
      program: program,
      entryPoint: path.join(relpath, path.basename(program)),
    });
  });
};

actions.sendBundle = function(tessel, filepath, opts) {
  return new Promise(function(resolve, reject) {
    // Execute the remote untar process command
    return tessel.connection.exec(commands.untarStdin(filepath))
      // Once the process starts running
      .then(function(remoteProcess) {
        actions.findProject(opts).then(function(project) {
          opts.target = path.resolve(process.cwd(), project.pushdir);
          opts.resolvedEntryPoint = project.entryPoint;

          actions.tarBundle(opts).then(function(bundle) {
            // RAM or Flash for log
            var memtype;
            if (opts.push) {
              memtype = 'Flash';
            } else {
              memtype = 'RAM';
            }

            // Log write
            logs.info('Writing project to %s on %s (%d kB)...', memtype, tessel.name, bundle.length / 1000);

            tessel.receive(remoteProcess).then(function() {
              logs.info('Deployed.');
              if (opts.slim) {
                resolve(opts.slimPath);
              } else {
                resolve(project.entryPoint);
              }
            }).catch(reject);

            // Write the code bundle to the hardware
            remoteProcess.stdin.end(bundle);
          });
        }).catch(reject);
      });
  });
};

actions.tarBundle = function(opts) {
  var target = opts.target || process.cwd();
  var relative = path.relative(process.cwd(), target);
  var packer = tar.Pack({
    noProprietary: true
  });
  var buffers = [];

  if (opts.full) {
    opts.slim = false;
  }

  if (opts.slim) {
    logs.info('Generating slim build.');
    return new Promise(function(resolve, reject) {
      actions.glob(target + '/**/*.tesselignore', {
        dot: true,
        mark: true,
      }, function(error, ignoreFiles) {
        if (error) {
          return reject(error);
        }

        var rules = ignoreFiles.reduce(function(rules, ignoreFile) {
          var dirname = path.dirname(ignoreFile);
          var patterns = fs.readFileSync(ignoreFile, 'utf8').trim().split(/\r?\n/).reduce(function(patterns, pattern) {
            pattern = pattern.trim();

            // Ignores empty lines and comments
            if (pattern && !pattern.match(/^#/)) {
              patterns.push(path.relative(target, path.join(dirname, pattern)));
            }

            return patterns;
          }, []);

          return rules.concat(patterns);
        }, []).map(function(rule) {

          if (rule[rule.length - 1] === '/') {
            rule += '**/*.*';
          }

          if (rule[rule.length - 1] !== '*' && rule.indexOf('.') === -1) {
            rule += '/**/*.*';
          }

          return rule;
        });

        var fileCount = 0;
        var entry = path.join(relative, opts.resolvedEntryPoint);
        var bify = actions.browserify(entry, {
          builtins: false,
          commondir: false,
          browserField: false,
          detectGlobals: false,
          ignoreMissing: true
        });

        rules.forEach(function(rule) {
          actions.glob.sync(rule, {
            cwd: relative || target
          }).forEach(function(file) {
            bify.exclude(file);
          });
        });

        bify
          .on('file', function() {
            fileCount++;
          })
          .bundle(function(error, results) {
            if (error) {
              return reject(error);
            } else {

              // If there is only one file in this project, then there is
              // no reason to use the code generated by browserify, because
              // it will always have the module loading boilerplate included.
              if (opts.single || fileCount === 1) {
                results = fs.readFileSync(entry);
              }

              var projectDirectory = fsTemp.mkdirSync();
              var projectBundle = path.join(projectDirectory, opts.slimPath);

              fs.writeFileSync(projectBundle, actions.compress(results));

              var fstream = new Reader({
                path: projectDirectory,
                type: 'Directory',
              });

              fstream
                .on('entry', function(entry) {
                  entry.root = {
                    path: entry.path
                  };
                })
                .pipe(packer)
                .on('data', function(chunk) {
                  buffers.push(chunk);
                })
                .on('error', function(data) {
                  reject(data);
                })
                .on('end', function() {
                  fs.unlinkSync(projectBundle);
                  fs.rmdirSync(projectDirectory);
                  resolve(Buffer.concat(buffers));
                });
            }
          });
      });
    });
  } else {

    return new Promise(function(resolve, reject) {
      var fstream = new Ignore({
        basename: '',
        path: target,
        ignoreFiles: ['.tesselignore']
      });

      if (opts.single) {
        fstream.addIgnoreRules(['*', '!' + opts.resolvedEntryPoint]);
      }

      // This ensures that the remote root directory
      // is the same level as the directory containing
      // our program entry-point files.
      fstream.on('entry', function(entry) {
        entry.root = {
          path: entry.path
        };
      });

      // Send the ignore-filtered file stream into the tar packer
      fstream.pipe(packer)
        .on('data', function(chunk) {
          buffers.push(chunk);
        })
        .on('error', function(data) {
          reject(data);
        })
        .on('end', function() {
          resolve(Buffer.concat(buffers));
        });
    });
  }
};

actions.runScript = function(t, filepath, entryPoint, opts) {
  logs.info('Running %s...', opts.slim ? 'bundled project' : entryPoint);
  return new Promise(function(resolve) {
    return t.connection.exec(commands.runScript(filepath, opts.slim ? opts.slimPath : entryPoint))
      .then(function(remoteProcess) {

        // When the stream closes
        remoteProcess.once('close', resolve);

        // Pipe data and errors
        remoteProcess.stdout.pipe(process.stdout);
        remoteProcess.stderr.pipe(process.stderr);
      });
  });
};

actions.pushScript = function(t, entryPoint, opts) {
  // Write the node start file
  return actions.writeToFile(t)
    .then(function start() {
      // Then start the script
      return actions.startPushedScript(t, opts.slim ? opts.slimPath : entryPoint);
    });
};

actions.writeToFile = function(t) {
  return new Promise(function(resolve, reject) {
    // Path of the script to run a Node project
    var executablePath = path.join(Tessel.PUSH_PATH, PUSH_START_SCRIPT_NAME);
    // Open a stdin pipe tp the file
    return t.connection.exec(commands.openStdinToFile(executablePath))
      // If it was opened successfully
      .then(function(remoteProcess) {
        // When the remote process finishes
        remoteProcess.stdin.once('finish', function() {
          // Set the perimissions on the file to be executable
          return t.connection.exec(commands.setExecutablePermissions(executablePath))
            .then(function(remoteProcess) {
              // When that process completes
              remoteProcess.once('close', function() {
                // Let the user know
                logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
                return resolve();
              });
            });
        });

        // Read the contents of the node start script
        fs.readFile(NODE_PUSH_SCRIPT, function(err, data) {
          if (err) {
            return reject(err);
          }
          // Write the Node start script
          remoteProcess.stdin.end(data);
        });
      });
  });
};

actions.startPushedScript = function(tessel, entryPoint) {
  return new Promise(function(resolve) {
    // Once it has been written, run the script with Node
    return tessel.connection.exec(commands.startPushedScript())
      .then(function(remoteProcess) {
        return tessel.receive(remoteProcess).then(function() {
          logs.info('Running %s...', entryPoint);
          return resolve();
        });
      });
  });
};

// To make these operations testable, we must wrap them
// in our own exported `actions`.
actions.glob = function(pattern, options, callback) {
  glob(pattern, options, callback);
};

actions.glob.sync = function(pattern, options) {
  return glob.sync(pattern, options);
};

actions.browserify = function(entry, options) {
  return browserify(entry, options);
};

actions.compress = function(source) {
  return uglify.minify(source.toString(), {
    fromString: true
  }).code;
};

if (global.IS_TEST_ENV) {
  module.exports = actions;
}
