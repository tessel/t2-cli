var Tessel = require('./tessel');
var commands = require('./commands');
var logs = require('../logs');
var fs = require('fs');
var path = require('path');
var tar = require('tar');
var Ignore = require('fstream-ignore');

var RUN_PATH = '/tmp/remote-script/';
var PUSH_PATH = '/app/';
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
    var filepath = isPush ? PUSH_PATH : RUN_PATH;

    // Stop running any existing scripts
    return actions.execRemoteCommand(self, 'stopRunningScript', filepath)
      .then(function() {
        // Delete any code that was previously at this file path
        return actions.execRemoteCommand(self, 'deleteFolder', filepath);
      })
      .then(function() {
        // Create the folder again
        return actions.execRemoteCommand(self, 'createFolder', filepath);
      })
      .then(function() {
        // Bundle and send tarred code to T2
        return actions.sendBundle(self, filepath, opts);
      })
      .then(function(script) {
        if (isPush) {
          // Push the script into flash
          actions.pushScript(self, script).then(resolve);
        } else {
          // Push the code into ram
          actions.runScript(self, filepath, script).then(resolve);
        }
      })
      .catch(reject);
  });
};

Tessel.prototype.restartScript = function(opts) {
  var self = this;
  var isPush = opts.type === 'flash';
  var filepath = isPush ? PUSH_PATH : RUN_PATH;

  return new Promise(function(resolve, reject) {
    return self.connection.exec(commands.readFile(filepath + opts.entryPoint))
      .then(function(remoteProcess) {
        var error = '';

        remoteProcess.stderr.on('data', function(data) {
          error += data.toString();
        });

        remoteProcess.once('close', function() {
          if (error.length) {
            if (error.indexOf('No such file or directory') !== -1) {
              error = '"' + opts.entryPoint + '" not found on ' + self.name;
            }

            return reject(error);
          } else {
            if (isPush) {
              // Start the script from flash memory
              actions.startPushedScript(self, opts.entryPoint)
                .then(resolve).catch(reject);
            } else {
              // Start the script in RAM
              actions.runScript(self, filepath, opts.entryPoint)
                .then(resolve).catch(reject);
            }
          }
        });
      });
  });
};

actions.execRemoteCommand = function(tessel, command, filepath) {
  return new Promise(function(resolve) {
    return tessel.connection.exec(commands[command](filepath))
      .then(function(remoteProcess) {
        remoteProcess.once('close', resolve);
      });
  });
};

actions.findProject = function(file) {
  return new Promise(function(resolve, reject) {
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

    if (checkPkgJson) {
      pkgJson = require(path.join(pushdir, 'package.json'));

      if (pkgJson.main) {
        basename = path.basename(program);
        program = path.normalize(program.replace(basename, pkgJson.main));
      }
    }

    resolve({
      pushdir: pushdir,
      program: program,
      entryPoint: path.basename(program),
    });
  });
};

actions.sendBundle = function(t, filepath, opts) {
  return new Promise(function(resolve, reject) {
    // Execute the remote untar process command
    return t.connection.exec(commands.untarStdin(filepath))
      // Once the process starts running
      .then(function(remoteProcess) {
        var error = '';

        actions.findProject(opts.entryPoint).then(function(project) {
          var resolved = path.resolve(process.cwd(), project.pushdir);

          // Collect error data as received
          remoteProcess.stderr.on('data', function(data) {
            error += data.toString();
          });

          actions.tarBundle(resolved).then(function(bundle) {
            if (error) {
              return reject(error);
            }

            // RAM or Flash for log
            var memtype;
            if (opts.push) {
              memtype = 'Flash';
            } else {
              memtype = 'RAM';
            }

            // Log write
            logs.info('Writing %s to %s on %s (%d kB)...', project.entryPoint, memtype, t.name, bundle.length / 1000);

            // Wait for the transfer to finish...
            remoteProcess.once('close', function() {
              logs.info('Deployed.');
              resolve(project.entryPoint);
            });

            // Write the code bundle to the hardware
            remoteProcess.stdin.end(bundle);
          });

        }).catch(reject);
      });
  });
};

actions.tarBundle = function(target) {
  var cwd = target || process.cwd();
  return new Promise(function(resolve, reject) {
    var buffers = [];
    var pack = tar.Pack();
    var fstream = new Ignore({
      path: cwd,
      ignoreFiles: ['.tesselignore']
    });

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
};

actions.runScript = function(t, filepath, entryPoint) {
  logs.info('Running %s...', entryPoint);
  return new Promise(function(resolve) {
    return t.connection.exec(commands.runScript(filepath, entryPoint))
      .then(function(remoteProcess) {
        function scriptStopped() {
          logs.info('Stopping script...');
          resolve();
        }

        // Once we get a SIGINT from the console, stop the script
        process.once('SIGINT', scriptStopped);

        // When the stream closes
        remoteProcess.once('close', function removeListener() {
          // Remove the process listener
          process.removeListener('SIGINT', scriptStopped);
          // Report the stopped script and quit
          scriptStopped();
        });

        // Pipe data and errors
        remoteProcess.stdout.pipe(process.stdout);
        remoteProcess.stderr.pipe(process.stderr);
      });
  });
};

actions.pushScript = function(t, entryPoint) {
  // Write the node start file
  return actions.writeToFile(t)
    .then(function start() {
      // Then start the script
      return actions.startPushedScript(t, entryPoint);
    });
};

actions.writeToFile = function(t) {
  return new Promise(function(resolve, reject) {
    // Path of the script to run a Node project
    var executablePath = PUSH_PATH + PUSH_START_SCRIPT_NAME;
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

actions.startPushedScript = function(t, entryPoint) {
  return new Promise(function(resolve) {
    // Once it has been written, run the script with Node
    return t.connection.exec(commands.startPushedScript())
      .then(function(remoteProcess) {
        remoteProcess.once('close', function() {
          logs.info('Running %s...', entryPoint);
          return resolve();
        });
      });
  });
};


if (global.IS_TEST_ENV) {
  module.exports = actions;
}
