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
var lists = require('./lists/javascript');
var logs = require('../../logs');
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
  },
  lists: lists,
};


exportables.findProject = function(opts) {
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


exportables.preBundling = function(opts) {
  return exportables.resolveBinaryModules(opts);
};


exportables.glob = {
  /*
    A wrapper that allows for stubbing/spying in our tests.
   */
  sync: function(pattern, options) {
    return glob.sync(pattern, options);
  },

  /*
    Generate an array of glob pattern rules defined within all files
    that match the file name provided.

      exportablesglob.rules(target, '.tesselignore')
        -> will compile patterns found in all nested .tesselignore files

      exportablesglob.rules(target, '.tesselinclude')
        -> will compile patterns found in all nested .tesselinclude files

   */
  rules: function(target, nameOfFileContainingGlobPatterns) {
    // Patterns that are passed directly to glob.sync
    // are implicitly path.normalize()'ed
    var files = exportables.glob.sync(target + '/**/*' + nameOfFileContainingGlobPatterns, {
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

      if (rule[rule.length - 1] !== '*' && !rule.includes('.')) {
        rule += '/**/*.*';
      }

      rules.push(rule);
      return rules;
    }, []);
  },
  /*
    Generate a complete list of files, from cwd down, that match all
    patterns in an array of glob pattern rules.

      exportables.glob.files(cwd, [ '*.js' ])
        -> will return an array of all .js files in the cwd.

      exportables.glob.files(cwd, [ '**\/*.js' ])
        -> will return an array of all .js files in the cwd.


    Ignore any escaping, it's there solely to prevent
    this pattern from closing the multi-line comment.
   */
  files: function(cwd, rules) {
    return rules.reduce(function(files, rule) {
      return files.concat(
        exportables.glob.sync(rule, {
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

exportables.resolveBinaryModules = function(opts) {
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
    var binaries = exportables.glob.files(globRoot, patterns).reduce((bins, globPath) => {
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

exportables.tarBundle = function(opts) {
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

  var includeRules = exportables.glob.rules(target, '.tesselinclude')
    .concat(lists.includes);

  var includeFiles = exportables.glob.files(globRoot, includeRules);
  var includeNegateRules = includeRules.reduce((rules, pattern) => {
    if (pattern.indexOf('!') === 0) {
      rules.push(pattern.slice(1));
    }
    return rules;
  }, []);

  var ignoreRules = exportables.glob.rules(target, '.tesselignore')
    .concat(includeNegateRules)
    .concat(lists.ignores);

  var ignoreFiles = exportables.glob.files(globRoot, ignoreRules);

  var blacklistFiles = exportables.glob.files(globRoot, lists.blacklist);

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

            if (opts.single && !dependency.entry) {
              return;
            }

            if (isJS) {
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
          if (!opts.single) {
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
            logs.warn('Some assets in this project were not deployed (see: t2 run --help)');
          }

          exportables.injectBinaryModules(globRoot, tempBundleDir, opts)
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

      return exportables.injectBinaryModules(globRoot, tempBundleDir, opts)
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
