// System Objects
var cp = require('child_process');
var path = require('path');

// Third Party Dependencies
var tags = require('common-tags');
var glob = require('glob');

module.exports = (grunt) => {

  grunt.initConfig({
    nodeunit: {
      tests: [
        'test/common/bootstrap.js',
        'test/unit/*.js',
        'test/unit/deployment/*.js',
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


  grunt.registerTask('test', ['jshint', 'jscs', 'nodeunit']);
  grunt.registerTask('all', ['jsbeautifier', 'jshint', 'jscs', 'nodeunit']);

  // Default task.
  grunt.registerTask('default', ['all']);


  // Support running a single test suite
  grunt.registerTask('nodeunit:only', 'Run a single test specified by a target; usage: "grunt nodeunit:only:<module-name>[.js]"', (file) => {
    if (file) {
      grunt.config('nodeunit.tests', [
        'test/common/bootstrap.js',
        'test/unit/' + file + '.js'
      ]);
    }

    grunt.task.run('nodeunit');
  });

  // This new runner will eventually supersede "nodeunit:only"
  grunt.registerTask('nodeunit:file', 'Run a subset of tests by specifying a file name or glob expression. Usage: "grunt nodeunit:file:<file.ext>" or "grunt nodeunit:file:<expr>"', (input) => {

    var config = [
      'test/common/bootstrap.js',
    ];

    if (input) {
      if (!input.endsWith('.js')) {
        if (!input.endsWith('*') || !input.endsWith('**/*')) {
          input = `{${path.normalize(input + '*')},${path.normalize(input + '**/*')}}`;
        }
      }

      var expr = 'test/unit/' + input;
      var inputs = glob.sync(expr).filter((file) => file.endsWith('.js'));

      if (inputs) {
        inputs.forEach(input => config.push(input));
        grunt.config('nodeunit.tests', config);
      }
    }

    grunt.task.run('nodeunit');
  });


  grunt.registerTask('nodeunit:files', 'Run a subset of tests by specifying a file name, bracket list of file names, or glob expression. Usage: "grunt nodeunit:file:<file.ext>" or "grunt nodeunit:file:<expr>"', (file) => {
    grunt.task.run('nodeunit:file:' + file);
  });



  grunt.registerTask('changelog', '`changelog:0.0.0--0.0.2` or `changelog`', (range) => {
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
