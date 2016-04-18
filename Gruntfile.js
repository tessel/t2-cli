// System Objects
var cp = require('child_process');

// Third Party Dependencies
var tags = require('common-tags');

module.exports = function(grunt) {

  grunt.initConfig({
    nodeunit: {
      tests: [
        'test/common/bootstrap.js',
        'test/unit/*.js'
      ]
    },
    jshint: {
      all: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: [
          'bin/*',
          'lib/**/*.js',
          'Gruntfile.js',
        ]
      },
      tests: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: [
          'test/**/*.js',
          '!test/unit/fixtures/syntax-error/**/*.js',
          '!test/unit/fixtures/project-binary-modules/**/*',
          '!test/unit/fixtures/project-skip-binary/**/*',
          '!test/unit/fixtures/project-ignore-binary/**/*',
        ]
      }
    },
    jscs: {
      all: [
        'bin/*',
        'lib/**/*.js',
        'test/**/*.js',
        'Gruntfile.js',
        '!test/unit/fixtures/syntax-error/**/*.js',
        '!test/unit/fixtures/project-binary-modules/**/*',
        '!test/unit/fixtures/project-skip-binary/**/*',
        '!test/unit/fixtures/project-ignore-binary/**/*',
      ],
      options: {
        config: '.jscsrc'
      }
    },
    jsbeautifier: {
      all: [
        'bin/*',
        'lib/**/*.js',
        'test/**/*.js',
        'Gruntfile.js',
      ],
      options: {
        js: {
          braceStyle: 'collapse',
          breakChainedMethods: false,
          e4x: false,
          evalCode: false,
          indentChar: ' ',
          indentLevel: 0,
          indentSize: 2,
          indentWithTabs: false,
          jslintHappy: false,
          keepArrayIndentation: false,
          keepFunctionIndentation: false,
          maxPreserveNewlines: 10,
          preserveNewlines: true,
          spaceBeforeConditional: true,
          spaceInParen: false,
          unescapeStrings: false,
          wrapLineLength: 0
        }
      }
    },
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-git-authors');
  grunt.loadNpmTasks('grunt-jscs');
  grunt.loadNpmTasks('grunt-jsbeautifier');


  // 'npm test' runs these tasks
  grunt.registerTask('test', ['jshint', 'jscs', 'jsbeautifier', 'nodeunit']);

  // Default task.
  grunt.registerTask('default', ['test']);


  // Support running a single test suite
  grunt.registerTask('nodeunit:only', 'Run a single test specified by a target; usage: "grunt nodeunit:only:<module-name>[.js]"', function(file) {
    if (file) {
      grunt.config('nodeunit.tests', [
        'test/common/bootstrap.js',
        'test/unit/' + file + '.js'
      ]);
    }

    grunt.task.run('nodeunit');
  });


  grunt.registerTask('changelog', '`changelog:0.0.0--0.0.2` or `changelog`', function(range) {
    var done = this.async();

    if (!range) {
      // grunt changelog
      range = cp.execSync('git tag --sort version:refname').toString().split('\n');
    } else {
      // grunt changelog:previous--present
      range = range.split('--');
    }

    range = range.filter(Boolean).reverse();

    cp.exec(`git log --format='|%h|%s|' ${range[1]}..${range[0]}`, (error, result) => {
      if (error) {
        console.log(error.message);
        return;
      }

      var rows = result.split('\n').filter(commit => {
        return !commit.includes('|Merge ') && !commit.includes(range[0]);
      }).join('\n');

      // Extra whitespace above and below makes it easier to quickly copy/paste from terminal
      grunt.log.writeln(`\n\n${changelog(rows)}\n\n`);

      done();
    });
  });
};

function changelog(rows) {
  return tags.stripIndent `
| Commit | Message/Description |
| ------ | ------------------- |
${rows}
`;
}
