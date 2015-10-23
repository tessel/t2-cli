var Tessel = require('./tessel');
var commands = require('./commands');
var logs = require('../logs');
var fs = require('fs');
var path = require('path');
var tar = require('tar');
var Ignore = require('fstream-ignore');
var browserify = require('browserify');
var uglify = require('uglifyify');

var PUSH_START_SCRIPT_NAME = 'start';
var NODE_PUSH_SCRIPT = __dirname + '/../../resources/start_node_script.sh';

// Used to store local functionality and allow
// exporting those definitions for testing.
var actions = {};

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
            logs.info('Writing %s to %s on %s (%d kB)...', project.entryPoint, memtype, tessel.name, bundle.length / 1000);

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
  var pack = tar.Pack();
  var buffers = [];

  if (opts.slim) {
    logs.info('Generating slim build.');
    return new Promise(function(resolve, reject) {
      var b = browserify(opts.resolvedEntryPoint, {
        builtins: false,
        commondir: false,
        browserField: false,
        detectGlobals: false,
        ignoreMissing: true,
      });
      b.transform(uglify);
      b.bundle(function(err, results) {
        if (err) {
          reject(err);
        } else {
          fs.writeFileSync(opts.slimPath, results.toString());

          var fstream = new Ignore({
            path: target,
            ignoreFiles: ['.tesselignore']
          });

          fstream.addIgnoreRules(['*', '!' + opts.slimPath]);

          fstream.basename = '';
          pack._noProprietary = true;

          fstream.on('entry', function(entry) {
            entry.root = {
              path: entry.path
            };
          });

          fstream.pipe(pack)
            .on('data', function(chunk) {
              buffers.push(chunk);
            })
            .on('error', function(data) {
              reject(data);
            })
            .on('end', function() {
              fs.unlinkSync(opts.slimPath);

              resolve(Buffer.concat(buffers));
            });
        }
      });
    });
  } else {

    return new Promise(function(resolve, reject) {
      var fstream = new Ignore({
        path: target,
        ignoreFiles: ['.tesselignore']
      });

      if (opts.single) {
        fstream.addIgnoreRules(['*', '!' + opts.resolvedEntryPoint]);
      }

      fstream.basename = '';
      pack._noProprietary = true;

      // This ensures that the remote root directory
      // is the same level as the directory containing
      // our program entry-point files.
      fstream.on('entry', function(entry) {
        entry.root = {
          path: entry.path
        };
      });

      // Send the ignore-filtered file stream into the tar packer
      fstream.pipe(pack)
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
  logs.info('Running %s...', entryPoint);
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


if (global.IS_TEST_ENV) {
  module.exports = actions;
}
