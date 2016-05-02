// System Objects
var cp = require('child_process');
var path = require('path');
var StringDecoder = require('string_decoder').StringDecoder;
var zlib = require('zlib');

// Third Party Dependencies
var acorn = require('acorn');
var bindings = require('bindings');
var tags = require('common-tags');
var fs = require('fs-extra');
var fsTemp = require('fs-temp');
var glob = require('glob');
var Ignore = require('fstream-ignore');
var minimatch = require('minimatch');
var Project = require('t2-project');
var Reader = require('fstream').Reader;
var request = require('request');
var tar = require('tar');
var uglify = require('uglify-js');
var urljoin = require('url-join');

// Internal
var commands = require('./commands');
var deployLists = require('./deploy-lists');
// var deployment = require('./deployment/');
var logs = require('../logs');
var Preferences = require('../preferences');
// Necessary to ensure that the next line has had the LOCAL_AUTH_PATH descriptor added.
var provision = require('./provision'); // jshint ignore:line
var Tessel = require('./tessel');

// Language: js
var binaryModulesUsed = new Map();
var isWindows = process.platform.startsWith('win');

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

// Language: js
const BINARY_SERVER_ROOT = 'http://packages.tessel.io/npm/';
const BINARY_CACHE_PATH = path.join(Tessel.LOCAL_AUTH_PATH, 'binaries');

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

actions.findProject = function(opts) {
  return new Promise(function(resolve, reject) {
    var single = opts.single;
    var file = opts.entryPoint;
    var home = process.env[isWindows ? 'USERPROFILE' : 'HOME'];
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

    var pushdir = fs.realpathSync(path.dirname(file)) || '';
    var relpath = '';

    if (!single) {
      while (path.dirname(pushdir) !== pushdir &&
        !fs.existsSync(path.join(pushdir, 'package.json'))) {
        relpath = path.join(path.basename(pushdir), relpath);
        pushdir = path.dirname(pushdir);

        if (pushdir === undefined) {
          pushdir = '';
        }
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
      }).catch(reject);
    });
  });
};

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
          patterns.push({
            isExplicitDir: pattern.endsWith('/'),
            pattern: path.relative(target, path.join(dirname, pattern))
          });
        }

        return patterns;
      }, []);

      return rules.concat(patterns);
    }, []).reduce(function(rules, entry) {

      var rule = entry.pattern;

      if (!entry.isExplicitDir && !entry.pattern.includes('.')) {
        rules.push(entry.pattern);
      }

      if (rule[rule.length - 1] === '/') {
        rule += '**/*.*';
      }

      if (rule[rule.length - 1] !== '*' && rule.indexOf('.') === -1) {
        rule += '/**/*.*';
      }

      rules.push(rule);
      return rules;
    }, []);
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
  var buildexp = isWindows ?
    /(?:build\\(Debug|Release|bindings)\\)/ :
    /(?:build\/(Debug|Release|bindings)\/)/;

  binaryModulesUsed.clear();

  return new Promise((resolve, reject) => {
    // Find all modules that include a compiled binary
    var patterns = ['node_modules/**/*.node', 'node_modules/**/binding.gyp'];
    var binaries = actions.glob.files(globRoot, patterns).reduce((bins, globPath) => {
      // Gather information about each found module
      var resolved = true;
      var modulePath = bindings.getRoot(globPath);
      var packageJson = require(path.join(globRoot, modulePath, 'package.json'));
      var binName = path.basename(globPath);
      var buildPath = path.normalize(globPath.replace(path.join(modulePath), '').replace(binName, ''));
      var buildType = (function() {
        var matches = buildPath.match(buildexp);
        if (matches && matches.length) {
          return matches[1];
        }
        return 'Release';
      }());

      // If the compiled module doesn't actually need a binary.node
      // injected into the bundle, then there is nothing to do.
      if (packageJson.tessel && packageJson.tessel.skipBinary) {
        return bins;
      }

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
            // unusable. There are too many failure modes here, no way to recover.
            resolved = false;
          }
        }

        if (resolved) {
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
      }

      bins.push({
        binName: binName,
        buildPath: buildPath,
        buildType: buildType,
        globPath: globPath,
        ignored: false,
        name: packageJson.name,
        modulePath: modulePath,
        resolved: resolved,
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
                details.resolved = false;

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
    return Promise.all(requests).then(() => resolve(binaryModulesUsed)).catch(reject);
  });
};

actions.resolveBinaryModules.readGypFileSync = function(gypfile) {
  var python = process.env.PYTHON || 'python';
  var program = `import ast, json; print json.dumps(ast.literal_eval(open("${gypfile}").read()));`;
  var decoder = new StringDecoder('utf8');
  var result = cp.spawnSync(python, ['-c', program]);
  var output = result.output;

  if (output == null) {
    return '';
  }

  return output.reduce((accum, buffer) => {
    if (buffer) {
      accum += decoder.write(buffer);
    }
    return accum;
  }, '');
};

actions.injectBinaryModules = function(globRoot, tempBundlePath, options) {
  var binaryPathTranslations = deployLists.binaryPathTranslations['*'];

  return new Promise((resolve) => {
    options = options || {};

    if (options.single) {
      return resolve();
    }

    // For every binary module in use...
    binaryModulesUsed.forEach(details => {
      if (details.resolved) {
        var translations = binaryPathTranslations.slice().concat(
          deployLists.binaryPathTranslations[details.name] || []
        );
        var buildDir = details.buildPath.replace(path.dirname(details.buildPath), '');
        var sourceBinaryPath = path.join(details.extractPath, buildDir, details.binName);
        var tempTargetModulePath = path.join(tempBundlePath, details.modulePath);
        var tempTargetBinaryPath = path.join(tempTargetModulePath, details.buildPath, details.binName);

        sourceBinaryPath = translations.reduce((accum, translation) => {
          return accum.replace(translation.find, translation.replace);
        }, sourceBinaryPath);

        tempTargetBinaryPath = translations.reduce((accum, translation) => {
          return accum.replace(translation.find, translation.replace);
        }, tempTargetBinaryPath);

        fs.copySync(sourceBinaryPath, tempTargetBinaryPath);

        // Also ensure that package.json was copied.
        fs.copySync(
          path.join(globRoot, details.modulePath, 'package.json'),
          path.join(tempTargetModulePath, 'package.json')
        );
      } else {
        if (!details.ignored) {
          logMissingBinaryModuleWarning(details.name);
        }
        // In the future we may allow users to log the ignored modules here
      }
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

  var ignoreRules = actions.glob.rules(target, '.tesselignore').concat(includeNegateRules);
  var ignoreFiles = actions.glob.files(globRoot, ignoreRules);

  var matchOptions = {
    matchBase: true,
    dot: true
  };

  // Mark binary modules that should be ignored
  binaryModulesUsed.forEach(details => {
    ignoreRules.forEach(rule => {
      if (minimatch(details.modulePath, rule, matchOptions)) {
        details.ignored = true;
        details.resolved = false;
      }
    });
  });

  logs.info('Building project.');


  // Both the --slim and --full paths will use a copy of the
  // project to bundle. This allows us to be destructive
  // with the files, but without directly tampering with the
  // project files themselves.
  var tempBundleDir = fsTemp.mkdirSync();

  if (opts.slim) {
    return new Promise((resolve, reject) => {
      var absRoot = path.resolve(globRoot);
      // Setup for detecting "overlooked" assets (files, directories, etc.)
      var common = ['node_modules', 'package.json', '.tesselinclude', opts.resolvedEntryPoint];
      // These will be compared against the dependency graph
      var assets = fs.readdirSync(globRoot)
        .filter(entry => (common.indexOf(entry) === -1))
        .map(entry => path.join(globRoot, entry));

      // Initialize a project for dependency graphing
      var entry = path.join(relative, opts.resolvedEntryPoint);
      var project = actions.project({
        entry: entry,
        dirname: globRoot,
      });

      project.on('error', error => reject(error));

      // Remove the includeFiles from the ignoreFiles
      ignoreFiles = ignoreFiles.filter(file => includeFiles.indexOf(file) === -1);

      // Inform the project of files to exclude
      project.exclude(
        ignoreFiles.reduce((files, file) => {
          files.push(path.normalize(file));
          files.push(path.join(globRoot, file));
          return files;
        }, [])
      );

      // Collect all files for the project
      project.collect((error, dependencies) => {
        if (error) {
          return reject(error);
        } else {
          var written = {};

          // 1. Move all dependency entries to the temp directory
          dependencies.forEach(dependency => {
            var isJS = dependency.file.endsWith('.js');
            var source = dependency.source;
            var target = path.normalize(dependency.file.replace(absRoot, tempBundleDir));
            var compressionOptions = deployLists.compressionOptions[dependency.packageName];
            var isIgnored = false;

            // Last check against ignored files. This is necessary because
            // the _entryPoint_ dirname might be further down from the project
            // root dirname, which will prevent nested rules from being applied
            ignoreFiles.forEach(file => {
              var target = path.join(absRoot, file);
              if (target === dependency.file) {
                isIgnored = true;
              }
            });

            if (isIgnored) {
              return;
            }

            if (opts.single && !dependency.entry) {
              return;
            }

            if (isJS) {
              try {
                source = actions.compress(source, compressionOptions);
              } catch (error) {
                reject(error);
              }
            }

            if (assets.length) {
              assets = assets.filter(asset => {
                // If the asset was included in the dependency graph, then it can
                // be removed from the potentially overlooked assets.
                if ((dependency.file === asset || dependency.file.includes(asset)) ||
                  path.dirname(dependency.file) === path.dirname(asset)) {
                  return false;
                }
                return true;
              });
            }

            fs.outputFileSync(target, source);

            written[target] = true;
          });

          // 2. Copy any files that matched all .tesselinclude patterns,
          //    where the file in question was actually ignored due to
          //    an ignore rule. Ultimately, .tesselinclude has the final
          //    word on any file's inclusion/exclusion
          if (!opts.single) {
            includeFiles.forEach(file => {
              var target = path.join(tempBundleDir, file);
              if (!written[target]) {
                fs.copySync(path.join(globRoot, file), target);
              }
            });
          }

          if (assets.length) {
            logs.warn('Some assets in this project were not deployed (see: t2 run --help)');
          }

          actions.injectBinaryModules(globRoot, tempBundleDir, opts)
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

      return actions.injectBinaryModules(globRoot, tempBundleDir, opts)
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

/**
 * Build project dependency graph
 * Language: js
 *
 * @param {Object} options  Specify how dependency graphing is configured and behaves.
 */
actions.project = function(options) {
  // To make these operations testable, we must wrap them
  // in our own exported `actions`.

  return new Project(options);
};

/**
 * Compress JS files
 * Language: js
 *
 * @param  {String} source  A string of JavaScript source code.
 * @param  {Source} source  A buffer containing JavaScript source code.
 *
 * @param  {Object} options Specify how compression is configured and behaves.
 * @return {String}         Minified/compressed JavaScript code.
 */
actions.compress = function(source, options) {
  source = typeof source === 'string' ? source : source.toString();

  options = options || {
    compress: {},
    mangle: {},
    special: {},
  };

  var compress = {
    // ------
    booleans: true,
    cascade: true,
    conditionals: true,
    comparisons: true,
    evaluate: true,
    hoist_funs: true,
    hoist_vars: true,
    if_return: true,
    join_vars: true,
    loops: true,
    properties: true,
    screw_ie8: true,
    sequences: true,
    unsafe: true,
    // ------
    keep_fargs: false,
    keep_fnames: false,
    warnings: false,
    drop_console: false,
  };
  var mangle = {
    sort: true,
    toplevel: true,
  };
  var special = {
    rescope_after_mangle: false,
  };

  Object.assign(compress, options.compress || {});
  Object.assign(mangle, options.mangle || {});
  Object.assign(special, options.special || {});

  var ast;

  try {
    // Attempt to use acorn, this will provide
    // better support for modern Ecma-262
    // (but unfortunately, not perfect)
    ast = uglify.AST_Node.from_mozilla_ast(
      acorn.parse(source, {
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        ecmaVersion: 7,
      })
    );
    // However, if it fails, also try uglify...
  } catch (acornError) {
    try {
      // If uglify lands _better_ ES6 support sooner,
      // this will handle that
      ast = uglify.parse(source, {
        bare_returns: true,
        fromString: true,
        warnings: false,
      });
    } catch (uglifyError) {
      // If neither parser could parse the source,
      // then we have to settle with deploying
      // uncompressed code for this file. If there
      // is a true syntax error, the program will fail
      // to run on the device itself and that's
      // a better strategy then trying to handle all
      // the edge cases ourselves. This also means
      // that ES6 code won't trigger false failures
      // on minifier parsers that haven't been updated.
      return source;
    }
  }
  // Guard against internal Uglify exceptions that
  // really shouldn't be our problem, but it happens.
  try {
    ast.figure_out_scope();
    ast = ast.transform(uglify.Compressor(compress));

    ast.figure_out_scope(mangle);
    ast.compute_char_frequency(mangle);
    ast.mangle_names(mangle);

    if (special.rescope_after_mangle) {
      ast.figure_out_scope(mangle);
    }

    var stream = uglify.OutputStream();

    ast.print(stream);

    return stream.toString();
  } catch (error) {
    return source;
  }
};

if (global.IS_TEST_ENV) {
  actions.deployLists = deployLists;
  module.exports = actions;
}
