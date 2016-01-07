// Test dependencies are required and exposed in common/bootstrap.js

var meminfo = fs.readFileSync('test/unit/fixtures/proc-meminfo', 'utf8');
var deployFolder = path.join(__dirname, 'tmp');
var deployFile = path.join(deployFolder, 'app.js');
var codeContents = 'console.log("testing deploy");';
var reference = new Buffer(codeContents);
var sandbox = sinon.sandbox.create();

exports['Tessel.prototype.memoryInfo'] = {
  setUp: function(done) {
    this.execRemoteCommand = sandbox.stub(deploy, 'execRemoteCommand', function() {
      return new Promise(function(resolve) {
        resolve(meminfo);
      });
    });

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
    this.tessel.memoryInfo().then(function(memory) {
      test.equal(this.execRemoteCommand.callCount, 1);
      test.equal(this.execRemoteCommand.lastCall.args[0], this.tessel);
      test.equal(this.execRemoteCommand.lastCall.args[1], 'getMemoryInfo');
      test.deepEqual(memory, this.expect);
      test.done();
    }.bind(this));
  },

  failureNoResponse: function(test) {
    test.expect(1);

    this.execRemoteCommand.restore();

    this.execRemoteCommand = sandbox.stub(deploy, 'execRemoteCommand', function() {
      return new Promise(function(resolve) {
        resolve();
      });
    });

    this.tessel.memoryInfo().catch(function(error) {
      test.equal(error, 'Could not read device memory information.');
      test.done();
    }.bind(this));
  },

  failureEmptyResponse: function(test) {
    test.expect(1);

    this.execRemoteCommand.restore();

    this.execRemoteCommand = sandbox.stub(deploy, 'execRemoteCommand', function() {
      return new Promise(function(resolve) {
        resolve('');
      });
    });

    this.tessel.memoryInfo().catch(function(error) {
      test.equal(error, 'Could not read device memory information.');
      test.done();
    }.bind(this));
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

    createTemporaryDeployCode().then(function() {
      deploy.tarBundle({
        target: deployFolder
      }).then(function(bundle) {
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
        deleteTemporaryDeployCode().then(function() {
          test.done();
        });
      });
    });
  },

  runScript: function(test) {
    test.expect(11);
    this.exec = sandbox.spy(this.tessel.connection, 'exec');
    deployTestCode(this.tessel, test, {
      push: false,
      single: false
    }, function deployed(err) {
      test.ifError(err);
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
    }.bind(this));
  },

  runScriptSingle: function(test) {
    test.expect(10);
    deployTestCode(this.tessel, test, {
      push: false,
      single: true
    }, function deployed(err) {
      test.ifError(err);
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
    }.bind(this));
  },

  pushScript: function(test) {
    test.expect(10);
    deployTestCode(this.tessel, test, {
      push: true,
      single: false
    }, function deployed(err) {
      test.ifError(err);
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
    }.bind(this));
  },

  pushScriptSingle: function(test) {
    test.expect(10);
    deployTestCode(this.tessel, test, {
      push: true,
      single: true
    }, function deployed(err) {
      test.ifError(err);
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
    }.bind(this));
  },

  writeToFileDefaultEntryPoint: function(test) {
    test.expect(1);

    var shellScript = tags.stripIndent `
      #!/bin/sh
      cd /app/remote-script
      exec node index.js
    `;
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end', function(buffer) {
      test.equal(buffer.toString(), shellScript);
      test.done();
    }.bind(this));

    this.exec = sandbox.stub(this.tessel.connection, 'exec', function() {
      return Promise.resolve(this.tessel._rps);
    }.bind(this));

    deploy.writeToFile(this.tessel, 'index.js');
  },


  writeToFileSendsCorrectEntryPoint: function(test) {
    test.expect(1);

    var shellScript = tags.stripIndent `
      #!/bin/sh
      cd /app/remote-script
      exec node __tessel_program__.js
    `;
    this.end.restore();
    this.end = sandbox.stub(this.tessel._rps.stdin, 'end', function(buffer) {
      test.equal(buffer.toString(), shellScript);
      test.done();
    }.bind(this));

    this.exec = sandbox.stub(this.tessel.connection, 'exec', function() {
      return Promise.resolve(this.tessel._rps);
    }.bind(this));

    deploy.writeToFile(this.tessel, '__tessel_program__.js');
  },

  processCompletionOrder: function(test) {

    var self = this;

    // Array of processes we've started but haven't completed yet
    var processesAwaitingCompletion = [];
    self.tessel._rps.on('control', function(data) {
      // Push new commands into the queue
      processesAwaitingCompletion.push(data);
    });

    // Create the temporary folder with example code
    createTemporaryDeployCode()
      .then(function deploy() {

        function closeAdvance(event) {
          // If we get an event listener for the close event of a process
          if (event === 'close') {
            // Wait some time before actually closing it
            setTimeout(function() {
              // We should only have one process waiting for completion
              test.equal(processesAwaitingCompletion.length, 1);
              // Pop that process off
              processesAwaitingCompletion.shift();
              // Emit the close event to keep it going
              self.tessel._rps.emit('close');
            }, 200);
          }
        }

        // When we get a listener that the Tessel process needs to close before advancing
        self.tessel._rps.on('newListener', closeAdvance);

        // Actually deploy the script
        self.tessel.deployScript({
            entryPoint: path.relative(process.cwd(), deployFile),
            push: false,
            single: false
          })
          // If it finishes, it was successful
          .then(function success() {
            self.tessel._rps.removeListener('newListener', closeAdvance);
            test.done();
          })
          // If not, there was an issue
          .catch(function(err) {
            test.equal(err, undefined, 'We hit a catch statement that we should not have.');
          });
      });
  }
};

exports['deploy.tarBundle'] = {
  setUp: function(done) {
    this.copySync = sandbox.spy(fs, 'copySync');
    this.writeFileSync = sandbox.spy(fs, 'writeFileSync');
    this.remove = sandbox.spy(fs, 'remove');

    this.globSync = sandbox.spy(deploy.glob, 'sync');
    this.exclude = sandbox.spy(browserify.prototype, 'exclude');
    this.mkdirSync = sandbox.spy(fsTemp, 'mkdirSync');
    this.addIgnoreRules = sandbox.spy(Ignore.prototype, 'addIgnoreRules');
    this.minify = sandbox.spy(uglify, 'minify');

    this.browserify = sandbox.spy(deploy, 'browserify');
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
    test.expect(9);

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
    }).then(function(bundle) {
      // One call for .tesselinclude
      // One call for the single rule found within
      test.equal(this.globSync.callCount, 1);

      // addIgnoreRules might be called many times, but we only
      // care about tracking the call that's explicitly made by
      // tessel's deploy operation
      test.deepEqual(this.addIgnoreRules.getCall(0).args[0], [
        '**/.tesselignore',
        '**/.tesselinclude',
      ]);

      // These things don't happen in the --full path
      test.equal(this.browserify.callCount, 0);
      test.equal(this.exclude.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.minify.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        test.deepEqual(entries, [
          'index.js',
          'nested/another.js',
          'node_modules/foo/index.js',
          'package.json',
        ]);

        test.done();
      });
    }.bind(this));
  },

  slim: function(test) {
    test.expect(11);

    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';
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
      slimPath: slimPath,
      slim: true,
    }).then(function(bundle) {
      // These things happen in the --slim path
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.mkdirSync.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      // End

      /*
        $ find . -type f -name .tesselignore -exec cat {} \+
        mock-foo.js
        other.js
        package.json
      */

      test.equal(this.exclude.callCount, 3);

      var minified = this.compress.lastCall.returnValue;
      test.equal(this.compress.callCount, 1);
      test.equal(Buffer.isBuffer(this.compress.lastCall.args[0]), true);
      test.equal(minified.indexOf('!!mock-foo!!') === -1, true);

      // Cannot deepEqual because uglify.minify(..., options) will
      // mutate the options reference. No need to keep track of that.
      test.equal(this.minify.lastCall.args[1].fromString, true);

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        test.deepEqual(entries, ['__tessel_program__.js']);
        test.done();
      });

    }.bind(this));
  },

  slimSyntaxErrorRejects: function(test) {
    test.expect(1);

    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';
    var target = 'test/unit/fixtures/syntax-error';

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slimPath: slimPath,
      slim: true,
    }).then(function() {
      test.fail();
      test.done();
    }).catch(function(error) {
      test.ok(error.message.indexOf('Unexpected token') !== -1);
      test.done();
    }.bind(this));
  },

  slimTesselInit: function(test) {
    test.expect(8);

    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';
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
      slimPath: slimPath,
      slim: true,
    }).then(function(bundle) {
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.mkdirSync.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      test.equal(this.exclude.callCount, 0);

      var minified = this.compress.lastCall.returnValue;

      test.equal(minified, 'var tessel=require("tessel");tessel.led[2].on(),setInterval(function(){tessel.led[2].toggle(),tessel.led[3].toggle()},100);');

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        test.deepEqual(entries, ['__tessel_program__.js']);
        test.done();
      });
    }.bind(this));
  },

  slimSingle: function(test) {
    test.expect(6);

    var target = 'test/unit/fixtures/project';
    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      resolvedEntryPoint: entryPoint,
      single: true,
      slim: true,
      slimPath: slimPath,
    }).then(function(bundle) {
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);

      test.equal(bundle.length, 2048);
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        test.deepEqual(entries, ['__tessel_program__.js']);
        test.done();
      });
    }.bind(this));
  },

  slimSingleNested: function(test) {
    test.expect(6);

    var target = 'test/unit/fixtures/project';
    var entryPoint = 'another.js';
    var slimPath = '__tessel_program__.js';

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      resolvedEntryPoint: path.join('nested', entryPoint),
      single: true,
      slim: true,
      slimPath: slimPath,

    }).then(function(bundle) {
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      test.equal(bundle.length, 2048);

      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        test.deepEqual(entries, ['__tessel_program__.js']);
        test.done();
      });
    }.bind(this));
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
    }).then(function(bundle) {

      test.equal(this.addIgnoreRules.callCount, 3);
      test.equal(bundle.length, 2048);

      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }
        test.deepEqual(entries, ['index.js']);
        test.done();
      });
    }.bind(this));
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
    }).then(function(bundle) {
      test.equal(bundle.length, 2560);
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }
        test.deepEqual(entries, ['nested/another.js']);
        test.done();
      });

    }.bind(this));
  },

  slimIncludeOverridesIgnore: function(test) {
    test.expect(9);

    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';
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
      slimPath: slimPath,
      slim: true,
    }).then(function(bundle) {
      test.equal(this.globSync.callCount, 8);

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

      test.equal(this.copySync.callCount, 3);

      // There are 3 files that must be included in the temp
      // project directory. These file names MUST match the
      // names that are expected to be copied.
      test.equal(this.exclude.callCount, 0);


      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      test.equal(this.remove.callCount, 1);

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        // Since the .tesselignore rules are ALL negated by .tesselinclude rules,
        // the additional files are copied into the temporary bundle dir, and
        // then included in the tarred bundle.
        test.deepEqual(entries, [
          '__tessel_program__.js',
          // from ./.tesselinclude
          'mock-foo.js',
          // from ./node_modules/foo/.tesselinclude
          'node_modules/foo/package.json',
          // from ./.tesselinclude
          'other.js'
        ]);

        test.done();
      });
    }.bind(this));
  },

  fullIncludeOverridesIgnore: function(test) {
    test.expect(9);

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
    }).then(function(bundle) {
      test.equal(this.globSync.callCount, 4);

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
      test.equal(this.browserify.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.minify.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
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
    }.bind(this));
  },

  slimIncludeWithoutIgnore: function(test) {
    test.expect(9);

    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';
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
      slimPath: slimPath,
      slim: true,
    }).then(function(bundle) {
      test.equal(this.globSync.callCount, 5);

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

      // There are 3 files that must be included in the temp
      // project directory. These file names MUST match the
      // names that are expected to be copied.
      test.equal(this.copySync.callCount, 3);

      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      test.equal(this.remove.callCount, 1);

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        // There are no .tesselignore rules, all .tesselinclude rules are
        // respected the additional files are copied into the temporary
        // bundle dir, and then included in the tarred bundle.
        test.deepEqual(entries, [
          '__tessel_program__.js',
          // from ./.tesselinclude
          'mock-foo.js',
          // from ./node_modules/foo/.tesselinclude
          'node_modules/foo/package.json',
          // from ./.tesselinclude
          'other.js'
        ]);

        test.done();
      });
    }.bind(this));
  },

  fullIncludeWithoutIgnore: function(test) {
    test.expect(9);

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
    }).then(function(bundle) {
      test.equal(this.globSync.callCount, 4);

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
      test.equal(this.browserify.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.minify.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
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
    }.bind(this));
  },

  slimIncludeHasNegateRules: function(test) {
    test.expect(9);

    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';
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
      slimPath: slimPath,
      slim: true,
    }).then(function(bundle) {
      test.equal(this.globSync.callCount, 6);

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

      // There are 3 files that must be included in the temp
      // project directory. These file names MUST match the
      // names that are expected to be copied.
      test.equal(this.copySync.callCount, 2);

      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      test.equal(this.remove.callCount, 1);

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
        }

        // There are no .tesselignore rules, but the .tesselinclude rules
        // include a negated pattern. The additional, non-negated files
        // are copied into the temporary bundle dir, and then included
        // in the tarred bundle.
        test.deepEqual(entries, [
          '__tessel_program__.js',
          // mock-foo.js is NOT present
          // from ./node_modules/foo/.tesselinclude
          'node_modules/foo/package.json',
          // from ./.tesselinclude
          'other.js'
        ]);

        test.done();
      });
    }.bind(this));
  },

  fullIncludeHasNegateRules: function(test) {
    test.expect(9);

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
    }).then(function(bundle) {
      test.equal(this.globSync.callCount, 4);

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
      test.equal(this.browserify.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.minify.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.remove.callCount, 0);
      // End

      // Extract and inspect the bundle...
      extract(bundle, function(error, entries) {
        if (error) {
          test.fail(error);
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
    }.bind(this));
  },
};

exports['Tessel.prototype.restartScript'] = {
  setUp: function(done) {
    this.runScript = sandbox.stub(deploy, 'runScript', function() {
      return Promise.resolve();
    });
    this.startPushedScript = sandbox.stub(deploy, 'startPushedScript', function() {
      return Promise.resolve();
    });

    this.findProject = sandbox.stub(deploy, 'findProject', function(entryPoint) {
      return Promise.resolve({
        entryPoint: entryPoint
      });
    });

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
    test.expect(1);
    var opts = {
      type: 'ram',
      entryPoint: 'index.js',
    };

    this.tessel.restartScript(opts)
      .then(function() {
        test.equal(this.runScript.callCount, 1);
        test.done();
      }.bind(this));

    setImmediate(function() {
      this.tessel._rps.emit('close');
    }.bind(this));
  },

  restartFromFlash: function(test) {
    test.expect(1);
    var opts = {
      type: 'flash',
      entryPoint: 'index.js',
    };

    this.tessel.restartScript(opts)
      .then(function() {
        test.equal(this.startPushedScript.callCount, 1);
        test.done();
      }.bind(this));

    setImmediate(function() {
      this.tessel._rps.emit('close');
    }.bind(this));
  },

  restartNonExistent: function(test) {
    test.expect(1);
    var opts = {
      type: 'flash',
      entryPoint: 'index.js',
    };

    this.tessel.restartScript(opts)
      .catch(function(error) {
        test.equal(error, '"index.js" not found on undefined');
        test.done();
      }.bind(this));

    setImmediate(function() {
      this.tessel._rps.stderr.emit('data', new Buffer('No such file or directory'));
      this.tessel._rps.emit('close');
    }.bind(this));
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

    this.lstatSync = sandbox.stub(fs, 'lstatSync', function(file) {
      return {
        isDirectory: function() {
          // naive for testing.
          return file.slice(-1) === '/';
        }
      };
    });

    this.realpathSync = sandbox.stub(fs, 'realpathSync', function(arg) {
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
    }).then(function(project) {
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
    }).then(function(project) {
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
    }).then(function(project) {
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
    }).then(function() {
      test.ok(false, 'findProject should not find a valid project here');
      test.done();
    }).catch(function(error) {
      test.ok(error.indexOf('ENOENT') !== -1);
      test.done();
    });
  },

  byFileInSubDirectory: function(test) {
    test.expect(1);
    var target = 'test/unit/fixtures/find-project/test/index.js';

    deploy.findProject({
      entryPoint: target
    }).then(function(project) {
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
    var slimPath = '__tessel_program__.js';

    var opts = {
      entryPoint: entryPoint,
      slimPath: slimPath,
      single: true,
      slim: true,
    };

    deploy.findProject(opts).then(function(project) {
      // Without the `single` flag, this would've continued upward
      // until it found a directory with a package.json.
      test.ok(project.pushdir, fs.realpathSync(path.dirname(pushdir)));
      test.done();
    });
  },

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

  parser.on('entry', function(entry) {
    if (entry.type === 'File') {
      entries.push(entry.path);
    }
  });

  parser.on('end', function() {
    callback(null, entries);
  });

  parser.on('error', function(error) {
    callback(error, null);
  });

  parser.end(bundle);
}
