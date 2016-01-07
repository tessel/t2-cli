// System Objects
var path = require('path');

// Third Party Dependencies
var browserify = require('browserify');
var tags = require('common-tags');
var fs = require('fs-extra');
var fsTemp = require('fs-temp');
var glob = require('glob');
var Ignore = require('fstream-ignore');
var Reader = require('fstream').Reader;
var tar = require('tar');
var uglify = require('uglify-js');

// Internal
var commands = require('./commands');
var logs = require('../logs');
var Tessel = require('./tessel');

var PUSH_START_SCRIPT_NAME = 'start';

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
    // Stop running any existing scripts
    return actions.execRemoteCommand(self, 'stopRunningScript')
      .then(function() {
        var prom;

        if (opts.single) {
          // Always be sure the appropriate dir is created
          prom = actions.execRemoteCommand(self, 'createFolder', Tessel.REMOTE_RUN_PATH);
        } else {
          // Delete any code that was previously at this file path
          prom = actions.execRemoteCommand(self, 'deleteFolder', Tessel.REMOTE_RUN_PATH);
          // Create the folder again
          prom = prom.then(function() {
            return actions.execRemoteCommand(self, 'createFolder', Tessel.REMOTE_RUN_PATH);
          });

          // If we are pushing code
          if (opts.push) {
            // Delete any old flash folder
            prom = prom.then(function() {
                return actions.execRemoteCommand(self, 'deleteFolder', Tessel.REMOTE_PUSH_PATH);
              })
              // Create a new flash folder
              .then(function() {
                return actions.execRemoteCommand(self, 'createFolder', Tessel.REMOTE_PUSH_PATH);
              });
          }
        }

        // Bundle and send tarred code to T2
        return prom.then(function() {
            return actions.sendBundle(self, opts);
          })
          .then(function(script) {
            if (isPush) {
              // Push the script into flash
              return actions.pushScript(self, script, opts).then(resolve);
            } else {
              // Push the code into ram
              return actions.runScript(self, script, opts).then(resolve);
            }
          });
      })
      .catch(reject);
  });
};

Tessel.prototype.restartScript = function(opts) {
  var self = this;
  var isPush = opts.type === 'flash';
  var filepath = isPush ? Tessel.REMOTE_PUSH_PATH : Tessel.REMOTE_RUN_PATH;

  return new Promise(function(resolve, reject) {
    return self.simpleExec(commands.readFile(filepath + opts.entryPoint))
      .then(function() {
        if (isPush) {
          // Start the script from flash memory
          return actions.startPushedScript(self, opts.entryPoint, opts)
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

    if (!single) {
      while (path.dirname(pushdir) !== pushdir &&
        !fs.existsSync(path.join(pushdir, 'package.json'))) {
        relpath = path.join(path.basename(pushdir), relpath);
        pushdir = path.dirname(pushdir);
      }

      if (path.dirname(pushdir) === pushdir) {
        reject('Invalid project directory');
      }
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

actions.sendBundle = function(tessel, opts) {
  return new Promise(function(resolve, reject) {
    // Execute the remote untar process command
    return tessel.connection.exec(commands.untarStdin(Tessel.REMOTE_RUN_PATH))
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
          }).catch(reject);
        }).catch(reject);
      });
  });
};

actions.glob = {};
actions.glob = {
  /*
    A wrapper that allows for stubbing/spying in our tests.
   */
  sync: function(pattern, options) {
    return glob.sync(pattern, options);
  },

  /*
    Generate an array of glob pattern rules defined within all files
    that match the file name provided.

      actionsglob.rules(target, '.tesselignore')
        -> will compile patterns found in all nested .tesselignore files

      actionsglob.rules(target, '.tesselinclude')
        -> will compile patterns found in all nested .tesselinclude files

   */
  rules: function(target, nameOfFileContainingGlobPatterns) {
    // Patterns that are passed directly to glob.sync
    // are implicitly path.normalize()'ed
    var files = actions.glob.sync(target + '/**/*' + nameOfFileContainingGlobPatterns, {
      dot: true,
      mark: true,
    });

    return files.reduce(function(rules, file) {
      var dirname = path.dirname(file);
      var patterns = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).reduce(function(patterns, pattern) {
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
  },
  /*
    Generate a complete list of files, from cwd down, that match all
    patterns in an array of glob pattern rules.

      actions.glob.files(cwd, [ '*.js' ])
        -> will return an array of all .js files in the cwd.

      actions.glob.files(cwd, [ '**\/*.js' ])
        -> will return an array of all .js files in the cwd.


    Ignore any escaping, it's there solely to prevent
    this pattern from closing the multi-line comment.
   */
  files: function(cwd, rules) {
    return rules.reduce(function(files, rule) {
      return files.concat(
        actions.glob.sync(rule, {
          cwd: cwd
        })
      );
    }, []);
  }
};


actions.tarBundle = function(opts) {
  var target = opts.target || process.cwd();
  var relative = path.relative(process.cwd(), target);
  var globRoot = relative || target;
  var packer = tar.Pack({
    noProprietary: true
  });
  var buffers = [];

  if (opts.full) {
    opts.slim = false;
  }

  var includeRules = actions.glob.rules(target, '.tesselinclude');
  var includeFiles = actions.glob.files(globRoot, includeRules);
  var includeNegateRules = includeRules.reduce(function(rules, pattern) {
    if (pattern.indexOf('!') === 0) {
      rules.push(pattern.slice(1));
    }
    return rules;
  }, []);


  if (opts.slim) {
    logs.info('Generating slim build.');
    return new Promise(function(resolve, reject) {
      var ignoreRules = actions.glob.rules(target, '.tesselignore').concat(includeNegateRules);
      var ignoreFiles = actions.glob.files(globRoot, ignoreRules);

      var fileCount = 0;
      var entry = path.join(relative, opts.resolvedEntryPoint);
      var bify = actions.browserify(entry, {
        builtins: false,
        commondir: false,
        browserField: false,
        detectGlobals: false,
        ignoreMissing: true
      });

      // Inform browserify bundler instance
      // of all files to exclude. If a file exists in the
      // inclusion list, then DO NOT exclude it from the
      // bundling phase.
      ignoreFiles.forEach(function(file) {
        if (includeFiles.indexOf(file) >= 0) {
          return;
        }
        bify.exclude(path.join(globRoot, file));
      });

      bify
        .on('file', function() {
          // The result of this counter will be used to
          // determine if the bundle can actually be replaced
          // by the original entry point.
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

            var bundleTempDir = fsTemp.mkdirSync();
            var bundleTempFile = path.join(bundleTempDir, opts.slimPath);

            // Write the primary bundle file
            fs.writeFileSync(bundleTempFile, actions.compress(results));

            // Copy any files that matched all .tesselinclude patterns
            includeFiles.forEach(function(file) {
              fs.copySync(path.join(globRoot, file), path.join(bundleTempDir, file));
            });

            var fstream = new Reader({
              path: bundleTempDir,
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
                fs.remove(bundleTempDir, function(error) {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(Buffer.concat(buffers));
                  }
                });
              });
          }
        });
    });
  } else {

    return new Promise(function(resolve, reject) {
      var fstream = new Ignore({
        basename: '',
        path: target,
        ignoreFiles: ['.tesselignore']
      });

      // Don't send the actual rules files
      fstream.addIgnoreRules([
        '**/.tesselignore',
        '**/.tesselinclude',
      ]);

      if (includeNegateRules.length) {
        fstream.addIgnoreRules(includeNegateRules);
      }

      if (!opts.single && includeFiles.length) {
        // Instead of making a complete subclass of Ignore (as is done in fstream-npm,
        // https://github.com/npm/fstream-npm/blob/master/fstream-npm.js#L91-L183),
        // we'll over-ride the just the `applyIgnores` method for cases where there
        // are .tesselinclude entries that have explicit inclusion rules.
        fstream.applyIgnores = function(entry, partial, entryObj) {
          if (includeFiles.indexOf(entry) !== -1) {
            return true;
          }

          return Ignore.prototype.applyIgnores.call(fstream, entry, partial, entryObj);
        };
      }

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

actions.runScript = function(t, entryPoint, opts) {
  var actualEntryPointName = opts.slim ? opts.slimPath : entryPoint;

  logs.info('Running %s...', opts.slim ? 'bundled project' : entryPoint);
  return new Promise(function(resolve) {
    return t.connection.exec(commands.runScript(Tessel.REMOTE_RUN_PATH, actualEntryPointName), {
        pty: true
      })
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
  var actualEntryPointName = opts.slim ? opts.slimPath : entryPoint;
  // Write the node start file
  return actions.writeToFile(t, actualEntryPointName)
    .then(function start() {
      // Then start the script
      return actions.startPushedScript(t, actualEntryPointName, opts);
    });
};

actions.writeToFile = function(t, entryPoint) {
  return new Promise(function(resolve) {
    // Path of the script to run a Node project
    var shellScriptPath = path.join(Tessel.REMOTE_PUSH_PATH, PUSH_START_SCRIPT_NAME);
    // Open a stdin pipe tp the file
    return t.connection.exec(commands.openStdinToFile(shellScriptPath))
      // If it was opened successfully
      .then(function(remoteProcess) {
        // When the remote process finishes
        remoteProcess.once('close', function() {
          // Set the perimissions on the file to be executable
          return t.connection.exec(commands.setExecutablePermissions(shellScriptPath))
            .then(function(remoteProcess) {
              // When that process completes
              remoteProcess.once('close', function() {
                // Let the user know
                logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
                return resolve();
              });
            });
        });

        var shellScript = tags.stripIndent `
          #!/bin/sh
          cd /app/remote-script
          exec node ${entryPoint}
        `;
        remoteProcess.stdin.end(new Buffer(shellScript.trim()));
      });
  });
};

actions.startPushedScript = function(tessel, entryPoint, opts) {
  return new Promise(function(resolve) {
    // Once it has been written, run the script with Node
    return tessel.connection.exec(commands.moveFolder(Tessel.REMOTE_RUN_PATH, Tessel.REMOTE_PUSH_PATH))
      .then(tessel.receive)
      .then(function() {
        return tessel.connection.exec(commands.startPushedScript())
          .then(function(remoteProcess) {
            return tessel.receive(remoteProcess).then(function() {
              logs.info('Running %s...', opts.slim ? 'bundled project' : entryPoint);
              return resolve();
            });
          });
      });
  });
};

// To make these operations testable, we must wrap them
// in our own exported `actions`.

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
