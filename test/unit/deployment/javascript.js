'use strict';

// Test dependencies are required and exposed in common/bootstrap.js
require('../../common/bootstrap');

process.on('uncaughtException', function(err) {
  console.error(err.stack);
});

var codeContents = 'console.log("testing deploy");';
var reference = Buffer.from(codeContents);
var lists = deployment.js.lists;
var listRuleLength = lists.includes.length + lists.ignores.length + lists.disallowed.length;
var sandbox = sinon.sandbox.create();

var FIXTURE_PATH = path.join(__dirname, '/../../../test/unit/fixtures');

exports['Deployment: JavaScript'] = {
  setUp(done) {
    this.deploy = sandbox.spy(Tessel.prototype, 'deploy');
    this.appStop = sandbox.spy(commands.app, 'stop');
    this.appStart = sandbox.spy(commands.app, 'start');
    this.deleteFolder = sandbox.spy(commands, 'deleteFolder');
    this.createFolder = sandbox.spy(commands, 'createFolder');
    this.untarStdin = sandbox.spy(commands, 'untarStdin');
    this.execute = sandbox.spy(commands.js, 'execute');
    this.openStdinToFile = sandbox.spy(commands, 'openStdinToFile');
    this.chmod = sandbox.spy(commands, 'chmod');

    this.push = sandbox.spy(deploy, 'push');
    this.createShellScript = sandbox.spy(deploy, 'createShellScript');

    this.injectBinaryModules = sandbox.stub(deployment.js, 'injectBinaryModules').callsFake(() => Promise.resolve());
    this.resolveBinaryModules = sandbox.stub(deployment.js, 'resolveBinaryModules').callsFake(() => Promise.resolve());
    this.tarBundle = sandbox.stub(deployment.js, 'tarBundle').callsFake(() => Promise.resolve(reference));

    this.warn = sandbox.stub(log, 'warn');
    this.info = sandbox.stub(log, 'info');

    this.tessel = TesselSimulator();
    this.end = sandbox.spy(this.tessel._rps.stdin, 'end');

    this.fetchCurrentBuildInfo = sandbox.stub(this.tessel, 'fetchCurrentBuildInfo').returns(Promise.resolve('40b2b46a62a34b5a26170c75f7e717cea673d1eb'));
    this.fetchNodeProcessVersions = sandbox.stub(this.tessel, 'fetchNodeProcessVersions').returns(Promise.resolve(processVersions));
    this.requestBuildList = sandbox.stub(updates, 'requestBuildList').returns(Promise.resolve(tesselBuilds));

    this.pWrite = sandbox.stub(Preferences, 'write').returns(Promise.resolve());
    this.exists = sandbox.stub(fs, 'exists').callsFake((fpath, callback) => callback(true));

    this.spinnerStart = sandbox.stub(log.spinner, 'start');
    this.spinnerStop = sandbox.stub(log.spinner, 'stop');

    deleteTemporaryDeployCode()
      .then(done);
  },

  tearDown(done) {
    this.tessel.mockClose();

    sandbox.restore();

    deleteTemporaryDeployCode()
      .then(done)
      .catch(function(err) {
        throw err;
      });
  },

  bundling(test) {
    test.expect(1);

    this.tarBundle.restore();

    createTemporaryDeployCode().then(() => {
      var tb = deployment.js.tarBundle({
        target: DEPLOY_DIR_JS
      });

      tb.then(bundle => {
          /*
            $ t2 run app.js
            INFO Looking for your Tessel...
            INFO Connected to arnold over LAN
            INFO Writing app.js to RAM on arnold (2.048 kB)...
            INFO Deployed.
            INFO Running app.js...
            testing deploy
            INFO Stopping script...
          */
          test.equal(bundle.length, 2048);

          test.done();
        })
        .catch(error => {
          test.ok(false, error.toString());
          test.done();
        });
    });
  },

  createShellScriptDefaultEntryPoint(test) {
    test.expect(1);

    var shellScript = `#!/bin/sh
exec node --harmony /app/remote-script/index.js --key=value`;
    var opts = {
      lang: deployment.js,
      resolvedEntryPoint: 'index.js',
      binopts: ['--harmony'],
      subargs: ['--key=value'],
    };
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end').callsFake((buffer) => {
      test.equal(buffer.toString(), shellScript);
      test.done();
    });

    this.exec = sandbox.stub(this.tessel.connection, 'exec').callsFake((command, callback) => {
      return callback(null, this.tessel._rps);
    });

    deploy.createShellScript(this.tessel, opts);
  },

  createShellScriptDefaultEntryPointNoSubargs(test) {
    test.expect(1);

    var shellScript = `#!/bin/sh
exec node --harmony /app/remote-script/index.js`;
    var opts = {
      lang: deployment.js,
      resolvedEntryPoint: 'index.js',
      binopts: ['--harmony'],
      subargs: [],
    };
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end').callsFake((buffer) => {
      test.equal(buffer.toString(), shellScript);
      test.done();
    });

    this.exec = sandbox.stub(this.tessel.connection, 'exec').callsFake((command, callback) => {
      return callback(null, this.tessel._rps);
    });

    deploy.createShellScript(this.tessel, opts);
  },

  createShellScriptDefaultEntryPointNoExtraargs(test) {
    test.expect(1);

    var shellScript = `#!/bin/sh
exec node  /app/remote-script/index.js`;
    var opts = {
      lang: deployment.js,
      resolvedEntryPoint: 'index.js',
      binopts: [],
      subargs: [],
    };
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end').callsFake((buffer) => {
      test.equal(buffer.toString(), shellScript);
      test.done();
    });

    this.exec = sandbox.stub(this.tessel.connection, 'exec').callsFake((command, callback) => {
      return callback(null, this.tessel._rps);
    });

    deploy.createShellScript(this.tessel, opts);
  },

  createShellScriptSendsCorrectEntryPoint(test) {
    test.expect(1);
    var shellScript = `#!/bin/sh
exec node  /app/remote-script/index.js --key=value`;
    var opts = {
      lang: deployment.js,
      resolvedEntryPoint: 'index.js',
      binopts: [],
      subargs: ['--key=value'],
    };
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end').callsFake((buffer) => {
      test.equal(buffer.toString(), shellScript);
      test.done();
    });

    this.exec = sandbox.stub(this.tessel.connection, 'exec').callsFake((command, callback) => {
      return callback(null, this.tessel._rps);
    });

    deploy.createShellScript(this.tessel, opts);
  },

  processCompletionOrder(test) {
    // Array of processes we've started but haven't completed yet
    var processesAwaitingCompletion = [];
    this.tessel._rps.on('control', (data) => {
      // Push new commands into the queue
      processesAwaitingCompletion.push(data);
    });

    // Create the temporary folder with example code
    createTemporaryDeployCode()
      .then(() => {

        var closeAdvance = (event) => {
          // If we get an event listener for the close event of a process
          if (event === 'close') {
            // Wait some time before actually closing it
            setTimeout(() => {
              // We should only have one process waiting for completion
              test.equal(processesAwaitingCompletion.length, 1);
              // Pop that process off
              processesAwaitingCompletion.shift();
              // Emit the close event to keep it going
              this.tessel._rps.emit('close');
            }, 200);
          }
        };

        // When we get a listener that the Tessel process needs to close before advancing
        this.tessel._rps.on('newListener', closeAdvance);

        // Actually deploy the script
        this.tessel.deploy({
            entryPoint: path.relative(process.cwd(), DEPLOY_FILE_JS),
            compress: true,
            push: false,
            single: false
          })
          // If it finishes, it was successful
          .then(() => {
            this.tessel._rps.removeListener('newListener', closeAdvance);
            test.done();
          })
          // If not, there was an issue
          .catch(function(err) {
            test.equal(err, undefined, 'We hit a catch statement that we should not have.');
          });
      });
  }
};

exports['deployment.js.compress with uglify.es.minify()'] = {
  setUp(done) {
    this.minify = sandbox.spy(uglify.es, 'minify');
    this.spinnerStart = sandbox.stub(log.spinner, 'start');
    this.spinnerStop = sandbox.stub(log.spinner, 'stop');

    done();
  },
  tearDown(done) {
    sandbox.restore();
    done();
  },

  minifySuccess(test) {
    test.expect(1);

    deployment.js.compress('es', 'let f = 1');

    test.equal(this.minify.callCount, 1);
    test.done();
  },

  minifyFailureReturnsOriginalSource(test) {
    test.expect(2);

    const result = deployment.js.compress('es', '#$%^');

    // Assert that we tried to minify
    test.equal(this.minify.callCount, 1);

    // Assert that compress just gave back
    // the source as-is, even though the
    // parser failed.
    test.equal(result, '#$%^');

    test.done();
  },

  ourOptionsParse(test) {
    test.expect(2);

    const ourExplicitSettings = {
      toplevel: true,
      warnings: false,
    };

    const ourExplicitSettingsKeys = Object.keys(ourExplicitSettings);

    try {
      // Force the acorn parse step of the
      // compress operation to fail. This
      // will ensure that that the uglify
      // attempt is made.
      deployment.js.compress('es', '#$%^');
    } catch (error) {
      // there is nothing we can about this.
    }

    const optionsSeen = this.minify.lastCall.args[1];

    ourExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], ourExplicitSettings[key]);
    });

    test.done();
  },

  noOptionsCompress(test) {
    test.expect(23);

    const optionsCompress = {
      // ------
      booleans: true,
      cascade: true,
      conditionals: true,
      comparisons: true,
      ecma: 6,
      evaluate: true,
      hoist_funs: true,
      hoist_vars: true,
      if_return: true,
      join_vars: true,
      loops: true,
      passes: 3,
      properties: true,
      sequences: true,
      unsafe: true,
      // ------
      dead_code: true,
      unsafe_math: true,
      keep_infinity: true,
      // ------
      arrows: false,
      keep_fargs: false,
      keep_fnames: false,
      warnings: false,
      drop_console: false,
    };

    const optionsCompressKeys = Object.keys(optionsCompress);

    deployment.js.compress('es', 'var a = 1;', {});

    const optionsSeen = this.minify.lastCall.args[1].compress;

    optionsCompressKeys.forEach(key => {
      test.equal(optionsSeen[key], optionsCompress[key]);
    });

    test.done();
  },

  ourOptionsCompress(test) {
    test.expect(23);

    const ourExplicitSettings = {
      // ------
      booleans: true,
      cascade: true,
      conditionals: true,
      comparisons: true,
      ecma: 6,
      evaluate: true,
      hoist_funs: true,
      hoist_vars: true,
      if_return: true,
      join_vars: true,
      loops: true,
      passes: 3,
      properties: true,
      sequences: true,
      unsafe: true,
      // ------
      dead_code: true,
      unsafe_math: true,
      keep_infinity: true,
      // ------
      arrows: false,
      keep_fargs: false,
      keep_fnames: false,
      warnings: false,
      drop_console: false,
    };

    const ourExplicitSettingsKeys = Object.keys(ourExplicitSettings);

    deployment.js.compress('es', 'var a = 1;');

    const optionsSeen = this.minify.lastCall.args[1].compress;

    ourExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], ourExplicitSettings[key]);
    });

    test.done();
  },

  theirOptionsCompress(test) {
    test.expect(20);

    var theirExplicitSettings = {
      // ------
      booleans: false,
      cascade: false,
      conditionals: false,
      comparisons: false,
      evaluate: false,
      hoist_funs: false,
      hoist_vars: false,
      if_return: false,
      join_vars: false,
      loops: false,
      properties: false,
      sequences: false,
      unsafe: false,
      // ------
      dead_code: false,
      unsafe_math: false,
      keep_infinity: false,
      // ------
      keep_fargs: true,
      keep_fnames: true,
      warnings: true,
      drop_console: true,
    };

    var theirExplicitSettingsKeys = Object.keys(theirExplicitSettings);

    deployment.js.compress('es', 'var a = 1;', {
      compress: theirExplicitSettings
    });

    const optionsSeen = this.minify.lastCall.args[1].compress;

    theirExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], theirExplicitSettings[key]);
    });

    test.done();
  },

  minifyFromBuffer(test) {
    test.expect(1);
    test.equal(deployment.js.compress('es', Buffer.from(codeContents)), codeContents);
    test.done();
  },

  minifyFromString(test) {
    test.expect(1);
    test.equal(deployment.js.compress('es', codeContents), codeContents);
    test.done();
  },

  minifyWithBareReturns(test) {
    test.expect(1);

    deployment.js.compress('es', 'return;');
    test.equal(this.minify.lastCall.args[1].parse.bare_returns, true);
    test.done();
  },

  avoidCompleteFailure(test) {
    test.expect(1);

    this.minify.restore();
    this.minify = sandbox.stub(uglify.js, 'minify').callsFake(() => {
      return {
        error: new SyntaxError('whatever')
      };
    });

    test.equal(deployment.js.compress('es', 'return;'), 'return;');
    test.done();
  },
};

exports['deployment.js.compress with uglify.js.minify()'] = {
  setUp(done) {
    this.minify = sandbox.spy(uglify.js, 'minify');
    this.spinnerStart = sandbox.stub(log.spinner, 'start');
    this.spinnerStop = sandbox.stub(log.spinner, 'stop');

    done();
  },
  tearDown(done) {
    sandbox.restore();
    done();
  },

  minifySuccess(test) {
    test.expect(1);

    deployment.js.compress('js', 'let f = 1');

    test.equal(this.minify.callCount, 1);
    test.done();
  },

  minifyFailureReturnsOriginalSource(test) {
    test.expect(2);

    const result = deployment.js.compress('js', '#$%^');

    // Assert that we tried to minify
    test.equal(this.minify.callCount, 1);

    // Assert that compress just gave back
    // the source as-is, even though the
    // parser failed.
    test.equal(result, '#$%^');

    test.done();
  },

  ourOptionsParse(test) {
    test.expect(2);

    const ourExplicitSettings = {
      toplevel: true,
      warnings: false,
    };

    const ourExplicitSettingsKeys = Object.keys(ourExplicitSettings);

    try {
      // Force the acorn parse step of the
      // compress operation to fail. This
      // will ensure that that the uglify
      // attempt is made.
      deployment.js.compress('js', '#$%^');
    } catch (error) {
      // there is nothing we can about this.
    }

    const optionsSeen = this.minify.lastCall.args[1];

    ourExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], ourExplicitSettings[key]);
    });

    test.done();
  },

  noOptionsCompress(test) {
    test.expect(15);

    const optionsCompress = {
      // ------
      booleans: true,
      cascade: true,
      conditionals: true,
      comparisons: true,
      hoist_funs: true,
      if_return: true,
      join_vars: true,
      loops: true,
      passes: 2,
      properties: true,
      sequences: true,
      // ------ explicitly false
      keep_fargs: false,
      keep_fnames: false,
      warnings: false,
      drop_console: false,
    };

    const optionsCompressKeys = Object.keys(optionsCompress);

    deployment.js.compress('js', 'var a = 1;', {});

    const optionsSeen = this.minify.lastCall.args[1].compress;

    optionsCompressKeys.forEach(key => {
      test.equal(optionsSeen[key], optionsCompress[key]);
    });

    test.done();
  },

  ourOptionsCompress(test) {
    test.expect(15);

    const ourExplicitSettings = {
      // ------
      booleans: true,
      cascade: true,
      conditionals: true,
      comparisons: true,
      hoist_funs: true,
      if_return: true,
      join_vars: true,
      loops: true,
      passes: 2,
      properties: true,
      sequences: true,
      // ------ explicitly false
      keep_fargs: false,
      keep_fnames: false,
      warnings: false,
      drop_console: false,
    };

    const ourExplicitSettingsKeys = Object.keys(ourExplicitSettings);

    deployment.js.compress('js', 'var a = 1;');

    const optionsSeen = this.minify.lastCall.args[1].compress;

    ourExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], ourExplicitSettings[key]);
    });

    test.done();
  },

  theirOptionsCompress(test) {
    test.expect(15);

    var theirExplicitSettings = {
      // ------
      booleans: true,
      cascade: true,
      conditionals: true,
      comparisons: true,
      hoist_funs: true,
      if_return: true,
      join_vars: true,
      loops: true,
      passes: 2,
      properties: true,
      sequences: true,
      // ------ explicitly false
      keep_fargs: false,
      keep_fnames: false,
      warnings: false,
      drop_console: false,
    };

    var theirExplicitSettingsKeys = Object.keys(theirExplicitSettings);

    deployment.js.compress('js', 'var a = 1;', {
      compress: theirExplicitSettings
    });

    const optionsSeen = this.minify.lastCall.args[1].compress;

    theirExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], theirExplicitSettings[key]);
    });

    test.done();
  },

  minifyFromBuffer(test) {
    test.expect(1);
    test.equal(deployment.js.compress('js', Buffer.from(codeContents)), codeContents);
    test.done();
  },

  minifyFromString(test) {
    test.expect(1);
    test.equal(deployment.js.compress('js', codeContents), codeContents);
    test.done();
  },

  minifyWithBareReturns(test) {
    test.expect(1);

    deployment.js.compress('js', 'return;');
    test.equal(this.minify.lastCall.args[1].parse.bare_returns, true);
    test.done();
  },

  avoidCompleteFailure(test) {
    test.expect(1);

    this.minify.restore();
    this.minify = sandbox.stub(uglify.js, 'minify').callsFake(() => {
      return {
        error: new SyntaxError('whatever')
      };
    });

    const result = deployment.js.compress('js', 'return;');

    test.equal(result, 'return;');

    test.done();
  },

  theReasonForUsingBothVersionsOfUglify(test) {
    test.expect(2);

    this.minify.restore();
    this.es = sandbox.spy(uglify.es, 'minify');
    this.js = sandbox.spy(uglify.js, 'minify');

    const code = tags.stripIndents `
    var Class = function() {};

    Class.prototype.method = function() {};

    module.exports = Class;
    `;

    deployment.js.compress('es', code);
    deployment.js.compress('js', code);

    test.equal(this.es.callCount, 1);
    test.equal(this.js.callCount, 1);
    test.done();
  },


};

exports['deployment.js.tarBundle'] = {
  setUp(done) {
    this.copySync = sandbox.spy(fs, 'copySync');
    this.outputFileSync = sandbox.spy(fs, 'outputFileSync');
    this.writeFileSync = sandbox.spy(fs, 'writeFileSync');
    this.remove = sandbox.spy(fs, 'remove');
    this.readdirSync = sandbox.spy(fs, 'readdirSync');

    this.globSync = sandbox.spy(glob, 'sync');
    this.collect = sandbox.spy(Project.prototype, 'collect');
    this.exclude = sandbox.spy(Project.prototype, 'exclude');
    this.mkdirSync = sandbox.spy(fsTemp, 'mkdirSync');
    this.addIgnoreRules = sandbox.spy(Ignore.prototype, 'addIgnoreRules');

    this.project = sandbox.spy(deployment.js, 'project');
    this.compress = sandbox.spy(deployment.js, 'compress');

    this.warn = sandbox.stub(log, 'warn');
    this.info = sandbox.stub(log, 'info');

    this.spinnerStart = sandbox.stub(log.spinner, 'start');
    this.spinnerStop = sandbox.stub(log.spinner, 'stop');

    done();
  },

  tearDown(done) {
    sandbox.restore();
    done();
  },

  actionsGlobRules(test) {
    test.expect(1);

    const target = 'test/unit/fixtures/ignore';
    const rules = glob.rules(target, '.tesselignore');

    test.deepEqual(
      rules.map(path.normalize), [
        // Found in "test/unit/fixtures/ignore/.tesselignore"
        'a/**/*.*',
        'mock-foo.js',
        // Found in "test/unit/fixtures/ignore/nested/.tesselignore"
        'nested/b/**/*.*',
        'nested/file.js'
      ].map(path.normalize)
    );

    test.done();
  },

  actionsGlobFiles(test) {
    test.expect(1);

    const target = 'test/unit/fixtures/ignore';
    const rules = glob.rules(target, '.tesselignore');
    const files = glob.files(target, rules);

    test.deepEqual(files, ['mock-foo.js']);
    test.done();
  },

  actionsGlobFilesNested(test) {
    test.expect(1);

    const target = 'test/unit/fixtures/ignore';
    const files = glob.files(target, ['**/.tesselignore']);

    test.deepEqual(files, [
      '.tesselignore',
      'nested/.tesselignore'
    ]);

    test.done();
  },

  actionsGlobFilesNonNested(test) {
    test.expect(1);

    const target = 'test/unit/fixtures/ignore';
    const files = glob.files(target, ['.tesselignore']);

    test.deepEqual(files, ['.tesselignore']);
    test.done();
  },

  noOptionsTargetFallbackToCWD(test) {
    test.expect(2);

    const target = path.normalize('test/unit/fixtures/project');

    sandbox.stub(process, 'cwd').returns(target);
    sandbox.spy(path, 'relative');

    /*
      project
      ├── .tesselignore
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselignore
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
     */

    deployment.js.tarBundle({
      compress: true,
      full: true,
    }).then(() => {
      test.equal(path.relative.firstCall.args[0], path.normalize('test/unit/fixtures/project'));
      test.equal(path.relative.firstCall.args[1], path.normalize('test/unit/fixtures/project'));
      test.done();
    });
  },

  full(test) {
    test.expect(8);

    const target = 'test/unit/fixtures/project';

    /*
      project
      ├── .tesselignore
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselignore
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
     */

    deployment.js.tarBundle({
      target: path.normalize(target),
      compress: true,
      full: true,
    }).then(bundle => {

      // One call for .tesselinclude
      // One call for the single rule found within
      // Three calls for the deploy lists
      // * 2 (We need all ignore rules ahead of time for ignoring binaries)
      test.equal(this.globSync.callCount, 5 + listRuleLength);

      // addIgnoreRules might be called many times, but we only
      // care about tracking the call that's explicitly made by
      // tessel's deploy operation
      test.deepEqual(this.addIgnoreRules.getCall(0).args[0], [
        '**/.tesselignore',
        '**/.tesselinclude',
      ]);

      // These things don't happen in the --full path
      test.equal(this.project.callCount, 0);
      test.equal(this.exclude.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        test.deepEqual(entries, [
          'index.js',
          'nested/another.js',
          'node_modules/foo/index.js',
          'package.json',
        ]);
        test.done();
      });
    });
  },

  fullHitsErrorFromFstreamIgnore(test) {
    test.expect(1);

    // Need to stub function in _actual_ fs (but we use fs-extra)
    const fs = require('fs');

    sandbox.stub(fs, 'readFile').callsFake((file, callback) => {
      callback('foo');
    });

    const target = 'test/unit/fixtures/project';

    deployment.js.tarBundle({
        target: path.normalize(target),
        compress: true,
        full: true,
      })
      .then(() => {
        test.ok(false, 'tarBundle should not resolve');
        test.done();
      })
      .catch(error => {
        test.equal(error.toString(), 'foo');
        test.done();
      });
  },

  slim(test) {
    test.expect(9);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';

    /*
      project
      ├── .tesselignore
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselignore
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
     */

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(bundle => {
      // These things happen in the --slim path
      test.equal(this.project.callCount, 1);
      test.equal(this.compress.callCount, 2);
      test.equal(this.mkdirSync.callCount, 1);
      test.equal(this.outputFileSync.callCount, 3);

      // End

      /*
        $ find . -type f -name .tesselignore -exec cat {} \+
        mock-foo.js
        other.js
        package.json
      */

      test.equal(this.exclude.callCount, 1);
      test.deepEqual(this.exclude.lastCall.args[0], [
        'mock-foo.js',
        'test/unit/fixtures/project/mock-foo.js',
        'other.js',
        'test/unit/fixtures/project/other.js',
        'node_modules/foo/package.json',
        'test/unit/fixtures/project/node_modules/foo/package.json'
      ].map(path.normalize));

      const minified = this.compress.lastCall.returnValue;
      test.equal(this.compress.callCount, 2);
      test.equal(minified.indexOf('!!mock-foo!!') === -1, true);

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        test.deepEqual(entries, [
          'index.js',
          'node_modules/foo/index.js',
          'package.json'
        ]);
        test.done();
      });

    });
  },

  slimHitsErrorFromFstreamReader(test) {
    test.expect(1);

    const pipe = fstream.Reader.prototype.pipe;

    // Need to stub function in _actual_ fs (but we use fs-extra)
    this.readerPipe = sandbox.stub(fstream.Reader.prototype, 'pipe').callsFake(function() {
      this.emit('error', new Error('foo'));
      return pipe.apply(this, arguments);
    });

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';

    deployment.js.tarBundle({
        target: path.normalize(target),
        resolvedEntryPoint: entryPoint,
        compress: true,
        slim: true,
      })
      .then(() => {
        test.ok(false, 'tarBundle should not resolve');
        test.done();
      })
      .catch(error => {
        test.equal(error.toString(), 'Error: foo');
        test.done();
      });
  },

  slimHitsErrorInfsRemove(test) {
    test.expect(1);

    this.remove.restore();
    this.remove = sandbox.stub(fs, 'remove').callsFake((temp, handler) => {
      handler(new Error('foo'));
    });

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';

    deployment.js.tarBundle({
        target: path.normalize(target),
        resolvedEntryPoint: entryPoint,
        compress: true,
        slim: true,
      })
      .then(() => {
        this.remove.reset();
        test.ok(false, 'tarBundle should not resolve');
        test.done();
      })
      .catch(error => {
        test.equal(error.toString(), 'Error: foo');
        test.done();
      });
  },

  slimHitsErrorFromCompress(test) {
    test.expect(1);

    this.compress.restore();
    this.compress = sandbox.stub(deployment.js, 'compress').callsFake(() => {
      throw new Error('foo');
    });

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';

    deployment.js.tarBundle({
        target: path.normalize(target),
        resolvedEntryPoint: entryPoint,
        compress: true,
        slim: true,
      })
      .then(() => {
        test.ok(false, 'tarBundle should not resolve');
        test.done();
      })
      .catch(error => {
        test.equal(error.toString(), 'Error: foo');
        test.done();
      });
  },

  slimHitsErrorFromProjectCollect(test) {
    test.expect(1);

    this.collect.restore();
    this.collect = sandbox.stub(Project.prototype, 'collect').callsFake((handler) => {
      handler(new Error('foo'));
    });

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';

    deployment.js.tarBundle({
        target: path.normalize(target),
        resolvedEntryPoint: entryPoint,
        compress: true,
        slim: true,
      })
      .then(() => {
        test.ok(false, 'tarBundle should not resolve');
        test.done();
      })
      .catch(error => {
        test.equal(error.toString(), 'Error: foo');
        test.done();
      });
  },

  slimHitsErrorFromProject(test) {
    test.expect(1);

    this.collect.restore();
    this.collect = sandbox.stub(Project.prototype, 'collect').callsFake(function() {
      this.emit('error', new Error('foo'));
    });

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';

    deployment.js.tarBundle({
        target: path.normalize(target),
        resolvedEntryPoint: entryPoint,
        compress: true,
        slim: true,
      })
      .then(() => {
        test.ok(false, 'tarBundle should not resolve');
        test.done();
      })
      .catch(error => {
        test.equal(error.toString(), 'Error: foo');
        test.done();
      });
  },

  compressionProducesNoErrors(test) {
    test.expect(1);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/syntax-error';

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(bundle => {
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }
        test.deepEqual(entries, [
          'arrow.js',
          'index.js',
          'package.json',
        ]);
        test.done();
      });
    }).catch(() => {
      test.ok(false, 'Compression should not produce errors');
      test.done();
    });
  },

  compressionIsSkipped(test) {
    test.expect(2);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/syntax-error';

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: false,
      slim: true,
    }).then(bundle => {
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // compression mechanism is never called when --compress=false
        test.equal(this.compress.callCount, 0);
        test.deepEqual(entries, [
          'arrow.js',
          'index.js',
          'package.json',
        ]);

        test.done();
      });
    }).catch(() => {
      test.ok(false, 'Compression should not produce errors');
      test.done();
    });
  },

  slimTesselInit(test) {
    test.expect(5);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/init';

    /*
      init
      ├── index.js
      └── package.json

      0 directories, 2 files
     */

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(bundle => {
      test.equal(this.project.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.mkdirSync.callCount, 1);

      const minified = this.compress.lastCall.returnValue;

      test.equal(minified, 'const e=require("tessel"),{2:o,3:l}=e.led;o.on(),setInterval(()=>{o.toggle(),l.toggle()},100),console.log("I\'m blinking! (Press CTRL + C to stop)");');

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        test.deepEqual(entries, ['index.js', 'package.json']);
        test.done();
      });
    });
  },

  slimSingle(test) {
    test.expect(4);

    const target = 'test/unit/fixtures/project';
    const entryPoint = 'index.js';

    deployment.js.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      compress: true,
      resolvedEntryPoint: entryPoint,
      single: true,
      slim: true,
    }).then(bundle => {
      test.equal(this.project.callCount, 1);
      test.equal(this.compress.callCount, 1);

      test.equal(bundle.length, 2048);
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        test.deepEqual(entries, ['index.js']);
        test.done();
      });
    });
  },

  slimSingleNested(test) {
    test.expect(4);

    const target = 'test/unit/fixtures/project';
    const entryPoint = 'another.js';

    deployment.js.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      compress: true,
      resolvedEntryPoint: path.join('nested', entryPoint),
      single: true,
      slim: true,

    }).then(bundle => {
      test.equal(this.project.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(bundle.length, 2560);

      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        test.deepEqual(entries, ['nested/another.js']);
        test.done();
      });
    });
  },

  fullSingle(test) {
    test.expect(3);

    const target = 'test/unit/fixtures/project';
    const entryPoint = 'index.js';

    deployment.js.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      compress: true,
      resolvedEntryPoint: entryPoint,
      single: true,
      full: true,
    }).then(bundle => {

      test.equal(this.addIgnoreRules.callCount, 3);
      test.equal(bundle.length, 2048);

      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }
        test.deepEqual(entries, ['index.js']);
        test.done();
      });
    });
  },

  fullSingleNested(test) {
    test.expect(2);

    const target = 'test/unit/fixtures/project';
    const entryPoint = 'another.js';

    deployment.js.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      compress: true,
      resolvedEntryPoint: path.join('nested', entryPoint),
      single: true,
      full: true,
    }).then(bundle => {
      test.equal(bundle.length, 2560);
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }
        test.deepEqual(entries, ['nested/another.js']);
        test.done();
      });

    });
  },

  slimIncludeOverridesIgnore(test) {
    test.expect(9);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project-include-overrides-ignore';

    /*
      project-include-overrides-ignore
      ├── .tesselignore
      ├── .tesselinclude
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselignore
      │       ├── .tesselinclude
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 11 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 8 + listRuleLength);

      /*
        All .tesselignore rules are negated by all .tesselinclude rules:

        $ find . -type f -name .tesselignore -exec cat {} \+
        mock-foo.js
        other.js
        package.json

        $ find . -type f -name .tesselinclude -exec cat {} \+
        mock-foo.js
        other.js
        package.json
      */

      // 'other.js' doesn't appear in the source, but is explicitly included
      test.equal(this.copySync.callCount, 1);
      test.equal(this.copySync.lastCall.args[0].endsWith('other.js'), true);

      // Called, but without any arguments
      test.equal(this.exclude.callCount, 1);
      test.equal(this.exclude.lastCall.args[0].length, 0);

      test.equal(this.project.callCount, 1);
      // 3 js files are compressed
      test.equal(this.compress.callCount, 3);
      test.equal(this.remove.callCount, 1);

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // Since the .tesselignore rules are ALL negated by .tesselinclude rules,
        // the additional files are copied into the temporary bundle dir, and
        // then included in the tarred bundle.
        test.deepEqual(entries, [
          'index.js',
          'mock-foo.js',
          'node_modules/foo/index.js',
          'node_modules/foo/package.json',
          'other.js',
          'package.json',
        ]);

        test.done();
      });
    });
  },

  fullIncludeOverridesIgnore(test) {
    test.expect(8);

    const target = 'test/unit/fixtures/project-include-overrides-ignore';

    /*
      project-include-overrides-ignore
      ├── .tesselignore
      ├── .tesselinclude
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselignore
      │       ├── .tesselinclude
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 11 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      compress: true,
      full: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 8 + listRuleLength);

      // addIgnoreRules might be called many times, but we only
      // care about tracking the call that's explicitly made by
      // tessel's deploy operation
      test.deepEqual(this.addIgnoreRules.getCall(0).args[0], [
        '**/.tesselignore',
        '**/.tesselinclude',
      ]);

      /*
        $ find . -type f -name .tesselignore -exec cat {} \+
        mock-foo.js
        other.js
        package.json
      */

      test.equal(this.exclude.callCount, 0);


      // These things don't happen in the --full path
      test.equal(this.project.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // The .tesselignore rules are ALL overridden by .tesselinclude rules
        test.deepEqual(entries, [
          'index.js',
          'mock-foo.js',
          'nested/another.js',
          'node_modules/foo/index.js',
          'other.js',
          'package.json'
        ]);

        test.done();
      });
    });
  },

  slimIncludeWithoutIgnore(test) {
    test.expect(9);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project-include-without-ignore';

    /*
      project-include-without-ignore
      ├── .tesselinclude
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselinclude
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 5 + listRuleLength);

      /*
        There are NO .tesselignore rules, but there are .tesselinclude rules:

        $ find . -type f -name .tesselignore -exec cat {} \+
        (no results)

        $ find . -type f -name .tesselinclude -exec cat {} \+
        mock-foo.js
        other.js
        package.json

      */

      // Called, but without any arguments
      test.equal(this.exclude.callCount, 1);
      test.equal(this.exclude.lastCall.args[0].length, 0);

      // 'other.js' doesn't appear in the source, but is explicitly included
      test.equal(this.copySync.callCount, 1);
      test.equal(this.copySync.lastCall.args[0].endsWith('other.js'), true);

      test.equal(this.project.callCount, 1);
      test.equal(this.compress.callCount, 3);
      test.equal(this.remove.callCount, 1);

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // There are no .tesselignore rules, all .tesselinclude rules are
        // respected the additional files are copied into the temporary
        // bundle dir, and then included in the tarred bundle.
        test.deepEqual(entries, [
          'index.js',
          'mock-foo.js',
          'node_modules/foo/index.js',
          'node_modules/foo/package.json',
          'other.js',
          'package.json'
        ]);

        test.done();
      });
    });
  },

  fullIncludeWithoutIgnore(test) {
    test.expect(8);

    /*
      !! TAKE NOTE!!

      This is actually the default behavior. That is to say:
      these files would be included, whether they are listed
      in the .tesselinclude file or not.
    */

    const target = 'test/unit/fixtures/project-include-without-ignore';

    /*
      project-include-without-ignore
      ├── .tesselinclude
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselinclude
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      compress: true,
      full: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 5 + listRuleLength);

      // addIgnoreRules might be called many times, but we only
      // care about tracking the call that's explicitly made by
      // tessel's deploy operation
      test.deepEqual(this.addIgnoreRules.getCall(0).args[0], [
        '**/.tesselignore',
        '**/.tesselinclude',
      ]);

      /*
        There are NO .tesselignore rules, but there are .tesselinclude rules:

        $ find . -type f -name .tesselignore -exec cat {} \+
        (no results)

        $ find . -type f -name .tesselinclude -exec cat {} \+
        mock-foo.js
        other.js
        package.json

      */

      test.equal(this.exclude.callCount, 0);


      // These things don't happen in the --full path
      test.equal(this.project.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // There are no .tesselignore rules, all .tesselinclude rules are
        // respected the additional files are copied into the temporary
        // bundle dir, and then included in the tarred bundle.
        test.deepEqual(entries, [
          'index.js',
          'mock-foo.js',
          'nested/another.js',
          'node_modules/foo/index.js',
          'node_modules/foo/package.json',
          'other.js',
          'package.json'
        ]);

        test.done();
      });
    });
  },

  slimIncludeHasNegateRules(test) {
    test.expect(8);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project-include-has-negate-rules';

    /*
      project-include-has-negate-rules
      .
      ├── .tesselinclude
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselinclude
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
    */
    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 6 + listRuleLength);

      /*
        There are NO .tesselignore rules, but there are .tesselinclude rules:

        $ find . -type f -name .tesselignore -exec cat {} \+
        (no results)

        $ find . -type f -name .tesselinclude -exec cat {} \+
        !mock-foo.js
        other.js
        package.json

        The negated rule will be transferred.

      */
      test.equal(this.exclude.callCount, 1);


      // Called once for the extra file matching
      // the .tesselinclude rules
      test.equal(this.copySync.callCount, 1);

      test.equal(this.project.callCount, 1);
      test.equal(this.compress.callCount, 2);
      // The 4 files discovered and listed in the dependency graph
      // See bundle extraction below.
      test.equal(this.outputFileSync.callCount, 4);

      test.equal(this.remove.callCount, 1);

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // There are no .tesselignore rules, but the .tesselinclude rules
        // include a negated pattern. The additional, non-negated files
        // are copied into the temporary bundle dir, and then included
        // in the tarred bundle.
        test.deepEqual(entries, [
          'index.js',
          // mock-foo.js MUST NOT BE PRESENT
          'node_modules/foo/index.js',
          'node_modules/foo/package.json',
          'other.js',
          'package.json',
        ]);

        test.done();
      });
    });
  },

  fullIncludeHasNegateRules(test) {
    test.expect(8);

    const target = 'test/unit/fixtures/project-include-has-negate-rules';

    /*
      project-include-has-negate-rules
      .
      ├── .tesselinclude
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselinclude
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      compress: true,
      full: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 6 + listRuleLength);

      // addIgnoreRules might be called many times, but we only
      // care about tracking the call that's explicitly made by
      // tessel's deploy operation
      test.deepEqual(this.addIgnoreRules.getCall(0).args[0], [
        '**/.tesselignore',
        '**/.tesselinclude',
      ]);

      // This is where the negated rule is transferred.
      test.deepEqual(this.addIgnoreRules.getCall(1).args[0], [
        // Note that the "!" was stripped from the rule
        'mock-foo.js',
      ]);

      /*
        There are NO .tesselignore rules, but there are .tesselinclude rules:

        $ find . -type f -name .tesselignore -exec cat {} \+
        (no results)

        $ find . -type f -name .tesselinclude -exec cat {} \+
        !mock-foo.js
        other.js
        package.json

        The negated rule will be transferred.

      */

      // These things don't happen in the --full path
      test.equal(this.project.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // There are no .tesselignore rules, all .tesselinclude rules are
        // respected the additional files are copied into the temporary
        // bundle dir, and then included in the tarred bundle.
        test.deepEqual(entries, [
          'index.js',
          // mock-foo.js is NOT present
          'nested/another.js',
          'node_modules/foo/index.js',
          'node_modules/foo/package.json',
          'other.js',
          'package.json'
        ]);

        test.done();
      });
    });
  },

  slimSingleInclude(test) {
    test.expect(2);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project-include-without-ignore';

    /*
      project-include-without-ignore
      ├── .tesselinclude
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── .tesselinclude
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 9 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
      single: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 5 + listRuleLength);

      /*
        There are .tesselinclude rules, but the single flag is present
        so they don't matter. The only file sent must be the file specified.
      */

      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        // Only the explicitly specified `index.js` will
        // be included in the deployed code.
        test.deepEqual(entries, [
          'index.js',
        ]);

        test.done();
      });
    });
  },

  detectAssetsWithoutInclude(test) {
    test.expect(4);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project-assets-without-include';

    /*
      project-assets-without-include
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── index.js
      │       └── package.json
      ├── other.js
      └── package.json

      3 directories, 7 files
    */


    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(() => {

      test.equal(this.readdirSync.callCount, 1);
      test.equal(this.readdirSync.lastCall.args[0], path.normalize(target));

      test.equal(this.warn.callCount, 1);
      test.equal(this.warn.firstCall.args[0], 'Some assets in this project were not deployed (see: t2 run --help)');

      test.done();
    });
  },

  detectAssetsWithoutIncludeEliminatedByDepGraph(test) {
    test.expect(3);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project-assets-without-include-eliminated-by-dep-graph';

    /*
      project-assets-without-include
      ├── index.js
      ├── mock-foo.js
      ├── nested
      │   └── another.js
      ├── node_modules
      │   └── foo
      │       ├── index.js
      │       └── package.json
      └── package.json

      3 directories, 6 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(() => {
      test.equal(this.readdirSync.callCount, 1);
      test.equal(this.readdirSync.lastCall.args[0], path.normalize(target));
      test.equal(this.warn.callCount, 0);

      // Ultimately, all assets were accounted for, even though
      // no tesselinclude existed.
      test.done();
    });
  },

  alwaysExplicitlyProvideProjectDirname(test) {
    test.expect(1);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then(() => {
      test.deepEqual(this.project.lastCall.args[0], {
        entry: path.join(target, entryPoint),
        dirname: path.normalize(target),
      });
      test.done();
    });
  },

  detectAndEliminateDisallowedAssets(test) {
    test.expect(1);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project-ignore-disallowed';

    /*
      project-ignore-disallowed
      ├── index.js
      ├── node_modules
      │   └── tessel
      │       ├── index.js
      │       └── package.json
      └── package.json

      2 directories, 4 files
    */

    deployment.js.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      compress: true,
      slim: true,
    }).then((bundle) => {
      // Extract and inspect the bundle...
      extract(bundle, (error, entries) => {
        if (error) {
          test.ok(false, error.toString());
          test.done();
        }

        test.deepEqual(entries, [
          'index.js',
          'package.json'
        ]);
        test.done();
      });
    });
  },

  iteratesBinaryModulesUsed(test) {
    test.expect(5);

    const entryPoint = 'index.js';
    const target = 'test/unit/fixtures/project';
    const details = {
      modulePath: ''
    };

    this.minimatch = sandbox.stub(deployment.js, 'minimatch').returns(true);

    this.rules = sandbox.stub(glob, 'rules').callsFake(() => {
      return [
        'a', 'b',
      ];
    });

    this.forEach = sandbox.stub(Map.prototype, 'forEach').callsFake((handler) => {
      handler(details);
    });

    deployment.js.tarBundle({
        target: path.normalize(target),
        resolvedEntryPoint: entryPoint,
        compress: true,
        slim: true,
      })
      .then(() => {
        test.equal(this.forEach.callCount, 2);
        test.equal(this.minimatch.callCount, 3);
        test.deepEqual(this.minimatch.getCall(0).args, ['', 'a', {
          matchBase: true,
          dot: true
        }]);
        test.deepEqual(this.minimatch.getCall(1).args, ['', 'b', {
          matchBase: true,
          dot: true
        }]);
        test.deepEqual(this.minimatch.getCall(2).args, ['', 'node_modules/**/tessel/**/*', {
          matchBase: true,
          dot: true
        }]);

        test.done();
      });
  },
};

var fixtures = {
  project: path.join(FIXTURE_PATH, '/find-project'),
  explicit: path.join(FIXTURE_PATH, '/find-project-explicit-main')
};

exports['deploy.findProject'] = {
  setUp(done) {
    done();
  },

  tearDown(done) {
    sandbox.restore();
    done();
  },

  home(test) {
    test.expect(1);

    var fake = path.normalize('/fake/test/home/dir');

    this.homedir = sandbox.stub(os, 'homedir').returns(fake);
    this.lstatSync = sandbox.stub(fs, 'lstatSync').callsFake((file) => {
      return {
        isDirectory: () => {
          // naive for testing.
          return file.slice(-1) === '/';
        }
      };
    });

    this.realpathSync = sandbox.stub(fs, 'realpathSync').callsFake((arg) => {
      // Ensure that "~" was transformed
      test.equal(arg, path.normalize('/fake/test/home/dir/foo'));
      test.done();
      return '';
    });

    deploy.findProject({
      lang: deployment.js,
      entryPoint: '~/foo/',
      compress: true,
    });
  },

  byFile(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project/index.js';

    deploy.findProject({
      lang: deployment.js,
      entryPoint: target,
      compress: true,
    }).then(project => {
      test.deepEqual(project, {
        pushdir: fixtures.project,
        program: path.join(fixtures.project, 'index.js'),
        entryPoint: 'index.js'
      });
      test.done();
    });
  },

  byDirectory(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project/';

    deploy.findProject({
      lang: deployment.js,
      entryPoint: target
    }).then(project => {
      test.deepEqual(project, {
        pushdir: fixtures.project,
        program: path.join(fixtures.project, 'index.js'),
        entryPoint: 'index.js'
      });
      test.done();
    });
  },

  byDirectoryBWExplicitMain(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project-explicit-main/';

    deploy.findProject({
      lang: deployment.js,
      entryPoint: target
    }).then(project => {
      test.deepEqual(project, {
        pushdir: fixtures.explicit,
        program: path.join(fixtures.explicit, 'app.js'),
        entryPoint: 'app.js'
      });
      test.done();
    });
  },

  byDirectoryMissingIndex(test) {
    test.expect(1);

    var target = 'test/unit/fixtures/find-project-no-index/index.js';

    deploy.findProject({
      lang: deployment.js,
      entryPoint: target
    }).then(() => {
      test.ok(false, 'findProject should not find a valid project here');
      test.done();
    }).catch(error => {
      test.ok(error.includes('ENOENT'));
      test.done();
    });
  },

  byFileInSubDirectory(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project/test/index.js';

    deploy.findProject({
      lang: deployment.js,
      entryPoint: target
    }).then(project => {
      test.deepEqual(project, {
        pushdir: fixtures.project,
        program: path.join(fixtures.project, 'test/index.js'),
        entryPoint: path.normalize('test/index.js')
      });
      test.done();
    });
  },

  noPackageJsonSingle(test) {
    test.expect(1);

    var pushdir = path.normalize('test/unit/fixtures/project-no-package.json/');
    var entryPoint = path.normalize('test/unit/fixtures/project-no-package.json/index.js');

    var opts = {
      entryPoint: entryPoint,
      single: true,
      slim: true,
      lang: deployment.js,
    };

    deploy.findProject(opts).then(project => {
      // Without the `single` flag, this would've continued upward
      // until it found a directory with a package.json.
      test.equal(project.pushdir, fs.realpathSync(pushdir));
      test.done();
    });
  },

  noPackageJsonUseProgramDirname(test) {
    test.expect(1);

    // This is no package.json here
    var entryPoint = path.normalize('test/unit/fixtures/project-no-package.json/index.js');
    var opts = {
      entryPoint: entryPoint,
      lang: deployment.js,
      single: false,
    };

    this.endOfLookup = sandbox.stub(deploy, 'endOfLookup').returns(true);

    deploy.findProject(opts).then(project => {
      test.equal(project.pushdir, path.dirname(path.join(process.cwd(), entryPoint)));
      test.done();
    });
  },
};


exports['deploy.sendBundle, error handling'] = {
  setUp(done) {
    this.tessel = TesselSimulator();
    this.fetchCurrentBuildInfo = sandbox.stub(this.tessel, 'fetchCurrentBuildInfo').returns(Promise.resolve('40b2b46a62a34b5a26170c75f7e717cea673d1eb'));
    this.fetchNodeProcessVersions = sandbox.stub(this.tessel, 'fetchNodeProcessVersions').returns(Promise.resolve(processVersions));
    this.requestBuildList = sandbox.stub(updates, 'requestBuildList').returns(Promise.resolve(tesselBuilds));


    this.pathResolve = sandbox.stub(path, 'resolve');
    this.failure = 'FAIL';
    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    sandbox.restore();
    done();
  },

  findProject(test) {
    test.expect(1);

    this.findProject = sandbox.stub(deploy, 'findProject').callsFake(() => Promise.reject(this.failure));

    deploy.sendBundle(this.tessel, {
      lang: deployment.js
    }).catch(error => {
      test.equal(error, this.failure);
      test.done();
    });
  },

  resolveBinaryModules(test) {
    test.expect(1);

    this.pathResolve.restore();
    this.pathResolve = sandbox.stub(path, 'resolve').returns('');
    this.exists = sandbox.stub(fs, 'exists').callsFake((fpath, callback) => callback(true));

    this.findProject = sandbox.stub(deploy, 'findProject').callsFake(() => Promise.resolve({
      pushdir: '',
      entryPoint: ''
    }));

    this.resolveBinaryModules = sandbox.stub(deployment.js, 'resolveBinaryModules').callsFake(() => Promise.reject(this.failure));

    deploy.sendBundle(this.tessel, {
      lang: deployment.js
    }).catch(error => {
      test.equal(error, this.failure);
      test.done();
    });
  },

  tarBundle(test) {
    test.expect(1);

    this.pathResolve.restore();
    this.pathResolve = sandbox.stub(path, 'resolve').returns('');
    this.exists = sandbox.stub(fs, 'exists').callsFake((fpath, callback) => callback(true));

    this.findProject = sandbox.stub(deploy, 'findProject').callsFake(() => Promise.resolve({
      pushdir: '',
      entryPoint: ''
    }));

    this.resolveBinaryModules = sandbox.stub(deployment.js, 'resolveBinaryModules').callsFake(() => Promise.resolve());

    this.tarBundle = sandbox.stub(deployment.js, 'tarBundle').callsFake(() => Promise.reject(this.failure));

    deploy.sendBundle(this.tessel, {
      lang: deployment.js
    }).catch(error => {
      test.equal(error, this.failure);
      test.done();
    });
  },
};


exports['deployment.js.preBundle'] = {
  setUp(done) {
    this.tessel = TesselSimulator();

    this.info = sandbox.stub(log, 'info');
    this.exec = sandbox.stub(this.tessel.connection, 'exec').callsFake((command, callback) => {
      callback(null, this.tessel._rps);
    });

    this.receive = sandbox.stub(this.tessel, 'receive').callsFake((rps, callback) => {
      rps.emit('close');
      callback();
    });

    this.fetchCurrentBuildInfo = sandbox.stub(this.tessel, 'fetchCurrentBuildInfo').returns(Promise.resolve('40b2b46a62a34b5a26170c75f7e717cea673d1eb'));
    this.fetchNodeProcessVersions = sandbox.stub(this.tessel, 'fetchNodeProcessVersions').returns(Promise.resolve(processVersions));
    this.requestBuildList = sandbox.stub(updates, 'requestBuildList').returns(Promise.resolve(tesselBuilds));


    this.findProject = sandbox.stub(deploy, 'findProject').returns(Promise.resolve({
      pushdir: '',
      entryPoint: ''
    }));
    this.resolveBinaryModules = sandbox.stub(deployment.js, 'resolveBinaryModules').returns(Promise.resolve());
    this.tarBundle = sandbox.stub(deployment.js, 'tarBundle').returns(Promise.resolve(Buffer.from([0x00])));
    this.pathResolve = sandbox.stub(path, 'resolve');


    this.preBundle = sandbox.spy(deployment.js, 'preBundle');
    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    sandbox.restore();
    done();
  },

  preBundleChecksForNpmrc(test) {
    test.expect(1);

    const warning = tags.stripIndents `This project is missing an ".npmrc" file!
    To prepare your project for deployment, use the command:

      t2 init

    Once complete, retry:`;

    this.exists = sandbox.stub(fs, 'exists').callsFake((fpath, callback) => callback(false));

    deployment.js.preBundle({
      target: '/',
    }).catch(error => {
      test.equal(error.startsWith(warning), true);
      test.done();
    });
  },

  preBundleReceivesTessel(test) {
    test.expect(1);

    this.pathResolve.restore();
    this.pathResolve = sandbox.stub(path, 'resolve').returns('');
    this.exists = sandbox.stub(fs, 'exists').callsFake((fpath, callback) => callback(true));

    deploy.sendBundle(this.tessel, {
      target: '/',
      entryPoint: 'foo.js',
      lang: deployment.js
    }).then(() => {
      test.equal(this.preBundle.lastCall.args[0].tessel, this.tessel);
      test.done();
    });
  },
  // // We need to find a way to provde the build version directly from the
  // // Tessel 2 itself. This approach makes deployment slow with a network
  // // connection, or impossible without one.

  // preBundleCallsfetchCurrentBuildInfoAndForwardsResult(test) {
  //   test.expect(4);

  //   deploy.sendBundle(this.tessel, {
  //     target: '/',
  //     entryPoint: 'foo.js',
  //     lang: deployment.js
  //   }).then(() => {
  //     test.equal(this.fetchCurrentBuildInfo.callCount, 1);
  //     test.equal(this.resolveBinaryModules.callCount, 1);

  //     var args = this.resolveBinaryModules.lastCall.args[0];

  //     test.equal(args.tessel, this.tessel);
  //     test.equal(args.tessel.versions, processVersions);
  //     test.done();
  //   });
  // },

  // preBundleCallsrequestBuildListAndForwardsResult(test) {
  //   test.expect(4);

  //   deploy.sendBundle(this.tessel, {
  //     target: '/',
  //     entryPoint: 'foo.js',
  //     lang: deployment.js
  //   }).then(() => {
  //     test.equal(this.requestBuildList.callCount, 1);
  //     test.equal(this.resolveBinaryModules.callCount, 1);

  //     var args = this.resolveBinaryModules.lastCall.args[0];

  //     test.equal(args.tessel, this.tessel);
  //     test.equal(args.tessel.versions, processVersions);
  //     test.done();
  //   });
  // },

  // preBundleCallsfetchNodeProcessVersionsAndForwardsResult(test) {
  //   test.expect(4);

  //   deploy.sendBundle(this.tessel, {
  //     target: '/',
  //     entryPoint: 'foo.js',
  //     lang: deployment.js
  //   }).then(() => {
  //     test.equal(this.fetchNodeProcessVersions.callCount, 1);
  //     test.equal(this.resolveBinaryModules.callCount, 1);

  //     var args = this.resolveBinaryModules.lastCall.args[0];

  //     test.equal(args.tessel, this.tessel);
  //     test.equal(args.tessel.versions, processVersions);
  //     test.done();
  //   });
  // },
};

exports['deployment.js.resolveBinaryModules'] = {
  setUp(done) {

    this.target = path.normalize('test/unit/fixtures/project-binary-modules');
    this.relative = sandbox.stub(path, 'relative').callsFake(() => {
      return path.join(FIXTURE_PATH, '/project-binary-modules/');
    });
    this.globFiles = sandbox.spy(glob, 'files');
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
      ];
    });

    this.readGypFileSync = sandbox.stub(deployment.js.resolveBinaryModules, 'readGypFileSync').callsFake(() => {
      return '{"targets": [{"target_name": "missing"}]}';
    });

    this.getRoot = sandbox.stub(bindings, 'getRoot').callsFake((file) => {
      var pathPart = '';

      if (file.includes('debug')) {
        pathPart = 'debug';
      }

      if (file.includes('linked')) {
        pathPart = 'linked';
      }

      if (file.includes('missing')) {
        pathPart = 'missing';
      }

      if (file.includes('release')) {
        pathPart = 'release';
      }

      return path.normalize(`node_modules/${pathPart}/`);
    });

    this.ifReachable = sandbox.stub(remote, 'ifReachable').callsFake(() => Promise.resolve());

    done();
  },

  tearDown(done) {
    sandbox.restore();
    done();
  },

  bailOnSkipBinary(test) {
    test.expect(2);

    this.target = path.normalize('test/unit/fixtures/project-skip-binary');

    this.relative.restore();
    this.relative = sandbox.stub(path, 'relative').callsFake(() => {
      return path.join(FIXTURE_PATH, '/project-skip-binary/');
    });

    // We WANT to read the actual gyp files if necessary
    this.readGypFileSync.restore();

    // We WANT to glob the actual target directory
    this.globSync.restore();

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {

      test.equal(this.exists.callCount, 1);
      // test/unit/fixtures/skip-binary/ has the corresponding
      // dependencies for the following binary modules:
      //
      //    debug-1.1.1-Debug-node-v46-linux-mipsel
      //    release-1.1.1-Release-node-v46-linux-mipsel
      //
      // However, the latter has a "tessel.skipBinary = true" key in its package.json
      //
      //
      test.equal(this.exists.lastCall.args[0].endsWith(path.normalize('.tessel/binaries/debug-1.1.1-Debug-node-v46-linux-mipsel')), true);

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  buildPathExpWindow(test) {
    test.expect(1);

    let descriptor = Object.getOwnPropertyDescriptor(process, 'platform');

    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });

    this.match = sandbox.spy(String.prototype, 'match');
    this.target = path.normalize('test/unit/fixtures/project-skip-binary');
    this.relative.restore();
    this.relative = sandbox.stub(path, 'relative').callsFake(() => {
      return path.join(FIXTURE_PATH, '/project-skip-binary/');
    });

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {

      test.equal(
        this.match.lastCall.args[0].toString(),
        '/(?:build\\\\(Debug|Release|bindings)\\\\)/'
      );
      // Restore this descriptor
      Object.defineProperty(process, 'platform', descriptor);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  noOptionsTargetFallbackToCWD(test) {
    test.expect(3);

    const target = path.normalize('test/unit/fixtures/project');

    sandbox.stub(process, 'cwd').returns(target);

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      test.equal(this.relative.callCount, 1);
      test.equal(this.relative.lastCall.args[0], target);
      test.equal(this.relative.lastCall.args[1], target);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  noOptionsTargetFallbackToCWDNoRelative(test) {
    test.expect(1);

    this.relative.restore();
    this.relative = sandbox.stub(path, 'relative').returns('');
    this.cwd = sandbox.stub(process, 'cwd').returns('');
    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      test.ok(false, 'resolveBinaryModules should not resolve');
      test.done();
    }).catch(error => {
      // The thing to be found:
      //
      //  node_modules/release/package.json
      //
      // Will not be found, because it doesn't exist,
      // but in this case, that's exactly what we want.
      test.ok(error.toString().includes(`Error: Cannot find module '${path.normalize('node_modules/release/package.json')}'`));
      test.done();
    });
  },

  findsModulesMissingBinaryNodeFiles(test) {
    test.expect(2);


    this.globSync.restore();
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/release/binding.gyp'),
        path.normalize('node_modules/missing/binding.gyp'),
      ];
    });

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {

      test.deepEqual(
        this.globFiles.lastCall.args[1], ['node_modules/**/*.node', 'node_modules/**/binding.gyp']
      );

      test.equal(this.readGypFileSync.callCount, 1);

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  spawnPythonScriptReturnsNull(test) {
    test.expect(1);

    this.readGypFileSync.restore();
    this.readGypFileSync = sandbox.spy(deployment.js.resolveBinaryModules, 'readGypFileSync');

    this.globSync.restore();
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/release/binding.gyp'),
        path.normalize('node_modules/missing/binding.gyp'),
      ];
    });

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);
    this.spawnSync = sandbox.stub(cp, 'spawnSync').callsFake(() => {
      return {
        output: null
      };
    });

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      test.equal(this.readGypFileSync.lastCall.returnValue, '');
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },
  spawnPythonScript(test) {
    test.expect(7);

    this.readGypFileSync.restore();
    this.readGypFileSync = sandbox.spy(deployment.js.resolveBinaryModules, 'readGypFileSync');

    this.globSync.restore();
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/release/binding.gyp'),
        path.normalize('node_modules/missing/binding.gyp'),
      ];
    });

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);
    this.spawnSync = sandbox.stub(cp, 'spawnSync').callsFake(() => {
      return {
        output: [
          null, Buffer.from('{"targets": [{"target_name": "missing","sources": ["capture.c", "missing.cc"]}]}', 'utf8')
        ]
      };
    });

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {

      test.deepEqual(
        this.globFiles.lastCall.args[1], ['node_modules/**/*.node', 'node_modules/**/binding.gyp']
      );

      test.equal(this.readGypFileSync.callCount, 1);
      test.equal(this.spawnSync.callCount, 1);
      test.equal(this.spawnSync.lastCall.args[0], 'python');

      var python = this.spawnSync.lastCall.args[1][1];

      test.equal(python.startsWith('import ast, json; print json.dumps(ast.literal_eval(open('), true);
      test.equal(python.endsWith(').read()));'), true);
      test.equal(python.includes('missing'), true);

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  failsWithMessage(test) {
    test.expect(1);

    this.globSync.restore();
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/missing/binding.gyp'),
      ];
    });
    this.readGypFileSync.restore();
    this.readGypFileSync = sandbox.stub(deployment.js.resolveBinaryModules, 'readGypFileSync').callsFake(() => {
      return '{"targets": [{"target_name": "missing",}]}';
      //                                            ^
      //                                     That's intentional.
    });

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(binaryModulesUsed => {
      test.equal(binaryModulesUsed.get('missing@1.1.1').resolved, false);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  existsInLocalCache(test) {
    test.expect(2);

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      test.equal(this.globFiles.callCount, 1);
      test.equal(this.exists.callCount, 1);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  existsInLocalCacheNodeGypLinkedBinPath(test) {
    test.expect(1);

    this.readGypFileSync.restore();

    this.globSync.restore();
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/linked/build/bindings/linked.node'),
      ];
    });

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      test.equal(this.exists.callCount, 2);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  resolveFromRealDirFixtures(test) {
    test.expect(5);

    // We WANT to read the actual gyp files if necessary
    this.readGypFileSync.restore();
    // We WANT to glob the actual target directory
    this.globSync.restore();

    // To avoid making an actual network request,
    // make the program think these things are already
    // cached. The test to pass is that it calls fs.existsSync
    // with the correct things from the project directory (this.target)
    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {

      test.equal(this.exists.callCount, 4);

      // test/unit/fixtures/project-binary-modules/ has the corresponding
      // dependencies for the following binary modules:
      var cachedBinaryPaths = [
        '.tessel/binaries/debug-1.1.1-Debug-node-v46-linux-mipsel',
        '.tessel/binaries/linked-1.1.1-Release-node-v46-linux-mipsel',
        '.tessel/binaries/release-1.1.1-Release-node-v46-linux-mipsel',
        '.tessel/binaries/missing-1.1.1-Release-node-v46-linux-mipsel',
      ];

      cachedBinaryPaths.forEach((cbp, callIndex) => {
        test.equal(this.exists.getCall(callIndex).args[0].endsWith(path.normalize(cbp)), true);
      });

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  requestsRemote(test) {
    test.expect(12);

    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => false);
    this.mkdirp = sandbox.stub(fs, 'mkdirp').callsFake((dir, handler) => {
      handler();
    });

    this.transform = new Transform();
    this.transform.stubsUsed = [];
    this.rstream = null;

    this.pipe = sandbox.stub(stream.Stream.prototype, 'pipe').callsFake(() => {
      // After the second transform is piped, emit the end
      // event on the request stream;
      if (this.pipe.callCount === 2) {
        process.nextTick(() => this.rstream.emit('end'));
      }
      return this.rstream;
    });

    this.createGunzip = sandbox.stub(zlib, 'createGunzip').callsFake(() => {
      this.transform.stubsUsed.push('createGunzip');
      return this.transform;
    });

    this.Extract = sandbox.stub(tar, 'Extract').callsFake(() => {
      this.transform.stubsUsed.push('Extract');
      return this.transform;
    });

    this.request = sandbox.stub(request, 'Request').callsFake((opts) => {
      this.rstream = new Request(opts);
      return this.rstream;
    });

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      test.equal(this.globFiles.callCount, 1);
      test.equal(this.exists.callCount, 1);
      test.equal(this.mkdirp.callCount, 1);
      test.equal(this.mkdirp.lastCall.args[0].endsWith(path.normalize('.tessel/binaries/release-1.1.1-Release-node-v46-linux-mipsel')), true);

      test.equal(this.request.callCount, 1);

      var requestArgs = this.request.lastCall.args[0];
      test.equal(requestArgs.url, 'http://packages.tessel.io/npm/release-1.1.1-Release-node-v46-linux-mipsel.tgz');
      test.equal(requestArgs.gzip, true);

      test.equal(this.pipe.callCount, 2);
      test.equal(this.createGunzip.callCount, 1);
      test.equal(this.Extract.callCount, 1);
      test.equal(this.transform.stubsUsed.length, 2);
      test.deepEqual(this.transform.stubsUsed, ['createGunzip', 'Extract']);

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  requestsRemoteGunzipErrors(test) {
    test.expect(9);

    this.removeSync = sandbox.stub(fs, 'removeSync');
    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => false);
    this.mkdirp = sandbox.stub(fs, 'mkdirp').callsFake((dir, handler) => {
      handler();
    });

    this.transform = new Transform();
    this.transform.stubsUsed = [];
    this.rstream = null;

    this.pipe = sandbox.stub(stream.Stream.prototype, 'pipe').callsFake(() => {
      // After the second transform is piped, emit the end
      // event on the request stream;
      if (this.pipe.callCount === 2) {
        process.nextTick(() => this.rstream.emit('end'));
      }
      return this.rstream;
    });

    this.createGunzip = sandbox.stub(zlib, 'createGunzip').callsFake(() => {
      this.transform.stubsUsed.push('createGunzip');
      return this.transform;
    });

    this.Extract = sandbox.stub(tar, 'Extract').callsFake(() => {
      this.transform.stubsUsed.push('Extract');
      return this.transform;
    });

    this.request = sandbox.stub(request, 'Request').callsFake((opts) => {
      this.rstream = new Request(opts);
      return this.rstream;
    });

    // Hook into the ifReachable call to trigger an error at the gunzip stream
    this.ifReachable.restore();
    this.ifReachable = sandbox.stub(remote, 'ifReachable').callsFake(() => {
      this.transform.emit('error', {
        code: 'Z_DATA_ERROR',
      });
      return Promise.resolve();
    });

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      test.equal(this.globFiles.callCount, 1);
      test.equal(this.exists.callCount, 1);
      test.equal(this.mkdirp.callCount, 1);
      test.equal(this.mkdirp.lastCall.args[0].endsWith(path.normalize('.tessel/binaries/release-1.1.1-Release-node-v46-linux-mipsel')), true);

      // The result of gunzip emitting an error:
      test.equal(this.removeSync.callCount, 1);
      test.equal(this.removeSync.lastCall.args[0].endsWith(path.normalize('.tessel/binaries/release-1.1.1-Release-node-v46-linux-mipsel')), true);

      test.equal(this.request.callCount, 1);
      test.equal(this.createGunzip.callCount, 1);
      test.deepEqual(this.transform.stubsUsed, ['createGunzip', 'Extract']);

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },
};

exports['deployment.js.injectBinaryModules'] = {
  setUp(done) {
    this.target = path.normalize('test/unit/fixtures/project-binary-modules');
    this.relative = sandbox.stub(path, 'relative').callsFake(() => {
      return path.join(FIXTURE_PATH, '/project-binary-modules/');
    });
    this.globFiles = sandbox.spy(glob, 'files');
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
      ];
    });

    this.getRoot = sandbox.stub(bindings, 'getRoot').callsFake((file) => {
      var pathPart = '';

      if (file.includes('debug')) {
        pathPart = 'debug';
      }

      if (file.includes('linked')) {
        pathPart = 'linked';
      }

      if (file.includes('missing')) {
        pathPart = 'missing';
      }

      if (file.includes('release')) {
        pathPart = 'release';
      }

      return path.normalize(`node_modules/${pathPart}/`);
    });

    this.globRoot = path.join(FIXTURE_PATH, '/project-binary-modules/');
    this.copySync = sandbox.stub(fs, 'copySync');
    this.exists = sandbox.stub(fs, 'existsSync').callsFake(() => true);
    done();
  },

  tearDown(done) {
    sandbox.restore();
    done();
  },

  copies(test) {
    test.expect(17);


    this.globSync.restore();
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/debug/build/Debug/debug.node'),
        path.normalize('node_modules/debug/binding.gyp'),
        path.normalize('node_modules/linked/build/bindings/linked.node'),
        path.normalize('node_modules/linked/binding.gyp'),
        path.normalize('node_modules/missing/build/Release/missing.node'),
        path.normalize('node_modules/missing/binding.gyp'),
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/release/binding.gyp'),
      ];
    });

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      deployment.js.injectBinaryModules(this.globRoot, fsTemp.mkdirSync(), {}).then(() => {
        test.equal(this.copySync.callCount, 8);

        var args = this.copySync.args;
        /*

        This is an abbreviated view of what should be copied by this operation:
        [
          [
            'debug-1.1.1-Release-node-v46-linux-mipsel/Debug/debug.node',
            'debug/build/Debug/debug.node'
          ],
          [
            'debug/package.json',
            'debug/package.json'
          ],
          [
            'linked-1.1.1-Release-node-v46-linux-mipsel/bindings/linked.node',
            'linked/build/bindings/linked.node'
          ],
          [
            'linked/package.json',
            'linked/package.json'
          ],
          [
            'missing-1.1.1-Release-node-v46-linux-mipsel/Release/missing.node',
            'missing/build/Release/missing.node'
          ],
          [
            'missing/package.json',
            'missing/package.json'
          ],
          [
            'release-1.1.1-Release-node-v46-linux-mipsel/Release/release.node',
            'release/build/Release/release.node'
          ],
          [
            'release/package.json',
            'release/package.json'
          ]
        ]
        */

        // ----- fixtures/project-binary-modules/node_modules/debug
        test.equal(
          args[0][0].endsWith(path.normalize('debug-1.1.1-Debug-node-v46-linux-mipsel/Debug/debug.node')),
          true
        );
        test.equal(
          args[0][1].endsWith(path.normalize('debug/build/Debug/debug.node')),
          true
        );

        test.equal(
          args[1][0].endsWith(path.normalize('debug/package.json')),
          true
        );
        test.equal(
          args[1][1].endsWith(path.normalize('debug/package.json')),
          true
        );

        // ----- fixtures/project-binary-modules/node_modules/linked
        test.equal(
          args[2][0].endsWith(path.normalize('linked-1.1.1-Release-node-v46-linux-mipsel/bindings/linked.node')),
          true
        );
        test.equal(
          args[2][1].endsWith(path.normalize('linked/build/bindings/linked.node')),
          true
        );

        test.equal(
          args[3][0].endsWith(path.normalize('linked/package.json')),
          true
        );
        test.equal(
          args[3][1].endsWith(path.normalize('linked/package.json')),
          true
        );

        // ----- fixtures/project-binary-modules/node_modules/missing
        test.equal(
          args[4][0].endsWith(path.normalize('missing-1.1.1-Release-node-v46-linux-mipsel/Release/missing.node')),
          true
        );
        test.equal(
          args[4][1].endsWith(path.normalize('missing/build/Release/missing.node')),
          true
        );

        test.equal(
          args[5][0].endsWith(path.normalize('missing/package.json')),
          true
        );
        test.equal(
          args[5][1].endsWith(path.normalize('missing/package.json')),
          true
        );

        // ----- fixtures/project-binary-modules/node_modules/release
        test.equal(
          args[6][0].endsWith(path.normalize('release-1.1.1-Release-node-v46-linux-mipsel/Release/release.node')),
          true
        );
        test.equal(
          args[6][1].endsWith(path.normalize('release/build/Release/release.node')),
          true
        );

        test.equal(
          args[7][0].endsWith(path.normalize('release/package.json')),
          true
        );
        test.equal(
          args[7][1].endsWith(path.normalize('release/package.json')),
          true
        );

        test.done();
      }).catch(error => {
        test.ok(false, error.toString());
        test.done();
      });
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  doesNotCopyIgnoredBinaries(test) {
    test.expect(1);
    this.target = path.normalize('test/unit/fixtures/project-ignore-binary');
    this.relative.restore();
    this.relative = sandbox.stub(path, 'relative').callsFake(() => {
      return path.join(FIXTURE_PATH, '/project-ignore-binary/');
    });

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      deployment.js.injectBinaryModules(this.globRoot, fsTemp.mkdirSync(), {}).then(() => {
        // Nothing gets copied!
        test.equal(this.copySync.callCount, 0);
        test.done();
      });
    });
  },

  usesBinaryHighestInTreeWhenEncounteringDuplicates(test) {
    test.expect(6);
    this.target = path.normalize('test/unit/fixtures/project-binary-modules-duplicate-lower-deps');
    this.relative.restore();
    this.relative = sandbox.stub(path, 'relative').callsFake(() => {
      return path.join(FIXTURE_PATH, '/project-binary-modules-duplicate-lower-deps/');
    });

    // We WANT to glob the actual target directory
    this.globSync.restore();

    this.mapHas = sandbox.spy(Map.prototype, 'has');
    this.mapGet = sandbox.spy(Map.prototype, 'get');
    this.mapSet = sandbox.spy(Map.prototype, 'set');
    this.arrayMap = sandbox.spy(Array.prototype, 'map');

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(binaryModulesUsed => {
      // Ensure that 2 modules with the same name and version were found!
      for (var i = 0; i < this.arrayMap.callCount; i++) {
        let call = this.arrayMap.getCall(i);
        if (call.thisValue.UNRESOLVED_BINARY_LIST) {
          test.equal(call.thisValue.length, 2);
        }
      }
      test.equal(this.mapHas.callCount, 2);
      test.equal(this.mapHas.getCall(0).args[0], 'release@1.1.1');
      test.equal(this.mapHas.getCall(1).args[0], 'release@1.1.1');

      // Ensure that only one of the two were included in the
      // final list of binary modules to bundle
      test.equal(binaryModulesUsed.size, 1);
      // Ensure that the swap has occurred
      test.equal(
        path.normalize(binaryModulesUsed.get('release@1.1.1').globPath),
        path.normalize('node_modules/release/build/Release/release.node')
      );

      test.done();
    });
  },

  fallbackWhenOptionsMissing(test) {
    test.expect(1);

    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(binaryModulesUsed => {

      binaryModulesUsed.clear();

      // We need something to look at...
      sandbox.stub(binaryModulesUsed, 'forEach');

      deployment.js.injectBinaryModules(this.globRoot, fsTemp.mkdirSync()).then(() => {
        test.equal(binaryModulesUsed.forEach.callCount, 1);
        test.done();
      });
    });
  },

  doesNotCopyWhenOptionsSingleTrue(test) {
    test.expect(1);
    // This would normally result in 8 calls to this.copySync
    this.globSync.restore();
    this.globSync = sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        path.normalize('node_modules/debug/build/Debug/debug.node'),
        path.normalize('node_modules/debug/binding.gyp'),
        path.normalize('node_modules/linked/build/bindings/linked.node'),
        path.normalize('node_modules/linked/binding.gyp'),
        path.normalize('node_modules/missing/build/Release/missing.node'),
        path.normalize('node_modules/missing/binding.gyp'),
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/release/binding.gyp'),
      ];
    });
    deployment.js.resolveBinaryModules({
      target: this.target,
      tessel: {
        versions: {
          modules: 46
        },
      },
    }).then(() => {
      deployment.js.injectBinaryModules(this.globRoot, fsTemp.mkdirSync(), {
        single: true
      }).then(() => {
        // Nothing gets copied!
        test.equal(this.copySync.callCount, 0);
        test.done();
      });
    });
  },


  rewriteBinaryBuildPlatformPaths(test) {
    test.expect(2);

    this.forEach = sandbox.stub(Map.prototype, 'forEach').callsFake((handler) => {
      handler({
        binName: 'serialport.node',
        buildPath: path.normalize('/build/Release/node-v46-FAKE_PLATFORM-FAKE_ARCH/'),
        buildType: 'Release',
        globPath: path.normalize('node_modules/serialport/build/Release/node-v46-FAKE_PLATFORM-FAKE_ARCH/serialport.node'),
        ignored: false,
        name: 'serialport',
        modulePath: path.normalize('node_modules/serialport'),
        resolved: true,
        version: '2.0.6',
        extractPath: path.normalize('~/.tessel/binaries/serialport-2.0.6-Release-node-v46-linux-mipsel')
      });
    });

    var find = lists.binaryPathTranslations['*'][0].find;

    lists.binaryPathTranslations['*'][0].find = 'FAKE_PLATFORM-FAKE_ARCH';

    deployment.js.injectBinaryModules(this.globRoot, fsTemp.mkdirSync(), {}).then(() => {
      // If the replacement operation did not work, these would still be
      // "FAKE_PLATFORM-FAKE_ARCH"

      test.equal(this.copySync.firstCall.args[0].endsWith(path.normalize('linux-mipsel/serialport.node')), true);
      test.equal(this.copySync.firstCall.args[1].endsWith(path.normalize('linux-mipsel/serialport.node')), true);
      // Restore the path translation...
      lists.binaryPathTranslations['*'][0].find = find;

      test.done();
    });
  },

  tryTheirPathAndOurPath(test) {
    test.expect(3);

    this.copySync.restore();
    this.copySync = sandbox.stub(fs, 'copySync').callsFake(() => {
      // Fail the first try/catch on THEIR PATH
      if (this.copySync.callCount === 1) {
        throw new Error('ENOENT: no such file or directory');
      }
    });

    this.forEach = sandbox.stub(Map.prototype, 'forEach').callsFake((handler) => {
      handler({
        binName: 'node_sqlite3.node',
        // This path doesn't match our precompiler's output paths.
        // Will result in:
        // ERR! Error: ENOENT: no such file or directory, stat '~/.tessel/binaries/sqlite3-3.1.4-Release/node-v46-something-else/node_sqlite3.node'
        buildPath: path.normalize('/lib/binding/node-v46-something-else/'),
        buildType: 'Release',
        globPath: path.normalize('node_modules/sqlite3/lib/binding/node-v46-something-else/node_sqlite3.node'),
        ignored: false,
        name: 'sqlite3',
        modulePath: path.normalize('node_modules/sqlite3'),
        resolved: true,
        version: '3.1.4',
        extractPath: path.normalize('~/.tessel/binaries/sqlite3-3.1.4-Release'),
      });
    });

    deployment.js.injectBinaryModules(this.globRoot, fsTemp.mkdirSync(), {}).then(() => {
      // 2 calls: 1 call for each try/catch fs.copySync
      // 1 call: copy the package.json
      test.equal(fs.copySync.callCount, 3);
      // THEIR PATH
      test.equal(this.copySync.getCall(0).args[0].endsWith(path.normalize('node-v46-something-else/node_sqlite3.node')), true);
      // OUR PATH
      test.equal(this.copySync.getCall(1).args[0].endsWith(path.normalize('Release/node_sqlite3.node')), true);
      test.done();
    });
  },

  tryCatchTwiceAndFailGracefullyWithMissingBinaryMessage(test) {
    test.expect(4);

    this.copySync.restore();
    this.copySync = sandbox.stub(fs, 'copySync').callsFake(() => {
      throw new Error('E_THIS_IS_NOT_REAL');
    });

    this.forEach = sandbox.stub(Map.prototype, 'forEach').callsFake((handler) => {
      handler({
        binName: 'not-a-thing.node',
        // This path doesn't match our precompiler's output paths.
        // Will result in:
        // ERR! Error: ENOENT: no such file or directory, stat '~/.tessel/binaries/not-a-thing-3.1.4-Release/node-v46-something-else/not-a-thing.node'
        buildPath: path.normalize('/lib/binding/node-v46-something-else/'),
        buildType: 'Release',
        globPath: path.normalize('node_modules/not-a-thing/lib/binding/node-v46-something-else/not-a-thing.node'),
        ignored: false,
        name: 'not-a-thing',
        modulePath: path.normalize('node_modules/not-a-thing'),
        resolved: true,
        version: '3.1.4',
        extractPath: path.normalize('~/.tessel/binaries/not-a-thing-3.1.4-Release'),
      });
    });

    this.error = sandbox.stub(log, 'error');
    this.logMissingBinaryModuleWarning = sandbox.stub(deployment.js, 'logMissingBinaryModuleWarning');

    deployment.js.injectBinaryModules(this.globRoot, fsTemp.mkdirSync(), {}).then(() => {
      // 2 calls: 1 call for each try/catch fs.copySync
      test.equal(this.copySync.callCount, 2);

      // Result of failing both attempts to copy
      test.equal(this.logMissingBinaryModuleWarning.callCount, 1);
      test.equal(this.error.callCount, 1);
      test.equal(String(this.error.lastCall.args[0]).includes('E_THIS_IS_NOT_REAL'), true);
      test.done();
    });
  }
};

exports['deploy.createShellScript'] = {
  setUp(done) {
    this.info = sandbox.stub(log, 'info');
    this.tessel = TesselSimulator();
    done();
  },
  tearDown(done) {
    this.tessel.mockClose();
    sandbox.restore();
    done();
  },

  remoteShellScriptPathIsNotPathNormalized(test) {
    test.expect(2);

    this.exec = sandbox.stub(this.tessel.connection, 'exec').callsFake((command, callback) => {
      callback(null, this.tessel._rps);
      this.tessel._rps.emit('close');
    });

    var opts = {
      lang: deployment.js,
      resolvedEntryPoint: 'foo',
      binopts: [],
      subargs: [],
    };

    deploy.createShellScript(this.tessel, opts).then(() => {
      test.deepEqual(this.exec.firstCall.args[0], ['dd', 'of=/app/start']);
      test.deepEqual(this.exec.lastCall.args[0], ['chmod', '+x', '/app/start']);
      test.done();
    });
  },

  remoteShellScriptPathIsNotPathNormalizedWithSubargs(test) {
    test.expect(2);

    this.exec = sandbox.stub(this.tessel.connection, 'exec').callsFake((command, callback) => {
      callback(null, this.tessel._rps);
      this.tessel._rps.emit('close');
    });

    var opts = {
      lang: deployment.js,
      resolvedEntryPoint: 'foo',
      binopts: ['--harmony'],
      subargs: ['--key=value'],
    };

    deploy.createShellScript(this.tessel, opts).then(() => {
      test.deepEqual(this.exec.firstCall.args[0], ['dd', 'of=/app/start']);
      test.deepEqual(this.exec.lastCall.args[0], ['chmod', '+x', '/app/start']);
      test.done();
    });
  }
};

// Test dependencies are required and exposed in common/bootstrap.js

exports['deployment.js.lists'] = {
  setUp(done) {
    done();
  },

  tearDown(done) {
    done();
  },

  checkIncludes(test) {
    test.expect(1);

    var includes = [
      'node_modules/**/aws-sdk/apis/*.json',
      'node_modules/**/mime/types/*.types',
      'node_modules/**/negotiator/**/*.js',
      'node_modules/**/socket.io-client/socket.io.js',
      'node_modules/**/socket.io-client/dist/socket.io.min.js',
      'node_modules/**/socket.io-client/dist/socket.io.js',
    ];

    test.deepEqual(lists.includes, includes);
    test.done();
  },

  checkIgnores(test) {
    test.expect(1);

    var ignores = [
      'node_modules/**/tessel/**/*',
    ];

    test.deepEqual(lists.ignores, ignores);
    test.done();
  },

  checkCompression(test) {
    test.expect(1);

    /*
      This test just ensures that no one accidentally
      messes up the contents of the deploy-lists file,
      specifically for the compression options field

     */
    var compressionOptions = {
      extend: {
        compress: {
          keep_fnames: true
        },
        mangle: {}
      },
    };

    test.deepEqual(lists.compressionOptions, compressionOptions);
    test.done();
  }

};


exports['deployment.js.postRun'] = {
  setUp(done) {
    this.info = sandbox.stub(log, 'info');

    this.originalProcessStdinProperties = {
      pipe: process.stdin.pipe,
      setRawMode: process.stdin.setRawMode,
    };

    this.stdinPipe = sandbox.spy();
    this.setRawMode = sandbox.spy();

    process.stdin.pipe = this.stdinPipe;
    process.stdin.setRawMode = this.setRawMode;

    this.notRealTessel = {
      connection: {
        connectionType: 'LAN',
      },
    };

    done();
  },

  tearDown(done) {

    process.stdin.pipe = this.originalProcessStdinProperties.pipe;
    process.stdin.setRawMode = this.originalProcessStdinProperties.setRawMode;

    sandbox.restore();
    done();
  },

  postRunLAN(test) {
    test.expect(2);

    deployment.js.postRun(this.notRealTessel, {
      remoteProcess: {
        stdin: null
      }
    }).then(() => {
      test.equal(process.stdin.pipe.callCount, 1);
      test.equal(process.stdin.setRawMode.callCount, 1);
      test.done();
    });
  },

  postRunUSB(test) {
    test.expect(2);

    this.notRealTessel.connection.connectionType = 'USB';
    deployment.js.postRun(this.notRealTessel, {
      remoteProcess: {
        stdin: null
      }
    }).then(() => {
      test.equal(process.stdin.pipe.callCount, 0);
      test.equal(process.stdin.setRawMode.callCount, 0);
      test.done();
    });
  },
};

exports['deployment.js.logMissingBinaryModuleWarning'] = {
  setUp(done) {
    this.warn = sandbox.stub(log, 'warn');
    this.details = {
      binName: 'compiled-binary.node',
      buildPath: path.normalize('/build/Release/node-v46-FAKE_PLATFORM-FAKE_ARCH/'),
      buildType: 'Release',
      globPath: path.normalize('node_modules/compiled-binary/build/Release/node-v46-FAKE_PLATFORM-FAKE_ARCH/compiled-binary.node'),
      ignored: false,
      name: 'compiled-binary',
      modulePath: path.normalize('node_modules/compiled-binary'),
      resolved: true,
      version: '2.0.6',
      extractPath: path.normalize('~/.tessel/binaries/compiled-binary-2.0.6-Release-node-v46-linux-mipsel')
    };
    done();
  },
  tearDown(done) {
    sandbox.restore();
    done();
  },

  callsThroughToLogWarn(test) {
    test.expect(1);
    deployment.js.logMissingBinaryModuleWarning(this.details);
    test.equal(this.warn.callCount, 1);
    test.done();
  },

  includesModuleNameAndVersion(test) {
    test.expect(1);

    deployment.js.logMissingBinaryModuleWarning(this.details);

    var output = this.warn.lastCall.args[0];

    test.equal(output.includes('Pre-compiled module is missing: compiled-binary@2.0.6'), true);
    test.done();
  },
};

exports['deployment.js.minimatch'] = {
  setUp(done) {
    done();
  },
  tearDown(done) {
    done();
  },

  callsThroughToMinimatch(test) {
    test.expect(1);
    const result = deployment.js.minimatch('', '', {});
    test.equal(result, true);
    test.done();
  },
};
