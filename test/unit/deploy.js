var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var deploy = require('../../lib/tessel/deploy');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var rimraf = require('rimraf');
var Ignore = require('fstream-ignore');
var fsTemp = require('fs-temp');
var browserify = require('browserify');
var uglify = require('uglify-js');
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
    test.expect(10);
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
      test.equal(this.deleteFolder.callCount, 1);
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

exports['tarBundle'] = {
  setUp: function(done) {
    this.writeFileSync = sandbox.spy(fs, 'writeFileSync');
    this.rmdirSync = sandbox.spy(fs, 'rmdirSync');
    this.unlinkSync = sandbox.spy(fs, 'unlinkSync');

    this.exclude = sandbox.spy(browserify.prototype, 'exclude');
    this.mkdirSync = sandbox.spy(fsTemp, 'mkdirSync');
    this.addIgnoreRules = sandbox.spy(Ignore.prototype, 'addIgnoreRules');
    this.minify = sandbox.spy(uglify, 'minify');

    this.browserify = sandbox.spy(deploy, 'browserify');
    this.compress = sandbox.spy(deploy, 'compress');

    this.logsWarn = sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = sandbox.stub(logs, 'info', function() {});

    this.glob = sandbox.stub(deploy, 'glob', function(pattern, options, callback) {
      process.nextTick(function() {
        callback(null, []);
      });
    });

    this.globSync = sandbox.stub(deploy.glob, 'sync', function() {
      return [];
    });

    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  tesselIgnore: function(test) {
    test.expect(2);

    var target = 'test/unit/fixtures/ignore';
    var entryPoint = 'index.js';
    var fileToIgnore = path.join(target, 'mock-foo.js');
    var slimPath = '__tessel_program__.js';

    this.glob.restore();
    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', function() {
      return [fileToIgnore];
    });

    deploy.tarBundle({
      target: target,
      resolvedEntryPoint: entryPoint,
      slimPath: slimPath,
      slim: true,
    }).then(function() {

      // There are only 4 valid rules. (2 in each .tesselignore)
      // The empty line MUST NOT create a pattern entry.
      // The comment line MUST NOT create a pattern entry.
      test.equal(this.globSync.callCount, 4);
      test.deepEqual(this.globSync.args, [
        ['a/**/*.*', {
          cwd: 'test/unit/fixtures/ignore'
        }],
        ['mock-foo.js', {
          cwd: 'test/unit/fixtures/ignore'
        }],
        ['nested/b/**/*.*', {
          cwd: 'test/unit/fixtures/ignore'
        }],
        ['nested/file.js', {
          cwd: 'test/unit/fixtures/ignore'
        }]
      ]);

      test.done();
    }.bind(this));
  },


  full: function(test) {
    test.expect(11);

    var target = 'test/unit/fixtures/bundling';

    deploy.tarBundle({
      target: path.normalize(target),
      full: true,
    }).then(function(bundle) {
      test.equal(this.glob.callCount, 0);
      test.equal(this.globSync.callCount, 0);
      test.equal(this.addIgnoreRules.callCount, 0);
      test.equal(this.browserify.callCount, 0);
      test.equal(this.exclude.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.minify.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.unlinkSync.callCount, 0);
      test.equal(this.rmdirSync.callCount, 0);

      test.equal(bundle.length, 5632);
      test.done();
    }.bind(this));
  },

  slim: function(test) {
    test.expect(13);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/bundling';
    var slimPath = '__tessel_program__.js';

    // this.join.reset();
    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slimPath: slimPath,
      slim: true,
    }).then(function(bundle) {
      test.equal(this.glob.callCount, 1);
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.mkdirSync.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);

      test.equal(
        this.writeFileSync.lastCall.args[0],
        path.join(this.mkdirSync.lastCall.returnValue, slimPath)
      );
      test.equal(this.writeFileSync.lastCall.args[1], 'console.log("testing deploy");');

      test.equal(this.unlinkSync.callCount, 1);
      test.equal(
        this.unlinkSync.lastCall.args[0],
        path.join(this.mkdirSync.lastCall.returnValue, slimPath)
      );

      test.equal(this.rmdirSync.callCount, 1);
      test.equal(this.rmdirSync.lastCall.args[0], this.mkdirSync.lastCall.returnValue);

      test.equal(bundle.length, 2048);
      test.done();
    }.bind(this));
  },

  slimRequireOnlyTesselLikeInit: function(test) {
    test.expect(13);

    var entryPoint = 'index.js';
    var target = 'test/unit/fixtures/init';
    var slimPath = '__tessel_program__.js';

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slimPath: slimPath,
      slim: true,
    }).then(function(bundle) {
      test.equal(this.glob.callCount, 1);
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);

      test.equal(this.mkdirSync.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);

      test.equal(
        this.writeFileSync.lastCall.args[0],
        path.join(this.mkdirSync.lastCall.returnValue, slimPath)
      );
      test.equal(this.writeFileSync.lastCall.args[1], 'var tessel=require("tessel");tessel.led[2].on(),setInterval(function(){tessel.led[2].toggle(),tessel.led[3].toggle()},100);');

      test.equal(this.unlinkSync.callCount, 1);
      test.equal(
        this.unlinkSync.lastCall.args[0],
        path.join(this.mkdirSync.lastCall.returnValue, slimPath)
      );

      test.equal(this.rmdirSync.callCount, 1);
      test.equal(this.rmdirSync.lastCall.args[0], this.mkdirSync.lastCall.returnValue);

      test.equal(bundle.length, 2048);
      test.done();
    }.bind(this));
  },

  slimRespectTesselIgnore: function(test) {
    test.expect(22);

    var target = 'test/unit/fixtures/slim';
    var entryPoint = 'index.js';
    var tesselignore = path.join(target, '.tesselignore');
    var fileToIgnore = path.join(target, 'mock-foo.js');
    var slimPath = '__tessel_program__.js';

    this.glob.restore();
    this.glob = sandbox.stub(deploy, 'glob', function(pattern, options, callback) {
      test.equal(options.dot, true);
      process.nextTick(function() {
        callback(null, [tesselignore]);
      });
    });

    // This is necessary because the path in which the tests are being run might
    // not be the same path that this operation occurs within.
    this.globSync.restore();
    this.globSync = sandbox.stub(deploy.glob, 'sync', function() {
      return [fileToIgnore];
    });

    deploy.tarBundle({
      target: path.normalize(target),
      resolvedEntryPoint: entryPoint,
      slimPath: slimPath,
      slim: true,
    }).then(function() {
      test.equal(this.glob.callCount, 1);
      test.equal(this.globSync.callCount, 1);
      test.equal(this.browserify.callCount, 1);
      test.equal(this.browserify.lastCall.args[0], path.join(target, entryPoint));

      // These options are extrememly important. Without them,
      // the bundles will have node.js built-ins shimmed!!
      test.deepEqual(this.browserify.lastCall.args[1], {
        builtins: false,
        commondir: false,
        browserField: false,
        detectGlobals: false,
        ignoreMissing: true
      });

      test.equal(this.exclude.callCount, 1);
      test.equal(this.exclude.lastCall.args[0], path.normalize('test/unit/fixtures/slim/mock-foo.js'));

      test.equal(this.compress.callCount, 1);
      test.equal(Buffer.isBuffer(this.compress.lastCall.args[0]), true);

      var minified = this.compress.lastCall.returnValue;

      test.equal(minified.indexOf('!!mock foo!!'), -1);

      test.equal(this.minify.callCount, 1);
      test.equal(typeof this.minify.lastCall.args[0], 'string');

      // Cannot deepEqual because uglify.minify(..., options) will
      // mutate the options reference. No need to keep track of that.
      test.equal(this.minify.lastCall.args[1].fromString, true);

      test.equal(this.mkdirSync.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);

      test.equal(
        this.writeFileSync.lastCall.args[0],
        path.join(this.mkdirSync.lastCall.returnValue, slimPath)
      );
      test.equal(this.writeFileSync.lastCall.args[1], minified);

      test.equal(this.unlinkSync.callCount, 1);
      test.equal(
        this.unlinkSync.lastCall.args[0],
        path.join(this.mkdirSync.lastCall.returnValue, slimPath)
      );

      test.equal(this.rmdirSync.callCount, 1);
      test.equal(this.rmdirSync.lastCall.args[0], this.mkdirSync.lastCall.returnValue);


      test.done();
    }.bind(this));
  },

  slimSingle: function(test) {
    test.expect(7);

    var target = 'test/unit/fixtures/bundling';
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
      test.equal(this.glob.callCount, 1);
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      test.equal(this.unlinkSync.callCount, 1);


      test.equal(bundle.length, 2048);
      test.done();
    }.bind(this));
  },

  slimSingleNested: function(test) {
    test.expect(7);

    var target = 'test/unit/fixtures/bundling';
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
      test.equal(this.glob.callCount, 1);
      test.equal(this.browserify.callCount, 1);
      test.equal(this.compress.callCount, 1);
      test.equal(this.minify.callCount, 1);
      test.equal(this.writeFileSync.callCount, 1);
      test.equal(this.unlinkSync.callCount, 1);

      test.equal(bundle.length, 2048);
      test.done();
    }.bind(this));
  },

  single: function(test) {
    test.expect(11);

    var target = 'test/unit/fixtures/bundling';
    var entryPoint = 'index.js';
    var slimPath = '__tessel_program__.js';

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      resolvedEntryPoint: entryPoint,
      single: true,
      full: true,
      slimPath: slimPath,
    }).then(function(bundle) {
      test.equal(this.glob.callCount, 0);
      test.equal(this.globSync.callCount, 0);
      test.equal(this.browserify.callCount, 0);
      test.equal(this.exclude.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.minify.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.unlinkSync.callCount, 0);

      test.equal(this.addIgnoreRules.callCount, 1);
      test.deepEqual(
        this.addIgnoreRules.lastCall.args[0], ['*', '!index.js']
      );
      test.equal(bundle.length, 2048);
      test.done();
    }.bind(this));
  },

  singleNested: function(test) {
    test.expect(11);

    var target = 'test/unit/fixtures/bundling';
    var entryPoint = 'another.js';
    var slimPath = path.join(target, '__tessel_program__.js');

    deploy.tarBundle({
      target: path.normalize(target),
      entryPoint: entryPoint,
      resolvedEntryPoint: path.join('nested', entryPoint),
      single: true,
      full: true,
      slimPath: slimPath,

    }).then(function(bundle) {
      test.equal(this.glob.callCount, 0);
      test.equal(this.globSync.callCount, 0);
      test.equal(this.browserify.callCount, 0);
      test.equal(this.exclude.callCount, 0);
      test.equal(this.compress.callCount, 0);
      test.equal(this.minify.callCount, 0);
      test.equal(this.writeFileSync.callCount, 0);
      test.equal(this.unlinkSync.callCount, 0);

      test.equal(this.addIgnoreRules.callCount, 1);
      test.deepEqual(
        this.addIgnoreRules.lastCall.args[0], ['*', path.normalize('!nested/another.js')]
      );
      test.equal(bundle.length, 2560);
      test.done();
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
    rimraf(deployFolder, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
