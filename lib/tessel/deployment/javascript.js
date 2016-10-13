// System Objects
var cp = require('child_process');
var path = require('path');
var StringDecoder = require('string_decoder').StringDecoder;
var zlib = require('zlib');

// Third Party Dependencies
var acorn = require('acorn');
var bindings = require('bindings');
var fs = require('fs-extra');
var fsTemp = require('fs-temp');
var Ignore = require('fstream-ignore');
var minimatch = require('minimatch');
var Project = require('t2-project');
var Reader = require('fstream').Reader;
var request = require('request');
var tags = require('common-tags');
var tar = require('tar');
var uglify = require('uglify-js');
var urljoin = require('url-join');

// Internal
var glob = require('./glob');
var lists = require('./lists/javascript');
var log = require('../../log');
// Necessary to ensure that the next line has had the LOCAL_AUTH_PATH descriptor added.
var provision = require('../provision'); // jshint ignore:line
var Tessel = require('../tessel');

var binaryModulesUsed = new Map();
var isWindows = process.platform.startsWith('win');

const BINARY_SERVER_ROOT = 'http://packages.tessel.io/npm/';
const BINARY_CACHE_PATH = path.join(Tessel.LOCAL_AUTH_PATH, 'binaries');

var exportables = {
  meta: {
    name: 'javascript',
    extname: 'js',
    binary: 'node',
    isFile: true,
    entry: 'index.js',
    configuration: 'package.json',
    checkConfiguration: (pushdir, basename, program) => {
      var packageJson = fs.readJsonSync(path.join(pushdir, 'package.json'));

      if (packageJson.main) {
        basename = path.basename(program);
        program = path.normalize(program.replace(basename, packageJson.main));
      }

      return {
        basename,
        program
      };
    },
    shell: (options) => {
      return tags.stripIndent `
        #!/bin/sh
        exec node /app/remote-script/${options.resolvedEntryPoint} ${options.subargs.join(' ')}
      `;
    },
  },
  lists: lists,
};

/*
exportables.preRun = function(tessel, options) {
  return Promise.resolve();
};
*/

exportables.postRun = function(tessel, options) {
  if (tessel.connection.connectionType === 'LAN') {
    // Pipe input TO the remote process.
    process.stdin.pipe(options.remoteProcess.stdin);
    process.stdin.setRawMode(true);
  }

  return Promise.resolve();
};

exportables.logMissingBinaryModuleWarning = function(details) {
  var warning = tags.stripIndent `
    Pre-compiled module is missing: ${details.name}@${details.version}.
    Please an file issue at https://github.com/tessel/t2-cli/issues/new with this warning.

    This warning might be caused by one of the following:

    1. A pre-compiled binary has not yet been built for this module.
    2. The binary didn't compile correctly for the platform that you're developing on.
       Binaries that are Linux-only or even OpenWRT-specific may cause this issue.
       Try to npm install --force the affected module, then rerun your deployment command.
    3. The binary may be platform specific and impossible to compile for OpenWRT.
    `;

  log.warn(warning.trim());
};

exportables.resolveBinaryModules = function(opts) {
  var cwd = process.cwd();
  var target = opts.target || cwd;
  var relative = path.relative(cwd, target);
  var globRoot = relative || target;
  var abi = opts.tessel.versions.modules;
  var buildexp = isWindows ?
    /(?:build\\(Debug|Release|bindings)\\)/ :
    /(?:build\/(Debug|Release|bindings)\/)/;

  binaryModulesUsed.clear();

  return new Promise((resolve, reject) => {
    // Find all modules that include a compiled binary
    var patterns = ['node_modules/**/*.node', 'node_modules/**/binding.gyp'];
    var binaries = glob.files(globRoot, patterns).reduce((bins, globPath) => {
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
          bindingGypData = exportables.resolveBinaryModules.readGypFileSync(bindingGypPath);

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

        // Example: serialport-4.0.1-Release-node-v46-linux-mipsel.tgz
        var full = `${details.name}-${details.version}-${details.buildType}-node-v${abi}-linux-mipsel`;
        var tgz = `${full}.tgz`;

        // Store the name of the path where this might already
        // be cached, but will most certainly be cached once
        // it has been resolved.
        details.extractPath = path.join(BINARY_CACHE_PATH, full);

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

exportables.resolveBinaryModules.readGypFileSync = function(gypfile) {
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

exportables.injectBinaryModules = function(globRoot, tempBundlePath, options) {
  var binaryPathTranslations = lists.binaryPathTranslations['*'];

  return new Promise((resolve) => {
    options = options || {};

    if (options.single) {
      return resolve();
    }

    // For every binary module in use...
    binaryModulesUsed.forEach(details => {
      if (details.resolved) {
        var isCopied = false;
        var translations = binaryPathTranslations.slice().concat(
          lists.binaryPathTranslations[details.name] || []
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

        try {
          fs.copySync(sourceBinaryPath, tempTargetBinaryPath);
          isCopied = true;
        } catch (error) {
          sourceBinaryPath = path.join(details.extractPath, details.buildType, details.binName);

          try {
            fs.copySync(sourceBinaryPath, tempTargetBinaryPath);
            isCopied = true;
          } catch (error) {
            exportables.logMissingBinaryModuleWarning(details);
            log.error(error);
          }
        }

        if (isCopied) {
          // Also ensure that package.json was copied.
          fs.copySync(
            path.join(globRoot, details.modulePath, 'package.json'),
            path.join(tempTargetModulePath, 'package.json')
          );
        }
      } else {
        // In the future we may allow users to log the ignored modules here
        if (!details.ignored) {
          exportables.logMissingBinaryModuleWarning(details);
        }
      }
    });

    // All binary modules have been replaced, resolve.
    return resolve();
  });
};

exportables.preBundle = function(options) {
  return options.tessel.fetchNodeProcessVersions()
    .then(versions => {
      options.tessel.versions = versions;
      return exportables.resolveBinaryModules(options);
    });
};

exportables.tarBundle = function(options) {
  var cwd = process.cwd();
  var target = options.target || cwd;
  var relative = path.relative(cwd, target);
  var globRoot = relative || target;
  var packer = tar.Pack({
    noProprietary: true
  });
  var buffers = [];

  if (options.full) {
    options.slim = false;
  }

  var includeRules = glob.rules(target, '.tesselinclude')
    .concat(lists.includes);

  var includeFiles = glob.files(globRoot, includeRules);
  var includeNegateRules = includeRules.reduce((rules, pattern) => {
    if (pattern.indexOf('!') === 0) {
      rules.push(pattern.slice(1));
    }
    return rules;
  }, []);

  var ignoreRules = glob.rules(target, '.tesselignore')
    .concat(includeNegateRules)
    .concat(lists.ignores);

  var ignoreFiles = glob.files(globRoot, ignoreRules);

  var blacklistFiles = glob.files(globRoot, lists.blacklist);

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

  log.info('Building project.');


  // Both the --slim and --full paths will use a copy of the
  // project to bundle. This allows us to be destructive
  // with the files, but without directly tampering with the
  // project files themselves.
  var tempBundleDir = fsTemp.mkdirSync();

  if (options.slim) {
    return new Promise((resolve, reject) => {
      var absRoot = path.resolve(globRoot);
      // Setup for detecting "overlooked" assets (files, directories, etc.)
      var common = ['node_modules', 'package.json', '.tesselinclude', options.resolvedEntryPoint];
      // These will be compared against the dependency graph
      var assets = fs.readdirSync(globRoot)
        .filter(entry => (common.indexOf(entry) === -1))
        .map(entry => path.join(globRoot, entry));

      // Initialize a project for dependency graphing
      var entry = path.join(relative, options.resolvedEntryPoint);
      var project = exportables.project({
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
            var compressionOptions = lists.compressionOptions[dependency.packageName];
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

            if (options.single && !dependency.entry) {
              return;
            }

            if (options.compress && isJS) {
              try {
                source = exportables.compress(source, compressionOptions);
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
          if (!options.single) {
            includeFiles.forEach(file => {
              var target = path.join(tempBundleDir, file);
              if (!written[target]) {
                fs.copySync(path.join(globRoot, file), target);
              }
            });
          }

          // Blacklisted files or directories are present
          if (blacklistFiles.length) {
            blacklistFiles.forEach(file => fs.removeSync(path.join(tempBundleDir, file)));
          }

          if (assets.length) {
            log.warn('Some assets in this project were not deployed (see: t2 run --help)');
          }

          exportables.injectBinaryModules(globRoot, tempBundleDir, options)
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

      return exportables.injectBinaryModules(globRoot, tempBundleDir, options)
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

          if (!options.single && includeFiles.length) {
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

          if (options.single) {
            fstream.addIgnoreRules(['*', '!' + options.resolvedEntryPoint]);
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


/**
 * Build project dependency graph
 * Language: js
 *
 * @param {Object} options  Specify how dependency graphing is configured and behaves.
 */
exportables.project = function(options) {
  // To make these operations testable, we must wrap them
  // in our own exported `exportables`.

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
exportables.compress = function(source, options) {
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

module.exports = exportables;
