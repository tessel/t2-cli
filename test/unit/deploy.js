process.on('uncaughtException', function(err) {
  console.error(err.stack);
});
// Test dependencies are required and exposed in common/bootstrap.js

var meminfo = fs.readFileSync('test/unit/fixtures/proc-meminfo', 'utf8');
var sandbox = sinon.sandbox.create();

exports['Tessel.prototype.memoryInfo'] = {
  setUp: function(done) {
    this.simpleExec = sandbox.stub(Tessel.prototype, 'simpleExec', () => Promise.resolve(meminfo));

    this.warn = sandbox.stub(log, 'warn', function() {});
    this.info = sandbox.stub(log, 'info', function() {});

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
    test.expect(3);
    this.tessel.memoryInfo().then((memory) => {
      test.equal(this.simpleExec.callCount, 1);
      test.deepEqual(this.simpleExec.lastCall.args[0], ['cat', '/proc/meminfo']);
      test.deepEqual(memory, this.expect);
      test.done();
    });
  },

  failureNoResponse: function(test) {
    test.expect(1);

    this.simpleExec.restore();

    this.simpleExec = sandbox.stub(Tessel.prototype, 'simpleExec', () => Promise.resolve());

    this.tessel.memoryInfo().catch((error) => {
      test.equal(error, 'Could not read device memory information.');
      test.done();
    });
  },

  failureEmptyResponse: function(test) {
    test.expect(1);

    this.simpleExec.restore();

    this.simpleExec = sandbox.stub(Tessel.prototype, 'simpleExec', () => Promise.resolve(''));

    this.tessel.memoryInfo().catch((error) => {
      test.equal(error, 'Could not read device memory information.');
      test.done();
    });
  },

};

exports['Tessel.prototype.deploy'] = {
  setUp: function(done) {
    this.deploy = sandbox.spy(Tessel.prototype, 'deploy');
    this.appStop = sandbox.spy(commands.app, 'stop');
    this.appStart = sandbox.spy(commands.app, 'start');
    this.appEnable = sandbox.spy(commands.app, 'enable');
    this.deleteFolder = sandbox.spy(commands, 'deleteFolder');
    this.createFolder = sandbox.spy(commands, 'createFolder');
    this.untarStdin = sandbox.spy(commands, 'untarStdin');
    this.execute = sandbox.spy(commands.js, 'execute');
    this.openStdinToFile = sandbox.spy(commands, 'openStdinToFile');
    this.chmod = sandbox.spy(commands, 'chmod');

    this.push = sandbox.spy(deploy, 'push');
    this.createShellScript = sandbox.spy(deploy, 'createShellScript');

    this.injectBinaryModules = sandbox.stub(deployment.js, 'injectBinaryModules', () => Promise.resolve());
    this.resolveBinaryModules = sandbox.stub(deployment.js, 'resolveBinaryModules', () => Promise.resolve());
    this.tarBundle = sandbox.stub(deployment.js, 'tarBundle', function() {
      return new Promise(function(resolve) {
        resolve(reference);
      });
    });

    this.warn = sandbox.stub(log, 'warn', function() {});
    this.info = sandbox.stub(log, 'info', function() {});

    this.tessel = TesselSimulator();
    this.end = sandbox.spy(this.tessel._rps.stdin, 'end');

    this.pWrite = sandbox.stub(Preferences, 'write').returns(Promise.resolve());


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

  resolveLanguageOrRuntime: function(test) {
    test.expect(10);

    // This is used _solely_ to bailout of deployment early.
    this.simpleExec = sandbox.stub(Tessel.prototype, 'simpleExec', () => Promise.reject('Bailout'));
    this.resolveLanguage = sandbox.spy(deployment, 'resolveLanguage');
    this.existsSync = sandbox.stub(fs, 'existsSync').returns(false);

    Promise.all([
      this.tessel.deploy({
        entryPoint: 'index.js'
      }),
      this.tessel.deploy({
        entryPoint: 'index.js',
        lang: 'js'
      }),
      this.tessel.deploy({
        entryPoint: 'index.js',
        lang: 'JavaScript'
      }),
      this.tessel.deploy({
        entryPoint: 'src/main.rs'
      }),
      this.tessel.deploy({
        entryPoint: 'src/main.rs',
        lang: 'rs'
      }),
      this.tessel.deploy({
        entryPoint: 'src/main.rs',
        lang: 'RUST'
      }),
      this.tessel.deploy({
        entryPoint: 'main.py'
      }),
      this.tessel.deploy({
        entryPoint: 'main.py',
        lang: 'py'
      }),
      this.tessel.deploy({
        entryPoint: 'main.py',
        lang: 'Python'
      }),
    ]).catch(() => {

      test.equal(this.resolveLanguage.callCount, 9);

      test.deepEqual(this.resolveLanguage.getCall(0).returnValue, deployment.js);
      test.deepEqual(this.resolveLanguage.getCall(1).returnValue, deployment.js);
      test.deepEqual(this.resolveLanguage.getCall(2).returnValue, deployment.js);
      test.deepEqual(this.resolveLanguage.getCall(3).returnValue, deployment.rs);
      test.deepEqual(this.resolveLanguage.getCall(4).returnValue, deployment.rs);
      test.deepEqual(this.resolveLanguage.getCall(5).returnValue, deployment.rs);
      test.deepEqual(this.resolveLanguage.getCall(6).returnValue, deployment.py);
      test.deepEqual(this.resolveLanguage.getCall(7).returnValue, deployment.py);
      test.deepEqual(this.resolveLanguage.getCall(8).returnValue, deployment.py);

      test.done();
    });
  },

  recordEntryPoint: function(test) {
    test.expect(1);

    this.exec = sandbox.spy(this.tessel.connection, 'exec');
    deployTestCode(this.tessel, {
      push: false,
      single: false
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }

      test.equal(this.pWrite.callCount, 1);

      test.done();
    });
  },

  run: function(test) {
    test.expect(10);
    this.exec = sandbox.spy(this.tessel.connection, 'exec');
    deployTestCode(this.tessel, {
      push: false,
      single: false
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }
      test.equal(this.appStop.callCount, 1);
      test.equal(this.deleteFolder.callCount, 1);
      test.equal(this.createFolder.callCount, 1);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.execute.callCount, 1);
      test.equal(this.openStdinToFile.callCount, 0);
      test.equal(this.chmod.callCount, 0);
      test.equal(this.appStart.callCount, 0);
      test.equal(this.end.callCount, 1);
      // Ensure that the last call (to run Node) sets pty to true
      test.equal(this.exec.lastCall.args[1].pty, true);
      test.done();
    });
  },

  runSingle: function(test) {
    test.expect(9);
    deployTestCode(this.tessel, {
      push: false,
      single: true
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }
      test.equal(this.appStop.callCount, 1);
      test.equal(this.deleteFolder.callCount, 0);
      test.equal(this.createFolder.callCount, 1);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.execute.callCount, 1);
      test.equal(this.openStdinToFile.callCount, 0);
      test.equal(this.chmod.callCount, 0);
      test.equal(this.appStart.callCount, 0);
      test.equal(this.end.callCount, 1);
      test.done();
    });
  },

  push: function(test) {
    test.expect(12);
    deployTestCode(this.tessel, {
      push: true,
      single: false
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }

      var expectedPath = path.normalize('test/unit/tmp/app.js');

      test.equal(this.push.lastCall.args[1].entryPoint, expectedPath);
      test.equal(this.createShellScript.lastCall.args[1].resolvedEntryPoint, expectedPath);

      test.equal(this.appStop.callCount, 1);
      // Delete and create both the flash and ram folders
      test.equal(this.deleteFolder.callCount, 2);
      test.equal(this.createFolder.callCount, 2);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.execute.callCount, 0);
      test.equal(this.openStdinToFile.callCount, 1);
      test.equal(this.chmod.callCount, 1);
      test.equal(this.appEnable.callCount, 1);
      test.equal(this.appStart.callCount, 1);
      test.equal(this.end.callCount, 1);
      test.done();
    });
  },

  pushSingle: function(test) {
    test.expect(10);
    deployTestCode(this.tessel, {
      push: true,
      single: true
    }, (error) => {
      if (error) {
        test.ok(false, `deployTestCode failed: ${error.toString()}`);
        test.done();
      }
      test.equal(this.appStop.callCount, 1);
      test.equal(this.deleteFolder.callCount, 0);
      test.equal(this.createFolder.callCount, 1);
      test.equal(this.untarStdin.callCount, 1);
      test.equal(this.execute.callCount, 0);
      test.equal(this.openStdinToFile.callCount, 1);
      test.equal(this.chmod.callCount, 1);
      test.equal(this.appStart.callCount, 1);
      test.equal(this.appEnable.callCount, 1);
      test.equal(this.end.callCount, 1);
      test.done();
    });
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
        this.tessel.deploy({
            entryPoint: path.relative(process.cwd(), DEPLOY_FILE),
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

exports['Tessel.prototype.restart'] = {
  setUp: function(done) {
    this.resolveLanguage = sandbox.spy(deployment, 'resolveLanguage');
    this.run = sandbox.stub(deploy, 'run', () => Promise.resolve());
    this.start = sandbox.stub(deploy, 'start', () => Promise.resolve());
    this.warn = sandbox.stub(log, 'warn', function() {});
    this.info = sandbox.stub(log, 'info', function() {});

    this.tessel = TesselSimulator();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();

    sandbox.restore();

    done();
  },

  restartFromRam: function(test) {
    test.expect(4);
    var opts = {
      type: 'ram',
      entryPoint: 'index.js',
    };

    this.tessel.restart(opts)
      .then(() => {
        test.equal(this.run.callCount, 1);
        var options = this.run.lastCall.args[1];

        test.equal(options.type, 'ram');
        test.equal(options.entryPoint, 'index.js');
        test.equal(options.lang.meta.name, 'javascript');

        test.done();
      });

    setImmediate(() => {
      this.tessel._rps.emit('close');
    });
  },

  restartFromFlash: function(test) {
    test.expect(5);
    var opts = {
      type: 'flash',
      entryPoint: 'index.js',
    };

    this.tessel.restart(opts)
      .then(() => {
        test.equal(this.start.callCount, 1);
        test.equal(this.start.lastCall.args[1], 'index.js');

        var options = this.start.lastCall.args[2];
        test.equal(options.type, 'flash');
        test.equal(options.entryPoint, 'index.js');
        test.equal(options.lang.meta.name, 'javascript');
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

    this.tessel.restart(opts)
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


exports['deploy.run'] = {
  setUp: function(done) {
    this.info = sandbox.stub(log, 'info');
    this.tessel = TesselSimulator();
    done();
  },
  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  runResolveEntryPoint: function(test) {
    test.expect(1);

    this.exec = sandbox.stub(this.tessel.connection, 'exec', (command, opts, callback) => {
      callback(null, this.tessel._rps);
      this.tessel._rps.emit('close');
    });

    deploy.run(this.tessel, {
      entryPoint: 'foo',
      lang: deployment.js,
    }).then(() => {
      test.deepEqual(this.exec.lastCall.args[0], ['node', '/tmp/remote-script/foo']);
      test.done();
    });
  },

  runResolveEntryPointWithPreRun: function(test) {
    test.expect(2);

    this.exec = sandbox.stub(this.tessel.connection, 'exec', (command, opts, callback) => {
      callback(null, this.tessel._rps);

      if (this.exec.callCount === 1) {
        test.deepEqual(command, ['chmod', '+x', '/tmp/remote-script/rust_executable']);
      }
      if (this.exec.callCount === 2) {
        this.tessel._rps.emit('close');
      }
    });

    deploy.run(this.tessel, {
      entryPoint: 'foo',
      lang: deployment.rs,
    }).then(() => {
      test.deepEqual(this.exec.lastCall.args[0], ['rust_executable']);
      test.done();
    });
  },

  runStdInOutLan: function(test) {
    test.expect(4);

    this.tessel.connection.connectionType = 'LAN';

    this.exec = sandbox.stub(this.tessel.connection, 'exec', (command, options, callback) => {
      callback(null, this.tessel._rps);
      this.tessel._rps.emit('close');
    });

    this.stdinPipe = sandbox.stub(process.stdin, 'pipe');
    this.stdinSetRawMode = sandbox.stub(process.stdin, 'setRawMode');

    deploy.run(this.tessel, {
      resolvedEntryPoint: 'foo',
      lang: deployment.js,
    }).then(() => {
      test.equal(this.stdinPipe.callCount, 1);
      test.equal(this.stdinPipe.lastCall.args[0], this.tessel._rps.stdin);
      test.equal(this.stdinSetRawMode.callCount, 1);
      test.equal(this.stdinSetRawMode.lastCall.args[0], true);
      test.done();
    });
  },

  runStdInOutUsb: function(test) {
    test.expect(2);

    this.tessel.connection.connectionType = 'USB';

    this.exec = sandbox.stub(this.tessel.connection, 'exec', (command, options, callback) => {
      callback(null, this.tessel._rps);
      this.tessel._rps.emit('close');
    });

    this.stdinPipe = sandbox.stub(process.stdin, 'pipe');
    this.stdinSetRawMode = sandbox.stub(process.stdin, 'setRawMode');

    deploy.run(this.tessel, {
      resolvedEntryPoint: 'foo',
      lang: deployment.js,
    }).then(() => {
      test.equal(this.stdinPipe.callCount, 0);
      test.equal(this.stdinSetRawMode.callCount, 0);
      test.done();
    });
  },

};

exports['deploy.createShellScript'] = {
  setUp: function(done) {
    this.info = sandbox.stub(log, 'info');
    this.tessel = TesselSimulator();
    done();
  },
  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  remoteShellScriptPathIsNotPathNormalized: function(test) {
    test.expect(2);

    this.exec = sandbox.stub(this.tessel.connection, 'exec', (command, callback) => {
      callback(null, this.tessel._rps);
      this.tessel._rps.emit('close');
    });

    var opts = {
      lang: deployment.js,
      resolvedEntryPoint: 'foo'
    };

    deploy.createShellScript(this.tessel, opts).then(() => {
      test.deepEqual(this.exec.firstCall.args[0], ['dd', 'of=/app/start']);
      test.deepEqual(this.exec.lastCall.args[0], ['chmod', '+x', '/app/start']);
      test.done();
    });
  }
};
