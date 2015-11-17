module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    nodeunit: {
      tests: [
        'test/common/bootstrap.js',
        'test/unit/*.js'
      ]
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'bin/*',
        'lib/**/*.js',
        'test/**/*.js',
        'Gruntfile.js',
        '!test/unit/fixtures/syntax-error/**/*.js',

        // This is commented out because there are
        // too many errors to address. I went through
        // half of them and still:
        //
        // >> 75 errors in 3 files
        //
        // There are a lot of undefined vars being used
        // and without fully understanding these files, it's
        // not worth the effort to fix them all.
        // 'resources/**/*.js',
      ]
    },
    jscs: {
      all: [
        'bin/*',
        'lib/**/*.js',
        'test/**/*.js',
        'Gruntfile.js',
        '!test/unit/fixtures/syntax-error/**/*.js',
        // 'resources/**/*.js',
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
        // 'resources/**/*.js',
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
};
