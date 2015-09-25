var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var controller = require('../../lib/controller');
var fs = require('fs-extra');
var path = require('path');
var cp = require('child_process');
var TesselSimulator = require('../common/tessel-simulator');
var logs = require('../../lib/logs');
var provision = require('../../lib/tessel/provision');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var testDir = __dirname + '/tmp/';
var testFile = 'test_rsa';
var testPath = path.join(testDir, testFile);
var fakeKeyFileData = 'Test Contents';
var commands = require('../../lib/tessel/commands');
var async = require('async');

exports['Tessel.isProvisioned()'] = {
  setUp: function(done) {
    this.existsSync = sinon.stub(fs, 'existsSync').returns(true);
    done();
  },

  tearDown: function(done) {
    this.existsSync.restore();
    done();
  },

  isProvisionedTrue: function(test) {
    test.expect(3);

    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = testPath;
    Tessel.isProvisioned();

    test.equal(this.existsSync.callCount, 2);
    test.equal(this.existsSync.firstCall.args[0], path.join(Tessel.TESSEL_AUTH_PATH, 'id_rsa'));
    test.equal(this.existsSync.lastCall.args[0], path.join(Tessel.TESSEL_AUTH_PATH, 'id_rsa.pub'));

    Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
    test.done();
  },

  isProvisionedFalse: function(test) {
    test.expect(2);

    this.existsSync.returns(false);

    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = testPath;
    Tessel.isProvisioned();

    test.equal(this.existsSync.callCount, 1);
    test.equal(this.existsSync.firstCall.args[0], path.join(Tessel.TESSEL_AUTH_PATH, 'id_rsa'));

    Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
    test.done();
  },
};

exports['controller.provisionTessel'] = {
  setUp: function(done) {
    var self = this;
    this.tessel = TesselSimulator();

    this.tessel._rps.on('newListener', function(event) {
      if (event === 'close') {
        setImmediate(function() {
          self.tessel._rps.emit(event);
        });
      }
    });

    this.isProvisioned = sinon.stub(Tessel, 'isProvisioned');

    this.provisionTessel = sinon.spy(controller, 'provisionTessel');

    this.exec = sinon.stub(cp, 'exec', function(command, callback) {
      callback();
    });

    this.provisionSpy = sinon.spy(Tessel.prototype, 'provisionTessel');

    this.getName = sinon.stub(Tessel.prototype, 'getName', function() {
      return new Promise(function(resolve) {
        resolve('Tessel-1');
      });
    });

    this.getTessel = sinon.stub(Tessel, 'get', function() {
      return new Promise(function(resolve) {
        resolve(self.tessel);
      });
    });

    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});

    this.closeTesselConnections = sinon.spy(controller, 'closeTesselConnections');

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.tessel._rps.removeAllListeners();
    this.isProvisioned.restore();
    this.provisionTessel.restore();
    this.provisionSpy.restore();
    this.exec.restore();
    this.getName.restore();
    this.getTessel.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
    this.closeTesselConnections.restore();
    deleteKeyTestFolder(done);
  },

  completeForced: function(test) {
    test.expect(6);
    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = testPath;

    // Say it's provisioned to make sure old folder gets deleted
    this.isProvisioned.onFirstCall().returns(true);
    // Make sure to mention that it is not provisioned after folder is deleted
    this.isProvisioned.onSecondCall().returns(false);

    this.provisionTessel({
        force: true
      })
      .then(function() {
        test.equal(this.exec.callCount, 1);
        test.equal(this.exec.lastCall.args[0], 'rm -r ' + Tessel.TESSEL_AUTH_PATH);
        test.equal(this.provisionSpy.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        rimraf(path.join(process.cwd(), Tessel.TESSEL_AUTH_PATH), function(err) {
          test.ifError(err);
          Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
          test.done();
        });
      }.bind(this));
  },

  completeUnprovisioned: function(test) {
    test.expect(4);
    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = testPath;

    this.isProvisioned.returns(false);

    this.provisionTessel().then(function() {
      test.equal(this.exec.callCount, 0);
      test.equal(this.provisionSpy.callCount, 1);
      test.equal(this.closeTesselConnections.callCount, 1);
      test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
      Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
      test.done();
    }.bind(this));
  },

  completeUnprovisionedForced: function(test) {
    test.expect(4);
    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = testPath;

    this.isProvisioned.returns(false);

    this.provisionTessel({
      force: true
    }).then(function() {
      test.equal(this.exec.callCount, 0);
      test.equal(this.provisionSpy.callCount, 1);
      test.equal(this.closeTesselConnections.callCount, 1);
      test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
      Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
      test.done();
    }.bind(this));
  },

  reportFailure: function(test) {
    test.expect(2);

    this.exec.restore();
    this.exec = sinon.stub(cp, 'exec', function(command, callback) {
      callback('some error');
    });

    this.isProvisioned.returns(true);

    this.provisionTessel({
      force: true
    }).catch(function(error) {
      test.equal(error, 'some error');
      test.equal(this.closeTesselConnections.callCount, 0);
      test.done();
    }.bind(this));
  }
};

exports['Tessel.prototype.provisionTessel'] = {

  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();

    this.provision = this.sandbox.spy(Tessel.prototype, 'provisionTessel');
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.setupLocal = this.sandbox.spy(provision, 'setupLocal');
    this.writeFileSpy = this.sandbox.spy(fs, 'writeFile');
    this.fileExistsSpy = this.sandbox.spy(commands, 'ensureFileExists');
    this.appendStdinToFile = this.sandbox.spy(commands, 'appendStdinToFile');

    this.tessel = TesselSimulator();

    deleteKeyTestFolder();

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    deleteKeyTestFolder(done);
  },

  alreadyAuthedError: function(test) {
    test.expect(1);

    this.setupLocal.restore();

    this.setupLocal = this.sandbox.stub(provision, 'setupLocal', function() {
      return Promise.resolve();
    });
    this.authTessel = this.sandbox.stub(provision, 'authTessel', function() {
      return Promise.reject(new provision.AlreadyAuthenticatedError());
    });

    this.tessel.provisionTessel()
      .then(function() {
        test.equal(this.logsInfo.lastCall.args[0], 'Tessel is already authenticated with this computer.');
        test.done();
      }.bind(this))
      .catch(function() {
        test.fail('The AlreadyAuthenticatedError will resolve, not reject.');
        test.done();
      });

  },

  requestFromLANTessel: function(test) {
    var self = this;

    test.expect(2);
    // Set the connectionType to LAN so it will fail
    this.tessel = new TesselSimulator({
      type: 'LAN'
    });

    // Attempt to provision
    this.tessel.provisionTessel()
      // If an error is not thrown, this test failed
      .then(test.fail)
      // If the error was thrown, continue to the next test
      .catch(function(err) {
        test.equal(err !== undefined, true);
        // Ensure we never tried to set up local keys
        test.equal(self.setupLocal.callCount, 0);
        this.tessel = new TesselSimulator();
        // Finish the test
        test.done();
      });
  },

  keysCreatedCorrectPermissions: function(test) {
    var self = this;

    test.expect(3);

    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;
    Tessel.TESSEL_AUTH_PATH = testPath;

    // Create folders for the folder that we'd like to
    createKeyTestFolder(function(err) {
      if (err) {
        test.fail();
      }
      // Attempt to set up local keys
      provision.setupLocal( /* intentionally empty */ )
        .then(function() {
          // Make sure we wrote both keys
          test.equal(self.writeFileSpy.callCount, 2);

          // Permissions should be 0600 (decimal 384)
          // (owner can read and write)
          test.equal(self.writeFileSpy.firstCall.args[2].mode, 384);
          test.equal(self.writeFileSpy.lastCall.args[2].mode, 384);

          Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
          // End the test
          test.done();
        })
        .catch(function() {
          test.fail('Key write failed.');
        });
    });
  },

  noPreviousLocalKeys: function(test) {
    var self = this;

    test.expect(1);

    this.isProvisioned = sinon.stub(Tessel, 'isProvisioned', function() {
      return false;
    });

    // Create folders for the folder that we'd like to
    createKeyTestFolder(function(err) {
      if (err) {
        test.fail();
      }
      // Attempt to set up local keys
      provision.setupLocal(testPath)
        .then(function() {
          // Make sure we wrote both keys
          test.equal(self.writeFileSpy.callCount, 2);

          self.isProvisioned.restore();
          // End the test
          test.done();
        })
        .catch(function() {
          test.fail('Key write failed.');
        });
    });
  },

  fallbackKeyPath: function(test) {
    var self = this;

    test.expect(3);

    this.isProvisioned = sinon.stub(Tessel, 'isProvisioned', function() {
      return false;
    });

    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;
    Tessel.TESSEL_AUTH_PATH = testPath;

    // Create folders for the folder that we'd like to
    createKeyTestFolder(function(err) {
      if (err) {
        test.fail();
      }
      // Attempt to set up local keys
      provision.setupLocal( /* intentionally empty */ )
        .then(function() {
          // Make sure we wrote both keys
          test.equal(self.writeFileSpy.callCount, 2);
          test.equal(path.dirname(self.writeFileSpy.firstCall.args[0]), testPath);
          test.equal(path.dirname(self.writeFileSpy.lastCall.args[0]), testPath);

          Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
          self.isProvisioned.restore();
          // End the test
          test.done();
        })
        .catch(function() {
          test.fail('Key write failed.');
        });
    });
  },

  keyAlreadyInRemoteAuth: function(test) {
    var self = this;

    test.expect(3);

    createTestKeys(function keysCreated(err) {
      if (err) {
        test.fail(err);
      } else {
        provision.authTessel(self.tessel, testPath)
          .then(function unexpectedRoute() {
            test.fail('Authorize did not return fail even though remote Tessel already listed user key.');
          })
          .catch(function properRoute(err) {
            test.equal(err !== undefined, true);
            // We should have checked that the remote file exists
            test.equal(self.fileExistsSpy.callCount, 1);
            // We should not have tried to write anything to the file
            test.equal(self.appendStdinToFile.callCount, 0);

            test.done();
          });

        // Emit close for ensuring remote file exists
        setTimeout(function() {
          self.tessel._rps.emit('close');
          // Write out fake key file data
          setTimeout(function() {
            self.tessel._rps.stdout.push(fakeKeyFileData);
            // Finish key file data process
            setTimeout(function() {
              self.tessel._rps.emit('close');
            }, 10);
          }, 10);
        }, 10);
      }
    });
  },

  deviceReadyForProvision: function(test) {
    var self = this;

    test.expect(3);

    createTestKeys(function keysCreated(err) {
      if (err) {
        test.fail(err);
      } else {
        // Attempt to authorize the remote Tessel by writing the SSH keys
        provision.authTessel(self.tessel, testPath)
          .then(function properRoute() {
            // We should have checked that the remote file exists
            test.equal(self.fileExistsSpy.callCount, 1);
            // We should not have tried to write anything to the file
            test.equal(self.appendStdinToFile.callCount, 1);
            // Ensure the proper key was provided to the authorized_keys file
            test.done();

          })
          .catch(function unexpectedRoute() {
            test.fail('Provision did not copy keys to remote device when it should have.');
          });

        // Emit close for ensuring remote file exists
        setTimeout(function() {
          self.tessel._rps.emit('close');
          // Write out no keys so it's forced to write a new one
          setTimeout(function() {
            self.tessel._rps.stdout.push('');
            // Finish key file read back process
            setTimeout(function() {
              self.tessel._rps.emit('close');
              // Ensure the fake key file data was sent to stdin
              self.tessel._rps.on('stdin', function(data) {
                test.equal(data.toString(), fakeKeyFileData);
              });
              // Finish key copy process
              setTimeout(function() {
                self.tessel._rps.emit('close');
              }, 1);
            }, 1);
          }, 1);
        }, 1);
      }
    });
  }
};

function createTestKeys(callback) {
  // Create the test folder
  createKeyTestFolder(function createKeys(err) {
    if (err) {
      if (typeof callback === 'function') {
        callback(err);
      }
      return;
    } else {
      // Create fake keys
      async.parallel([
          fs.writeFile.bind(this, testPath + '.pub', fakeKeyFileData),
          fs.writeFile.bind(this, testPath, fakeKeyFileData),
        ],
        callback);
    }
  });
}

function createKeyTestFolder(callback) {
  mkdirp(testDir, callback);
}

function deleteKeyTestFolder(callback) {
  if (!callback) {
    callback = function() {};
  }
  rimraf(testDir, callback);
}
