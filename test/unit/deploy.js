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
var deployFolder = path.join(__dirname, 'tmp');
var deployFile = path.join(deployFolder, 'app.js');
var codeContents = 'console.log("testing deploy");';
var reference = new Buffer(codeContents);
var sandbox = sinon.sandbox.create();

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
    this.addIgnoreRules = sandbox.spy(Ignore.prototype, 'addIgnoreRules');
    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  project: function(test) {
    test.expect(2);

    var target = 'test/unit/fixtures/bundling';

    deploy.tarBundle({
      target: target
    }).then(function(bundle) {
      test.equal(this.addIgnoreRules.callCount, 0);
      test.equal(bundle.length, 4608);
      test.done();
    }.bind(this));
  },

  single: function(test) {
    test.expect(3);

    var target = 'test/unit/fixtures/bundling';
    var entryPoint = 'index.js';

    deploy.tarBundle({
      target: target,
      entryPoint: entryPoint,
      resolvedEntryPoint: entryPoint,
      single: true
    }).then(function(bundle) {
      test.equal(this.addIgnoreRules.callCount, 1);
      test.deepEqual(this.addIgnoreRules.lastCall.args[0], ['*', '!index.js']);
      test.equal(bundle.length, 2048);
      test.done();
    }.bind(this));
  },

  singleNested: function(test) {
    test.expect(3);

    var target = 'test/unit/fixtures/bundling';
    var entryPoint = 'another.js';

    deploy.tarBundle({
      target: target,
      entryPoint: entryPoint,
      resolvedEntryPoint: 'nested/' + entryPoint,
      single: true
    }).then(function(bundle) {
      test.equal(this.addIgnoreRules.callCount, 1);
      test.deepEqual(this.addIgnoreRules.lastCall.args[0], ['*', '!nested/another.js']);
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
    var fake = '/fake/test/home/dir';

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
      test.equal(arg, '/fake/test/home/dir/foo');
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
        entryPoint: 'test/index.js'
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
