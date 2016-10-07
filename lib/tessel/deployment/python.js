// System Objects
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');
var fsTemp = require('fs-temp');
var Ignore = require('fstream-ignore');
var tags = require('common-tags');
var tar = require('tar');

// Internal
var lists = require('./lists/python');
var glob = require('./glob');


var exportables = {
  meta: {
    name: 'python',
    extname: 'py',
    binary: 'python',
    entry: '__init__.py',
    configuration: '__init__.py',
    isFile: true,
    checkConfiguration: (pushdir, basename, program) => {
      // var packageJson = fs.readJsonSync(path.join(pushdir, 'package.json'));

      // if (packageJson.main) {
      //   basename = path.basename(program);
      //   program = path.normalize(program.replace(basename, packageJson.main));
      // }

      return {
        basename,
        program
      };
    },
    shell: (options) => {
      return tags.stripIndent `
        #!/bin/sh
        exec python /app/remote-script/${options.resolvedEntryPoint} ${options.subargs.join(' ')}
      `;
    },
  },
  lists: lists,
};

exportables.preBundle = function() {
  return Promise.resolve();
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
  var tempBundleDir = fsTemp.mkdirSync();

  var includeRules = glob.rules(target, '.tesselinclude').concat(lists.includes);
  var includeFiles = glob.files(globRoot, includeRules);
  var includeNegateRules = includeRules.reduce((rules, pattern) => {
    if (pattern.startsWith('!')) {
      rules.push(pattern.slice(1));
    }
    return rules;
  }, []);

  if (fs.existsSync(path.join(target, 'setup.py'))) {
    // TODO:
    // Create a cross-compilation server for compiling?
  }

  // For now, stay out of that path.
  opts.slim = false;

  if (opts.slim) {
    throw new Error('--slim builds are not yet available for Python');
  } else {
    return new Promise((resolve, reject) => {

      fs.copySync(globRoot, tempBundleDir);

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
    });
  }
};


module.exports = exportables;
