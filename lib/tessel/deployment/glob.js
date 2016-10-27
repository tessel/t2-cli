// System Objects
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');
var glob = require('glob');


var exportables = {
  /*
    A wrapper that allows for stubbing/spying in our tests.
   */
  sync: function(pattern, options) {
    return glob.sync(pattern, options);
  },

  /*
    Generate an array of glob pattern rules defined within all files
    that match the file name provided.

      exportables.glob.rules(target, '.tesselignore')
        -> will compile patterns found in all nested .tesselignore files

      exportables.glob.rules(target, '.tesselinclude')
        -> will compile patterns found in all nested .tesselinclude files

   */
  rules: function(target, nameOfFileContainingGlobPatterns) {
    // Patterns that are passed directly to glob.sync
    // are implicitly path.normalize()'ed
    var files = exportables.sync(target + '/**/*' + nameOfFileContainingGlobPatterns, {
      dot: true,
      mark: true,
    });

    return files.reduce((rules, file) => {
      var dirname = path.dirname(file);
      var patterns = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).reduce((patterns, pattern) => {
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
    }, []).reduce((rules, entry) => {

      var rule = entry.pattern;

      if (!entry.isExplicitDir && !entry.pattern.includes('.')) {
        rules.push(entry.pattern);
      }

      // TODO: Determine if this condition is ever actually met
      /* istanbul ignore if */
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
    return rules.reduce((files, rule) => {
      return files.concat(
        exportables.sync(rule, {
          cwd: cwd
        })
      );
    }, []);
  }
};

module.exports = exportables;
