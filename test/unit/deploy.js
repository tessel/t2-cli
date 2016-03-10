process.on('uncaughtException', function(err) {
  console.error(err.stack);
});
// Test dependencies are required and exposed in common/bootstrap.js

var meminfo = fs.readFileSync('test/unit/fixtures/proc-meminfo', 'utf8');
var deployFolder = path.join(__dirname, 'tmp');
var deployFile = path.join(deployFolder, 'app.js');
var codeContents = 'console.log("testing deploy");';
var reference = new Buffer(codeContents);
var sandbox = sinon.sandbox.create();

exports['Tessel.prototype.memoryInfo'] = {
  setUp: function(done) {
    this.execRemoteCommand = sandbox.stub(deploy, 'execRemoteCommand', () => Promise.resolve(meminfo));

    this.logsWarn = sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = sandbox.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();

    // This is what the result of processing output from
    // `cat /proc/meminfo` must look like.
    this.expect = {
      MemTotal: 61488000,
      MemFree: 28660000,
      MemAvailable: 43112000,
      Buffers: 4224000,
      Cached: 11860000,
      SwapCached: 0,
      Active: 10936000,
      Inactive: 8244000,
      Active_anon: 3128000,
      Inactive_anon: 52000,
      Active_file: 7808000,
      Inactive_file: 8192000,
      Unevictable: 0,
      Mlocked: 0,
      SwapTotal: 0,
      SwapFree: 0,
      Dirty: 0,
      Writeback: 0,
      AnonPages: 3112000,
      Mapped: 5260000,
      Shmem: 84000,
      Slab: 7460000,
      SReclaimable: 1832000,
      SUnreclaim: 5628000,
      KernelStack: 352000,
      PageTables: 348000,
      NFS_Unstable: 0,
      Bounce: 0,
      WritebackTmp: 0,
      CommitLimit: 30744000,
      Committed_AS: 7072000,
      VmallocTotal: 1048372000,
      VmallocUsed: 1320000,
      VmallocChunk: 1040404000
    };

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    sandbox.restore();
    done();
  },

  meminfo: function(test) {
    test.expect(4);
    this.tessel.memoryInfo().then((memory) => {
      test.equal(this.execRemoteCommand.callCount, 1);
      test.equal(this.execRemoteCommand.lastCall.args[0], this.tessel);
      test.equal(this.execRemoteCommand.lastCall.args[1], 'getMemoryInfo');
      test.deepEqual(memory, this.expect);
      test.done();
    });
  },

  failureNoResponse: function(test) {
    test.expect(1);

    this.execRemoteCommand.restore();

    this.execRemoteCommand = sandbox.stub(deploy, 'execRemoteCommand', () => Promise.resolve());

    this.tessel.memoryInfo().catch((error) => {
      test.equal(error, 'Could not read device memory information.');
      test.done();
    });
  },

  failureEmptyResponse: function(test) {
    test.expect(1);

    this.execRemoteCommand.restore();

    this.execRemoteCommand = sandbox.stub(deploy, 'execRemoteCommand', () => Promise.resolve(''));

    this.tessel.memoryInfo().catch((error) => {
      test.equal(error, 'Could not read device memory information.');
      test.done();
    });
  },

};

exports['Tessel.prototype.deployScript'] = {
  setUp: function(done) {
    this.deployScript = sandbox.spy(Tessel.prototype, 'deployScript');
    this.stopRunningScript = sandbox.spy(commands, 'stopRunningScript');
    this.deleteFolder = sandbox.spy(commands, 'deleteFolder');
    this.createFolder = sandbox.spy(commands, 'createFolder');
    this.untarStdin = sandbox.spy(commands, 'untarStdin');
    this.runScript = sandbox.spy(commands, 'runScript');
    this.openStdinToFile = sandbox.spy(commands, 'openStdinToFile');
    this.setExecutablePermissions = sandbox.spy(commands, 'setExecutablePermissions');
    this.startPushedScript = sandbox.spy(commands, 'startPushedScript');

    this.pushScript = sandbox.spy(deploy, 'pushScript');
    this.writeToFile = sandbox.spy(deploy, 'writeToFile');

    this.injectBinaryModules = sandbox.stub(deploy, 'injectBinaryModules', () => Promise.resolve());

    this.resolveBinaryModules = sandbox.stub(deploy, 'resolveBinaryModules', () => Promise.resolve());
    this.tarBundle = sandbox.stub(deploy, 'tarBundle', function() {
      return new Promise(function(resolve) {
        resolve(reference);
      });
    });

    this.logsWarn = sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = sandbox.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();
    this.end = sandbox.spy(this.tessel._rps.stdin, 'end');

    deleteTemporaryDeployCode()
      .then(done);
  },

  tearDown: function(done) {
    this.tessel.mockClose();

    sandbox.restore();

    deleteTemporaryDeployCode()
      .then(done)
      .catch(function(err) {
        throw err;
      });
  },

  bundling: function(test) {
    test.expect(1);

    this.tarBundle.restore();

    createTemporaryDeployCode().then(() => {
      var tb = deploy.tarBundle({
        target: deployFolder
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

  runScript: function(test) {
    test.expect(10);
    this.exec = sandbox.spy(this.tessel.connection, 'exec');
    deployTestCode(this.tessel, test, {
      push: false,
      single: false
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }
      test.equal(this.stopRunningScript.callCount, 1);
      test.equal(this.deleteFolder.callCount, 1);
      test.equal(this.createFolder.callCount, 1);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.runScript.callCount, 1);
      test.equal(this.openStdinToFile.callCount, 0);
      test.equal(this.setExecutablePermissions.callCount, 0);
      test.equal(this.startPushedScript.callCount, 0);
      test.equal(this.end.callCount, 1);
      // Ensure that the last call (to run Node) sets pty to true
      test.equal(this.exec.lastCall.args[1].pty, true);
      test.done();
    });
  },

  runScriptSingle: function(test) {
    test.expect(9);
    deployTestCode(this.tessel, test, {
      push: false,
      single: true
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }
      test.equal(this.stopRunningScript.callCount, 1);
      test.equal(this.deleteFolder.callCount, 0);
      test.equal(this.createFolder.callCount, 1);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.runScript.callCount, 1);
      test.equal(this.openStdinToFile.callCount, 0);
      test.equal(this.setExecutablePermissions.callCount, 0);
      test.equal(this.startPushedScript.callCount, 0);
      test.equal(this.end.callCount, 1);
      test.done();
    });
  },

  pushScript: function(test) {
    test.expect(12);
    deployTestCode(this.tessel, test, {
      push: true,
      single: false
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }

      var expectedPath = path.normalize('test/unit/tmp/app.js');

      test.equal(this.pushScript.lastCall.args[1], expectedPath);
      test.equal(this.pushScript.lastCall.args[2].entryPoint, expectedPath);
      test.equal(this.writeToFile.lastCall.args[1], expectedPath);

      test.equal(this.stopRunningScript.callCount, 1);
      // Delete and create both the flash and ram folders
      test.equal(this.deleteFolder.callCount, 2);
      test.equal(this.createFolder.callCount, 2);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.runScript.callCount, 0);
      test.equal(this.openStdinToFile.callCount, 1);
      test.equal(this.setExecutablePermissions.callCount, 1);
      test.equal(this.startPushedScript.callCount, 1);
      test.equal(this.end.callCount, 1);
      test.done();
    });
  },

  pushScriptSingle: function(test) {
    test.expect(9);
    deployTestCode(this.tessel, test, {
      push: true,
      single: true
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }
      test.equal(this.stopRunningScript.callCount, 1);
      test.equal(this.deleteFolder.callCount, 0);
      test.equal(this.createFolder.callCount, 1);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.runScript.callCount, 0);
      test.equal(this.openStdinToFile.callCount, 1);
      test.equal(this.setExecutablePermissions.callCount, 1);
      test.equal(this.startPushedScript.callCount, 1);
      test.equal(this.end.callCount, 1);
      test.done();
    });
  },

  writeToFileDefaultEntryPoint: function(test) {
    test.expect(1);

    var shellScript = tags.stripIndent `
      #!/bin/sh
      exec node /app/remote-script/index.js
    `;
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end', (buffer) => {
      test.equal(buffer.toString(), shellScript);
      test.done();
    });

    this.exec = sandbox.stub(this.tessel.connection, 'exec', (command, callback) => {
      return callback(null, this.tessel._rps);
    });

    deploy.writeToFile(this.tessel, 'index.js');
  },

  writeToFileSendsCorrectEntryPoint: function(test) {
    test.expect(1);

    var shellScript = tags.stripIndent `
      #!/bin/sh
      exec node /app/remote-script/index.js
    `;
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end', (buffer) => {
      test.equal(buffer.toString(), shellScript);
      test.done();
    });

    this.exec = sandbox.stub(this.tessel.connection, 'exec', (command, callback) => {
      return callback(null, this.tessel._rps);
    });

    deploy.writeToFile(this.tessel, 'index.js');
  },

  processCompletionOrder: function(test) {
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
        this.tessel.deployScript({
            entryPoint: path.relative(process.cwd(), deployFile),
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

exports['deploy.compress'] = {
  setUp: function(done) {
    this.aparse = sandbox.spy(acorn, 'parse');
    this.uparse = sandbox.spy(uglify, 'parse');
    this.Compressor = sandbox.spy(uglify, 'Compressor');
    this.OutputStream = sandbox.spy(uglify, 'OutputStream');

    done();
  },
  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  acornParse: function(test) {
    test.expect(2);

    deploy.compress('let f = 1');

    test.equal(this.aparse.callCount, 1);
    test.equal(this.uparse.callCount, 0);

    test.done();
  },

  uglifyParseFallback: function(test) {
    test.expect(3);

    var result = deploy.compress('#$%^');

    // Assert that we tried both parsers
    test.equal(this.aparse.callCount, 1);
    test.equal(this.uparse.callCount, 1);

    // Assert that compress just gave back
    // the source as-is, even though the
    // parsers failed.
    test.equal(result, '#$%^');

    test.done();
  },

  ourAcornParseOptions: function(test) {
    test.expect(3);

    var ourExplicitSettings = {
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      ecmaVersion: 7,
    };

    var ourExplicitSettingsKeys = Object.keys(ourExplicitSettings);

    try {
      // Force the acorn parse step of the
      // compress operation to fail. This
      // will ensure that that the uglify
      // attempt is made.
      deploy.compress('#$%^');
    } catch (error) {
      // there is nothing we can about this.
    }

    var optionsSeen = this.aparse.lastCall.args[1];

    ourExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], ourExplicitSettings[key]);
    });

    test.done();
  },

  ourUglifyParseOptions: function(test) {
    test.expect(3);

    var ourExplicitSettings = {
      bare_returns: true,
      fromString: true,
      warnings: false,
    };

    var ourExplicitSettingsKeys = Object.keys(ourExplicitSettings);

    try {
      // Force the acorn parse step of the
      // compress operation to fail. This
      // will ensure that that the uglify
      // attempt is made.
      deploy.compress('#$%^');
    } catch (error) {
      // there is nothing we can about this.
    }

    var optionsSeen = this.uparse.lastCall.args[1];

    ourExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], ourExplicitSettings[key]);
    });

    test.done();
  },

  ourCompressorOptions: function(test) {
    test.expect(18);

    var ourExplicitSettings = {
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

    var ourExplicitSettingsKeys = Object.keys(ourExplicitSettings);

    deploy.compress('var a = 1;');

    var optionsSeen = this.Compressor.lastCall.args[0];

    ourExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], ourExplicitSettings[key]);
    });

    test.done();
  },

  theirCompressorOptions: function(test) {
    test.expect(18);

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
      screw_ie8: false,
      sequences: false,
      unsafe: false,
      // ------
      keep_fargs: true,
      keep_fnames: true,
      warnings: true,
      drop_console: true,
    };

    var theirExplicitSettingsKeys = Object.keys(theirExplicitSettings);

    deploy.compress('var a = 1;', {
      compress: theirExplicitSettings
    });

    var optionsSeen = this.Compressor.lastCall.args[0];

    theirExplicitSettingsKeys.forEach(key => {
      test.equal(optionsSeen[key], theirExplicitSettings[key]);
    });

    test.done();
  },
  minifyFromBuffer: function(test) {
    test.expect(1);
    test.equal(deploy.compress(new Buffer(codeContents)), codeContents);
    test.done();
  },

  minifyFromString: function(test) {
    test.expect(1);
    test.equal(deploy.compress(codeContents), codeContents);
    test.done();
  },

  minifyInternalOperations: function(test) {
    test.expect(3);

    deploy.compress(new Buffer(codeContents));

    test.equal(this.aparse.callCount, 1);
    test.equal(this.Compressor.callCount, 1);
    test.equal(this.OutputStream.callCount, 1);
    test.done();
  },

  minifyWithBareReturns: function(test) {
    test.expect(1);

    try {
      deploy.compress('return;');
      test.equal(this.aparse.lastCall.args[1].allowReturnOutsideFunction, true);
    } catch (e) {
      test.ok(false, e.message);
    }

    test.done();
  },

  avoidCompleteFailure: function(test) {
    test.expect(2);

    this.uparse.restore();
    this.uparse = sandbox.stub(uglify, 'parse', () => {
      return {
        figure_out_scope: () => {
          throw new TypeError();
        }
      };
    });
    var result = '';
    try {
      result = deploy.compress('return;');
      test.equal(this.aparse.lastCall.args[1].allowReturnOutsideFunction, true);
    } catch (e) {
      test.ok(false, e.message);
    }

    test.equal(result, 'return;');

    test.done();
  },
};

exports['deploy.tarBundle'] = {
  setUp: function(done) {
    this.copySync = sandbox.spy(fs, 'copySync');
    this.outputFileSync = sandbox.spy(fs, 'outputFileSync');
    this.writeFileSync = sandbox.spy(fs, 'writeFileSync');
    this.remove = sandbox.spy(fs, 'remove');

    this.globSync = sandbox.spy(deploy.glob, 'sync');
    this.exclude = sandbox.spy(Project.prototype, 'exclude');
    this.mkdirSync = sandbox.spy(fsTemp, 'mkdirSync');
    this.addIgnoreRules = sandbox.spy(Ignore.prototype, 'addIgnoreRules');

    this.project = sandbox.spy(deploy, 'project');
    this.compress = sandbox.spy(deploy, 'compress');

    this.logsWarn = sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = sandbox.stub(logs, 'info', function() {});

    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  actionsGlobRules: function(test) {
    test.expect(1);

    var target = 'test/unit/fixtures/ignore';
    var rules = deploy.glob.rules(target, '.tesselignore');

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

  actionsGlobFiles: function(test) {
    test.expect(1);

    var target = 'test/unit/fixtures/ignore';
    var rules = deploy.glob.rules(target, '.tesselignore');
    var files = deploy.glob.files(target, rules);

    test.deepEqual(files, ['mock-foo.js']);
    test.done();
  },

  actionsGlobFilesNested: function(test) {
    test.expect(1);

    var target = 'test/unit/fixtures/ignore';
    var files = deploy.glob.files(target, ['**/.tesselignore']);

    test.deepEqual(files, [
      '.tesselignore',
      'nested/.tesselignore'
    ]);

    test.done();
  },

  actionsGlobFilesNonNested: function(test) {
    test.expect(1);

    var target = 'test/unit/fixtures/ignore';
    var files = deploy.glob.files(target, ['.tesselignore']);

    test.deepEqual(files, ['.tesselignore']);
    test.done();
  },

  full: function(test) {
    test.expect(8);

    var target = 'test/unit/fixtures/project';

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

    deploy.tarBundle({
      target: path.normalize(target),
      full: true,
    }).then(bundle => {

      // One call for .tesselinclude
      // One call for the single rule found within
      // Three calls for the deploy lists
      // * 2 (We need all ignore rules ahead of time for ignoring binaries)
      test.equal(this.globSync.callCount, 8);

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

  slim: function(test) {
    test.expect(9);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/project';

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

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
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

      var minified = this.compress.lastCall.returnValue;
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

  compressionProducesNoErrors: function(test) {
    test.expect(1);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/syntax-error';

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
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

  slimTesselInit: function(test) {
    test.expect(5);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/init';

    /*
      init
      ├── index.js
      └── package.json

      0 directories, 2 files
     */

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slim: true,
    }).then(bundle => {
      test.equal(this.project.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.mkdirSync.callCount, 1);

      var minified = this.compress.lastCall.returnValue;

      test.equal(minified, 'var e=require("tessel");e.led[2].on(),setInterval(function(){e.led[2].toggle(),e.led[3].toggle()},100);');

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

  slimSingle: function(test) {
    test.expect(4);

    var target = 'test/unit/fixtures/project';
    var entryPoint = 'index.js';

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
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

  slimSingleNested: function(test) {
    test.expect(4);

    var target = 'test/unit/fixtures/project';
    var entryPoint = 'another.js';

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
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

  fullSingle: function(test) {
    test.expect(3);

    var target = 'test/unit/fixtures/project';
    var entryPoint = 'index.js';

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
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

  fullSingleNested: function(test) {
    test.expect(2);

    var target = 'test/unit/fixtures/project';
    var entryPoint = 'another.js';

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
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

  slimIncludeOverridesIgnore: function(test) {
    test.expect(9);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/project-include-overrides-ignore';

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

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slim: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 11);

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

  fullIncludeOverridesIgnore: function(test) {
    test.expect(8);

    var target = 'test/unit/fixtures/project-include-overrides-ignore';

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

    deploy.tarBundle({
      target: path.normalize(target),
      full: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 11);

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

  slimIncludeWithoutIgnore: function(test) {
    test.expect(9);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/project-include-without-ignore';

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

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slim: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 8);

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

  fullIncludeWithoutIgnore: function(test) {
    test.expect(8);

    /*
      !! TAKE NOTE!!

      This is actually the default behavior. That is to say:
      these files would be included, whether they are listed
      in the .tesselinclude file or not.
    */

    var target = 'test/unit/fixtures/project-include-without-ignore';

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

    deploy.tarBundle({
      target: path.normalize(target),
      full: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 8);

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

  slimIncludeHasNegateRules: function(test) {
    test.expect(8);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/project-include-has-negate-rules';

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
    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slim: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 9);

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

  fullIncludeHasNegateRules: function(test) {
    test.expect(8);

    var target = 'test/unit/fixtures/project-include-has-negate-rules';

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

    deploy.tarBundle({
      target: path.normalize(target),
      full: true,
    }).then(bundle => {
      test.equal(this.globSync.callCount, 9);

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
};

exports['Tessel.prototype.restartScript'] = {
  setUp: function(done) {
    this.runScript = sandbox.stub(deploy, 'runScript', () => Promise.resolve());
    this.startPushedScript = sandbox.stub(deploy, 'startPushedScript', () => Promise.resolve());
    this.findProject = sandbox.stub(deploy, 'findProject', (entryPoint) => Promise.resolve({
      entryPoint
    }));

    this.logsWarn = sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = sandbox.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();

    sandbox.restore();

    done();
  },

  restartFromRam: function(test) {
    test.expect(3);
    var opts = {
      type: 'ram',
      entryPoint: 'index.js',
    };

    this.tessel.restartScript(opts)
      .then(() => {
        test.equal(this.runScript.callCount, 1);
        test.equal(this.runScript.lastCall.args[1], '/tmp/remote-script/');
        test.deepEqual(this.runScript.lastCall.args[2], {
          type: 'ram',
          entryPoint: 'index.js'
        });
        test.done();
      });

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  restartFromFlash: function(test) {
    test.expect(3);
    var opts = {
      type: 'flash',
      entryPoint: 'index.js',
    };

    this.tessel.restartScript(opts)
      .then(() => {
        test.equal(this.startPushedScript.callCount, 1);
        test.equal(this.startPushedScript.lastCall.args[1], 'index.js');
        test.deepEqual(this.startPushedScript.lastCall.args[2], {
          type: 'flash',
          entryPoint: 'index.js'
        });
        test.done();
      });

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  restartNonExistent: function(test) {
    test.expect(1);
    var opts = {
      type: 'flash',
      entryPoint: 'index.js',
    };

    this.tessel.restartScript(opts)
      .catch(error => {
        test.equal(error, '"index.js" not found on undefined');
        test.done();
      });

    setImmediate(() => {
      this.tessel._rps.stderr.emit('data', new Buffer('No such file or directory'));
      this.tessel._rps.emit('close');
    });
  },
};

var fixtures = {
  project: path.join(__dirname, 'fixtures/find-project'),
  explicit: path.join(__dirname, 'fixtures/find-project-explicit-main')
};

exports['deploy.findProject'] = {
  setUp: function(done) {
    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  home: function(test) {
    test.expect(1);

    var key = process.platform === 'win32' ? 'USERPROFILE' : 'HOME';
    var real = process.env[key];
    var fake = path.normalize('/fake/test/home/dir');

    process.env[key] = fake;

    this.lstatSync = sandbox.stub(fs, 'lstatSync', (file) => {
      return {
        isDirectory: () => {
          // naive for testing.
          return file.slice(-1) === '/';
        }
      };
    });

    this.realpathSync = sandbox.stub(fs, 'realpathSync', (arg) => {
      process.env[key] = real;

      // Ensure that "~" was transformed
      test.equal(arg, path.normalize('/fake/test/home/dir/foo'));
      test.done();
    });

    deploy.findProject({
      entryPoint: '~/foo/'
    });
  },

  byFile: function(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project/index.js';

    deploy.findProject({
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

  byDirectory: function(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project/';

    deploy.findProject({
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

  byDirectoryBWExplicitMain: function(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project-explicit-main/';

    deploy.findProject({
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

  byDirectoryMissingIndex: function(test) {
    test.expect(1);

    var target = 'test/unit/fixtures/find-project-no-index/index.js';

    deploy.findProject({
      entryPoint: target
    }).then(() => {
      test.ok(false, 'findProject should not find a valid project here');
      test.done();
    }).catch(error => {
      test.ok(error.includes('ENOENT'));
      test.done();
    });
  },

  byFileInSubDirectory: function(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project/test/index.js';

    deploy.findProject({
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

  noPackageJsonSingle: function(test) {
    test.expect(1);

    var pushdir = path.normalize('test/unit/fixtures/project-no-package.json/');
    var entryPoint = path.normalize('test/unit/fixtures/project-no-package.json/index.js');

    var opts = {
      entryPoint: entryPoint,
      single: true,
      slim: true,
    };

    deploy.findProject(opts).then(project => {
      // Without the `single` flag, this would've continued upward
      // until it found a directory with a package.json.
      test.ok(project.pushdir, fs.realpathSync(path.dirname(pushdir)));
      test.done();
    });
  },

};


exports['deploy.sendBundle, error handling'] = {
  setUp: function(done) {
    this.tessel = TesselSimulator();
    this.pathResolve = sandbox.stub(path, 'resolve');
    this.failure = 'FAIL';
    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  findProject: function(test) {
    test.expect(1);

    this.findProject = sandbox.stub(deploy, 'findProject', () => Promise.reject(this.failure));

    deploy.sendBundle(this.tessel, {}).catch(error => {
      test.equal(error, this.failure);
      test.done();
    });
  },

  resolveBinaryModules: function(test) {
    test.expect(1);

    this.findProject = sandbox.stub(deploy, 'findProject', () => Promise.resolve({
      pushdir: '',
      entryPoint: ''
    }));

    this.resolveBinaryModules = sandbox.stub(deploy, 'resolveBinaryModules', () => Promise.reject(this.failure));

    deploy.sendBundle(this.tessel, {}).catch(error => {
      test.equal(error, this.failure);
      test.done();
    });
  },

  tarBundle: function(test) {
    test.expect(1);

    this.findProject = sandbox.stub(deploy, 'findProject', () => Promise.resolve({
      pushdir: '',
      entryPoint: ''
    }));

    this.resolveBinaryModules = sandbox.stub(deploy, 'resolveBinaryModules', () => Promise.resolve());

    this.tarBundle = sandbox.stub(deploy, 'tarBundle', () => Promise.reject(this.failure));

    deploy.sendBundle(this.tessel, {}).catch(error => {
      test.equal(error, this.failure);
      test.done();
    });
  },
};

function Request() {}
util.inherits(Request, stream.Stream);

exports['deploy.resolveBinaryModules'] = {
  setUp: function(done) {

    this.target = path.normalize('test/unit/fixtures/project-binary-modules');
    this.relative = sandbox.stub(path, 'relative', () => {
      return path.join(__dirname, '/../../test/unit/fixtures/project-binary-modules/');
    });
    this.globFiles = sandbox.spy(deploy.glob, 'files');
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
      ];
    });

    this.readGypFileSync = sandbox.stub(deploy.resolveBinaryModules, 'readGypFileSync', () => {
      return '{"targets": [{"target_name": "missing"}]}';
    });

    this.getRoot = sandbox.stub(bindings, 'getRoot', (file) => {
      var pattern = /(?:node_modules)\/(\w.+)\/(?:build|binding\.)/;
      var results = pattern.exec(file);
      return path.normalize('node_modules/' + results[1] + '/');
    });

    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  bailOnSkipBinary: function(test) {
    test.expect(2);

    this.target = path.normalize('test/unit/fixtures/project-skip-binary');

    this.relative.restore();
    this.relative = sandbox.stub(path, 'relative', () => {
      return path.join(__dirname, '/../../test/unit/fixtures/project-skip-binary/');
    });

    // We WANT to read the actual gyp files if necessary
    this.readGypFileSync.restore();

    // We WANT to glob the actual target directory
    this.globSync.restore();

    this.exists = sandbox.stub(fs, 'existsSync', () => true);

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {

      test.equal(this.exists.callCount, 1);
      // test/unit/fixtures/skip-binary/ has the corresponding
      // dependencies for the following binary modules:
      //
      //    debug-1.1.1-Debug
      //    release-1.1.1-Release
      //
      // However, the latter has a "tessel.skipBinary = true" key in its package.json
      //
      //
      test.equal(this.exists.lastCall.args[0].endsWith(path.normalize('.tessel/binaries/debug-1.1.1-Debug')), true);

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  findsModulesMissingBinaryNodeFiles: function(test) {
    test.expect(2);


    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/release/binding.gyp'),
        path.normalize('node_modules/missing/binding.gyp'),
      ];
    });

    this.exists = sandbox.stub(fs, 'existsSync', () => true);

    deploy.resolveBinaryModules({
      target: this.target
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

  spawnPythonScript: function(test) {
    test.expect(7);

    this.readGypFileSync.restore();
    this.readGypFileSync = sandbox.spy(deploy.resolveBinaryModules, 'readGypFileSync');

    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/release/binding.gyp'),
        path.normalize('node_modules/missing/binding.gyp'),
      ];
    });

    this.exists = sandbox.stub(fs, 'existsSync', () => true);
    this.spawnSync = sandbox.stub(cp, 'spawnSync', () => {
      return {
        output: [
          null, new Buffer('{"targets": [{"target_name": "missing","sources": ["capture.c", "missing.cc"]}]}', 'utf8')
        ]
      };
    });

    deploy.resolveBinaryModules({
      target: this.target
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

  failsWithMessage: function(test) {
    test.expect(1);

    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
      return [
        path.normalize('node_modules/missing/binding.gyp'),
      ];
    });
    this.readGypFileSync.restore();
    this.readGypFileSync = sandbox.stub(deploy.resolveBinaryModules, 'readGypFileSync', () => {
      return '{"targets": [{"target_name": "missing",}]}';
      //                                               ^
      //                                       That's intentional.
    });

    this.exists = sandbox.stub(fs, 'existsSync', () => true);

    deploy.resolveBinaryModules({
      target: this.target
    }).then(binaryModulesUsed => {
      test.equal(binaryModulesUsed.get('missing').resolved, false);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  existsInLocalCache: function(test) {
    test.expect(2);

    this.exists = sandbox.stub(fs, 'existsSync', () => true);

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {
      test.equal(this.globFiles.callCount, 1);
      test.equal(this.exists.callCount, 1);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  existsInLocalCacheNodeGypLinkedBinPath: function(test) {
    test.expect(1);

    this.readGypFileSync.restore();

    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
        path.normalize('node_modules/linked/build/bindings/linked.node'),
      ];
    });

    this.exists = sandbox.stub(fs, 'existsSync', () => true);

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {

      test.equal(this.exists.callCount, 2);


      // console.log(this.exists);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  resolveFromRealDirFixtures: function(test) {
    test.expect(5);

    // We WANT to read the actual gyp files if necessary
    this.readGypFileSync.restore();
    // We WANT to glob the actual target directory
    this.globSync.restore();

    // To avoid making an actual network request,
    // make the program think these things are already
    // cached. The test to pass is that it calls fs.existsSync
    // with the correct things from the project directory (this.target)
    this.exists = sandbox.stub(fs, 'existsSync', () => true);

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {

      test.equal(this.exists.callCount, 4);

      // test/unit/fixtures/project-binary-modules/ has the corresponding
      // dependencies for the following binary modules:
      var cachedBinaryPaths = [
        '.tessel/binaries/debug-1.1.1-Debug',
        '.tessel/binaries/linked-1.1.1-Release',
        '.tessel/binaries/release-1.1.1-Release',
        '.tessel/binaries/missing-1.1.1-Release',
      ];

      cachedBinaryPaths.forEach((cbp, callIndex) => {
        test.equal(this.exists.getCall(callIndex).args[0].endsWith(path.normalize(cbp)), true);
      });

      // console.log(this.exists);
      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },

  requestsRemote: function(test) {
    test.expect(10);

    this.exists = sandbox.stub(fs, 'existsSync', () => false);
    this.mkdirp = sandbox.spy(fs, 'mkdirp');
    this.pipe = sandbox.spy(stream.Stream.prototype, 'pipe');

    this.createGunzip = sandbox.spy(zlib, 'createGunzip');
    this.Extract = sandbox.spy(tar, 'Extract');
    this.request = sandbox.stub(request, 'Request', (opts) => {
      var stream = new Request(opts);

      process.nextTick(() => stream.emit('end'));
      return stream;
    });

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {
      test.equal(this.globFiles.callCount, 1);
      test.equal(this.exists.callCount, 1);
      test.equal(this.mkdirp.callCount, 1);
      test.equal(this.mkdirp.lastCall.args[0].endsWith(path.normalize('.tessel/binaries/release-1.1.1-Release')), true);

      test.equal(this.request.callCount, 1);

      var requestArgs = this.request.lastCall.args[0];
      test.equal(requestArgs.url, 'http://packages.tessel.io/npm/release-1.1.1-Release.tgz');
      test.equal(requestArgs.gzip, true);

      test.equal(this.pipe.callCount, 2);
      test.equal(this.createGunzip.callCount, 1);
      test.equal(this.Extract.callCount, 1);

      test.done();
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  },
};

exports['deploy.injectBinaryModules'] = {
  setUp: function(done) {
    this.target = path.normalize('test/unit/fixtures/project-binary-modules');
    this.relative = sandbox.stub(path, 'relative', () => {
      return path.join(__dirname, '/../../test/unit/fixtures/project-binary-modules/');
    });
    this.globFiles = sandbox.spy(deploy.glob, 'files');
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
      ];
    });

    this.getRoot = sandbox.stub(bindings, 'getRoot', (file) => {
      var pattern = /(?:node_modules)\/(\w.+)\/(?:build|binding\.)/;
      var results = pattern.exec(file);
      return path.normalize('node_modules/' + results[1] + '/');
    });

    this.globRoot = path.join(__dirname, '/../../test/unit/fixtures/project-binary-modules/');
    this.copySync = sandbox.stub(fs, 'copySync');
    this.exists = sandbox.stub(fs, 'existsSync', () => true);
    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  copies: function(test) {
    test.expect(17);


    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
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

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {
      deploy.injectBinaryModules(this.globRoot, fsTemp.mkdirSync()).then(() => {
        test.equal(this.copySync.callCount, 8);

        var args = this.copySync.args;
        /*

        This is an abbreviated view of what should be copied by this operation:
        [
          [
            'debug-1.1.1-Release/Debug/debug.node',
            'debug/build/Debug/debug.node'
          ],
          [
            'debug/package.json',
            'debug/package.json'
          ],
          [
            'linked-1.1.1-Release/bindings/linked.node',
            'linked/build/bindings/linked.node'
          ],
          [
            'linked/package.json',
            'linked/package.json'
          ],
          [
            'missing-1.1.1-Release/Release/missing.node',
            'missing/build/Release/missing.node'
          ],
          [
            'missing/package.json',
            'missing/package.json'
          ],
          [
            'release-1.1.1-Release/Release/release.node',
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
          args[0][0].endsWith(path.normalize('debug-1.1.1-Debug/Debug/debug.node')),
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
          args[2][0].endsWith(path.normalize('linked-1.1.1-Release/bindings/linked.node')),
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
          args[4][0].endsWith(path.normalize('missing-1.1.1-Release/Release/missing.node')),
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
          args[6][0].endsWith(path.normalize('release-1.1.1-Release/Release/release.node')),
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

  doesNotCopyIgnoredBinaries: function(test) {
    test.expect(1);
    this.target = path.normalize('test/unit/fixtures/project-ignore-binary');
    this.relative.restore();
    this.relative = sandbox.stub(path, 'relative', () => {
      return path.join(__dirname, '/../../test/unit/fixtures/project-ignore-binary/');
    });

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {
      deploy.injectBinaryModules(this.globRoot, fsTemp.mkdirSync()).then(() => {
        // Nothing gets copied!
        test.equal(this.copySync.callCount, 0);
        test.done();
      });
    });
  },

  throwError: function(test) {
    test.expect(1);

    var errorMessage = 'Test Error';
    this.copySync.onCall(0).throws(errorMessage);

    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', () => {
      return [
        path.normalize('node_modules/release/build/Release/release.node'),
      ];
    });

    deploy.resolveBinaryModules({
      target: this.target
    }).then(() => {
      deploy.injectBinaryModules(this.globRoot, fsTemp.mkdirSync()).then(() => {
        test.fail('Should not pass');
        test.done();
      }).catch(error => {
        test.equal(error, errorMessage);
        test.done();
      });
    }).catch(error => {
      test.ok(false, error.toString());
      test.done();
    });
  }
};


function deployTestCode(tessel, test, opts, callback) {
  // Create the temporary folder with example code
  createTemporaryDeployCode()
    .then(function deploy() {

      function closeAdvance(event) {
        if (event === 'close') {
          setImmediate(function() {
            // Emit the close event to keep it going
            tessel._rps.emit('close');
          });
        }
      }

      // When we get a listener that the Tessel process needs to close before advancing
      tessel._rps.on('newListener', closeAdvance);

      // Actually deploy the script
      tessel.deployScript({
          entryPoint: path.relative(process.cwd(), deployFile),
          push: opts.push,
          single: opts.single
        })
        // If it finishes, it was successful
        .then(function success() {
          tessel._rps.removeListener('newListener', closeAdvance);
          callback();
        })
        // If not, there was an issue
        .catch(callback);
    });
}

function createTemporaryDeployCode() {
  return new Promise(function(resolve, reject) {
    mkdirp(deployFolder, function(err) {
      if (err) {
        return reject(err);
      } else {
        fs.writeFile(deployFile, codeContents, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  });
}

function deleteTemporaryDeployCode() {
  return new Promise(function(resolve, reject) {
    fs.remove(deployFolder, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


function extract(bundle, callback) {
  var parser = tar.Parse();
  var entries = [];

  parser.on('entry', (entry) => {
    if (entry.type === 'File') {
      entries.push(entry.path);
    }
  });

  parser.on('end', () => {
    callback(null, entries);
  });

  parser.on('error', (error) => {
    callback(error, null);
  });

  parser.end(bundle);
}
