// System Objects
var cp = require('child_process');
var path = require('path');
var StringDecoder = require('string_decoder').StringDecoder;
var zlib = require('zlib');

// Third Party Dependencies
var bindings = require('bindings');
var tags = require('common-tags');
var fs = require('fs-extra');
var fsTemp = require('fs-temp');
var glob = require('glob');
var Ignore = require('fstream-ignore');
var Project = require('t2-project');
var Reader = require('fstream').Reader;
var request = require('request');
var tar = require('tar');
var uglify = require('uglify-js');
var urljoin = require('url-join');

// Internal
var commands = require('./commands');
var deployLists = require('./deploy-lists');
var logs = require('../logs');
// Necessary to ensure that the next line has had the LOCAL_AUTH_PATH descriptor added.
var provision = require('./provision'); // jshint ignore:line
var Tessel = require('./tessel');

var PUSH_START_SCRIPT_NAME = 'start';

// Used to store local functionality and allow
// exporting those definitions for testing.
var actions = {};

var rMemoryRow = /(.*):(?:\s+)([0-9]{1,9})/;
var replacements = {
  '(anon)': '_anon',
  '(file)': '_file',
};

function transformKey(value) {
  return Object.keys(replacements).reduce(function(value, key) {
    return value.replace(key, replacements[key]);
  }, value);
}

const BINARY_SERVER_ROOT = 'http://packages.tessel.io/npm/';
const BINARY_CACHE_PATH = path.join(Tessel.LOCAL_AUTH_PATH, 'binaries');

var binaryModulesUsed = new Map();

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
          return actions.runScript(self, filepath, opts)
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
    .catch(function(err) {
      if (err.length > 0) {
        throw new Error('we had a simple exec error!', err);
      }
    });
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
      pkgJson = fs.readJsonSync(path.join(pushdir, 'package.json'));

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
    tessel.connection.exec(commands.untarStdin(Tessel.REMOTE_RUN_PATH), (err, remoteProcess) => {
      // Once the process starts running
      return actions.findProject(opts).then(function(project) {
        opts.target = path.resolve(process.cwd(), project.pushdir);
        opts.resolvedEntryPoint = project.entryPoint;

        return actions.resolveBinaryModules(opts).then(function() {
          return actions.tarBundle(opts).then(function(bundle) {
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
      });
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

function logMissingBinaryModuleWarning(name) {
  var warning = tags.stripIndent `
    Pre-compiled module is missing: ${name}.
    This might be caused by any of the following:

    1. The binary is platform specific and cannot be compiled for OpenWRT.
    2. A pre-compiled binary has not yet been generated for this module.
    3. The binary didn't compile correctly for the platform that you're developing on.
        It's possible that the binary is Linux-only or even OpenWRT specific,
        try npm installing with "--force" and rerun your deployment command.

    Please file an issue at https://github.com/tessel/t2-cli/issues/new
    `;

  logs.warn(warning.trim());
}

actions.resolveBinaryModules = function(opts) {
  var cwd = process.cwd();
  var target = opts.target || cwd;
  var relative = path.relative(cwd, target);
  var globRoot = relative || target;
  var buildexp = /(?:build\/(Debug|Release|bindings)\/)/;

  binaryModulesUsed.clear();

  return new Promise((resolve, reject) => {
    // Find all modules that include a compiled binary
    var patterns = ['node_modules/**/*.node', 'node_modules/**/binding.gyp'];
    var binaries = actions.glob.files(globRoot, patterns).reduce((bins, globPath) => {
      // Gather information about each found module
      var modulePath = bindings.getRoot(globPath);
      var packageJson = require(path.join(globRoot, modulePath, 'package.json'));
      var binName = path.basename(globPath);
      var buildPath = globPath.replace(path.join(modulePath), '').replace(binName, '');
      var buildType = (function() {
        var matches = buildPath.match(buildexp);
        if (matches && matches.length) {
          return matches[1];
        }
        return 'Release';
      }());

      if (buildType !== 'Release' && buildType !== 'Debug') {
        buildType = 'Release';
      }

      if (binName.endsWith('.gyp')) {

        // Check that there are no matching .node paths in the ALREADY PROCESSED paths
        for (var i = 0; i < bins.length; i++) {
          if (bins[i].modulePath === modulePath) {

            // When the currently resolving binary module path has been found
            // in the list of existing binary module paths that have already been
            // accounted for, return immediately to continue to processing the
            // found binary module path candidates.
            //
            // An example:
            //
            // [
            //  "node_modules/bufferutil/build/Release/bufferutil.node",
            //  "node_modules/bufferutil/binding.gyp",
            // ]
            //
            // Note, the order will always be .node then .gyp
            return bins;
          }
        }

        // If unfound, then we have to dig around in the binding.gyp for the target_name
        // to figure out the actual name of the .node file
        //
        // If you're interested in seeing just how much of a nightmare mess these
        // files can be, take a look at this:
        //
        // https://github.com/nodejs/node-gyp/wiki/%22binding.gyp%22-files-out-in-the-wild
        //
        var bindingGypPath = path.join(globRoot, modulePath, binName);
        var bindingGypData;
        var bindingGypJson;

        try {
          // Sometimes people write really tidy binding.gyp files that are
          // actually valid JSON, which is totally awesome!
          bindingGypJson = require(bindingGypPath);
        } catch (error) {
          // ... Other times binding.gyp is an inconsistent mess, but it's still
          // a valid Python data structure. So we can spawn a python to read it.
          // Sounds gross, but there is no other clear way to do this.
          bindingGypData = actions.resolveBinaryModules.readGypFileSync(bindingGypPath);

          try {
            bindingGypJson = JSON.parse(bindingGypData);
          } catch (error) {
            // If this module's binding.gyp is missing, broken or otherwise
            // unusable, log a message about and move on. There are too
            // many failure modes here, no way to recover.

            logMissingBinaryModuleWarning(packageJson.name);
            return bins;
          }
        }

        if (bindingGypJson && Array.isArray(bindingGypJson.targets)) {
          // Anything that can't be covered by this will have to be
          // dealt with as we encounter them and as they are reported.
          binName = bindingGypJson.targets[0].target_name + '.node';

          // Assume the most likely scenario first:
          //
          // build/Release
          // build/Debug
          //
          buildPath = path.join('build', buildType);

          // Unless there is a specific `binary.module_path`.
          // Checking this only matters when the glob patterns
          // didn't turn up a .node binary.
          if (packageJson.binary && packageJson.binary.module_path) {
            buildPath = path.normalize(packageJson.binary.module_path);
            if (buildPath[0] === '.') {
              buildPath = buildPath.slice(1);
            }
          }
        }
      }

      bins.push({
        binName: binName,
        buildPath: buildPath,
        buildType: buildType,
        globPath: globPath,
        name: packageJson.name,
        modulePath: modulePath,
        version: packageJson.version,
      });

      return bins;
    }, []);

    if (!binaries.length) {
      resolve();
    }

    // Using the discovered binaries, create a Promise to
    // represent the request, receipt, and extraction process
    // for each of them.
    var requests = binaries.map(details => {
      return new Promise((resolve, reject) => {
        var tgz = `${details.name}-${details.version}-${details.buildType}.tgz`;

        // Store the name of the path where this might already
        // be cached, but will most certainly be cached once
        // it has been resolved.
        details.extractPath = path.join(BINARY_CACHE_PATH, path.basename(tgz, '.tgz'));

        // Sometimes a module will depend on other
        // modules that in turn depend on the same modules
        // as eachother. Since we only need one copy of a given
        // module, resolve this entry without any further action.
        if (binaryModulesUsed.has(details.name)) {
          return resolve();
        }

        // Update running list of binary modules that
        // this project is using.
        binaryModulesUsed.set(details.name, details);

        // If an extraction path already exists locally,
        // resolve this entry without any further action.
        if (fs.existsSync(details.extractPath)) {
          return resolve();
        } else {
          //
          // Request, receive, unzip, extract and resolve
          //
          var url = urljoin(BINARY_SERVER_ROOT, tgz);

          // Make a ~/.tessel/binaries/MODULE-NAME directory
          fs.mkdirp(details.extractPath, () => {
            // wget the tgz, save as
            // ~/.tessel/binaries/MODULE-NAME.tgz
            var gunzip = zlib.createGunzip();
            var extract = tar.Extract({
              path: details.extractPath,
            });

            gunzip.on('error', function(error) {
              if (error.code === 'Z_DATA_ERROR') {
                logMissingBinaryModuleWarning(details.name);

                // Remove from tracked binary modules
                binaryModulesUsed.delete(details.name);

                // Remove extraction directory
                fs.removeSync(details.extractPath);

                resolve();
              }
            });

            request({
                url: url,
                gzip: true,
              })
              .pipe(gunzip)
              .pipe(extract)
              .on('error', reject)
              .on('end', () => {
                // Once complete, the locally cached binary can
                // be found in ~/.tessel/binaries
                resolve();
              });
          });
        }
      });
    });

    // Resolve this operation once all binary module requests have resolved
    return Promise.all(requests).then(resolve).catch(reject);
  });
};

actions.resolveBinaryModules.readGypFileSync = function(gypfile) {
  var python = process.env.PYTHON || 'python';
  var program = `import ast, json; print json.dumps(ast.literal_eval(open("${gypfile}").read()));`;
  var decoder = new StringDecoder('utf8');
  var result = cp.spawnSync(python, ['-c', program]);
  var output = result.output;

  return output.reduce((accum, buffer) => {
    if (buffer) {
      accum += decoder.write(buffer);
    }
    return accum;
  }, '');
};

actions.injectBinaryModules = function(globRoot, tempBundlePath) {
  return new Promise((resolve) => {
    // For every binary module in use...
    binaryModulesUsed.forEach(details => {
      // console.log(details);
      var buildDir = details.buildPath.replace(path.dirname(details.buildPath), '');
      var sourceBinary = path.join(details.extractPath, buildDir, details.binName);
      var tempTargetModulePath = path.join(tempBundlePath, details.modulePath);
      var tempTargetBinary = path.join(tempTargetModulePath, details.buildPath, details.binName);

      fs.copySync(sourceBinary, tempTargetBinary);

      // Also ensure that package.json was copied.
      fs.copySync(
        path.join(globRoot, details.modulePath, 'package.json'),
        path.join(tempTargetModulePath, 'package.json')
      );
    });

    // All binary modules have been replaced, resolve.
    return resolve();
  });
};

actions.tarBundle = function(opts) {
  var cwd = process.cwd();
  var target = opts.target || cwd;
  var relative = path.relative(cwd, target);
  var globRoot = relative || target;
  var packer = tar.Pack({
    noProprietary: true
  });
  var buffers = [];

  if (opts.full) {
    opts.slim = false;
  }

  var includeRules = actions.glob.rules(target, '.tesselinclude');

  // Convert `deployLists.includes` into includeRules
  deployLists.includes.forEach(include => includeRules.push(`node_modules/**/${include}`));

  var includeFiles = actions.glob.files(globRoot, includeRules);
  var includeNegateRules = includeRules.reduce((rules, pattern) => {
    if (pattern.indexOf('!') === 0) {
      rules.push(pattern.slice(1));
    }
    return rules;
  }, []);

  // Both the --slim and --full paths will use a copy of the
  // project to bundle. This allows us to be destructive
  // with the files, but without directly tampering with the
  // project files themselves.
  var tempBundleDir = fsTemp.mkdirSync();

  logs.info('Building project.');

  if (opts.slim) {
    return new Promise((resolve, reject) => {
      // Resolve .tesselignore
      var ignoreRules = actions.glob.rules(target, '.tesselignore').concat(includeNegateRules);
      var ignoreFiles = actions.glob.files(globRoot, ignoreRules);

      // Initialize a project for dependency graphing
      var entry = path.join(relative, opts.resolvedEntryPoint);
      var project = actions.project({
        entry: entry
      });

      project.on('error', error => reject(error));

      // Inform the project of files to exclude
      project.exclude(
        ignoreFiles.reduce((files, file) => {
          if (includeFiles.indexOf(file) === -1) {
            files.push(path.normalize(file));
            files.push(path.join(globRoot, file));
          }
          return files;
        }, [])
      );

      // Collect all files for the project
      project.collect((error, dependencies) => {
        if (error) {
          return reject(error);
        } else {
          var absRoot = path.resolve(globRoot);
          var written = {};

          // 1. Move all dependency entries to the temp directory
          dependencies.forEach(dependency => {
            var isJS = dependency.file.endsWith('.js');
            var source = dependency.source;
            var target = path.normalize(dependency.file.replace(absRoot, tempBundleDir));

            if (opts.single && !dependency.entry) {
              return;
            }

            if (isJS) {
              try {
                source = actions.compress(source);
              } catch (error) {
                reject(error);
              }
            }

            fs.outputFileSync(target, source);

            written[target] = true;
          });

          // 2. Copy any files that matched all .tesselinclude patterns
          includeFiles.forEach(file => {
            var target = path.join(tempBundleDir, file);
            if (!written[target]) {
              fs.copySync(path.join(globRoot, file), target);
            }
          });

          actions.injectBinaryModules(globRoot, tempBundleDir)
            .then(() => {
              var fstream = new Reader({
                path: tempBundleDir,
                type: 'Directory',
              });

              fstream
                .on('entry', (entry) => {
                  entry.root = {
                    path: entry.path
                  };
                })
                .pipe(packer)
                .on('data', (chunk) => {
                  buffers.push(chunk);
                })
                .on('error', (data) => {
                  reject(data);
                })
                .on('end', () => {
                  fs.remove(tempBundleDir, (error) => {
                    if (error) {
                      reject(error);
                    } else {
                      resolve(Buffer.concat(buffers));
                    }
                  });
                });
            })
            .catch(reject);
        }
      });
    });
  } else {

    return new Promise((resolve, reject) => {
      // Copy the project to a temporary location.
      // This allows us a safe way to "swap" binary modules.
      fs.copySync(globRoot, tempBundleDir);

      return actions.injectBinaryModules(globRoot, tempBundleDir)
        .then(() => {
          var fstream = new Ignore({
            basename: '',
            ignoreFiles: ['.tesselignore'],
            path: tempBundleDir,
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
          fstream.on('entry', (entry) => {
            entry.root = {
              path: entry.path
            };
          });

          // Send the ignore-filtered file stream into the tar packer
          fstream.pipe(packer)
            .on('data', (chunk) => {
              buffers.push(chunk);
            })
            .on('error', (data) => {
              reject(data);
            })
            .on('end', () => {
              resolve(Buffer.concat(buffers));
            });
        })
        .catch(reject);
    });
  }
};

actions.runScript = function(t, filepath, opts) {
  logs.info('Running %s...', opts.entryPoint);
  return new Promise(function(resolve, reject) {
    t.connection.exec(commands.runScript(Tessel.REMOTE_RUN_PATH, opts.entryPoint), {
      pty: true
    }, function(err, remoteProcess) {
      if (err) {
        return reject(err);
      }

      // When the stream closes, return from the function
      remoteProcess.once('close', resolve);

      // Pipe data and errors
      remoteProcess.stdout.pipe(process.stdout);
      remoteProcess.stderr.pipe(process.stderr);
    });
  });
};

actions.pushScript = function(t, script, opts) {
  // Write the node start file
  return actions.writeToFile(t, opts.entryPoint)
    .then(function start() {
      // Then start the script
      return actions.startPushedScript(t, opts.entryPoint);
    });
};

actions.writeToFile = function(t, entryPoint) {
  return new Promise(function(resolve, reject) {
    // Path of the script to run a Node project
    var shellScriptPath = path.join(Tessel.REMOTE_PUSH_PATH, PUSH_START_SCRIPT_NAME);
    // Open a stdin pipe tp the file
    t.connection.exec(commands.openStdinToFile(shellScriptPath), (err, remoteProcess) => {
      if (err) {
        return reject(err);
      }
      // When the remote process finishes
      remoteProcess.once('close', function() {
        // Set the perimissions on the file to be executable
        t.connection.exec(commands.setExecutablePermissions(shellScriptPath), (err, remoteProcess) => {
          if (err) {
            return reject(err);
          }
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
        exec node /app/remote-script/${entryPoint}
      `;
      remoteProcess.stdin.end(new Buffer(shellScript.trim()));
    });
  });
};

actions.startPushedScript = function(tessel, entryPoint) {
  // Once it has been written, run the script with Node
  return tessel.simpleExec(commands.moveFolder(Tessel.REMOTE_RUN_PATH, Tessel.REMOTE_PUSH_PATH))
    .then(function() {
      return tessel.simpleExec(commands.startPushedScript())
        .then(() => {
          logs.info('Running %s...', entryPoint);
          return Promise.resolve();
        });
    });
};

// To make these operations testable, we must wrap them
// in our own exported `actions`.

actions.project = function(options) {
  return new Project(options);
};

actions.compress = function(source) {
  source = typeof source === 'string' ? source : source.toString();

  var content = uglify.parse(source, actions.compress.options);

  content.figure_out_scope();
  content = content.transform(uglify.Compressor({
    warnings: false
  }));

  var code = uglify.OutputStream();
  content.print(code);

  return code.toString();
};

actions.compress.options = {
  fromString: true,
  bare_returns: true,
  spidermonkey: false,
  outSourceMap: null,
  sourceRoot: null,
  inSourceMap: null,
  warnings: false,
  mangle: {},
  output: null,
  compress: {}
};

if (global.IS_TEST_ENV) {
  module.exports = actions;
}
