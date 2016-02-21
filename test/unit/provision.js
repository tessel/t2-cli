// Test dependencies are required and exposed in common/bootstrap.js

var testDir = __dirname + '/tmp/';
var testFile = 'test_rsa';
var testPath = path.join(testDir, testFile);
var fakeKeyFileData = 'Test Contents';

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

    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;
    Tessel.isProvisioned();

    test.equal(this.existsSync.callCount, 2);
    test.equal(this.existsSync.firstCall.args[0], path.join(Tessel.LOCAL_AUTH_PATH, 'id_rsa'));
    test.equal(this.existsSync.lastCall.args[0], path.join(Tessel.LOCAL_AUTH_PATH, 'id_rsa.pub'));

    Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
    test.done();
  },

  isProvisionedFalse: function(test) {
    test.expect(2);

    this.existsSync.returns(false);

    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;
    Tessel.isProvisioned();

    test.equal(this.existsSync.callCount, 1);
    test.equal(this.existsSync.firstCall.args[0], path.join(Tessel.LOCAL_AUTH_PATH, 'id_rsa'));

    Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
    test.done();
  },
};

exports['controller.provisionTessel'] = {
  setUp: function(done) {
    this.tessel = TesselSimulator();

    this.tessel._rps.on('newListener', (event) => {
      if (event === 'close') {
        setImmediate(() => {
          this.tessel._rps.emit(event);
        });
      }
    });

    this.isProvisioned = sinon.stub(Tessel, 'isProvisioned');

    this.provisionTessel = sinon.spy(controller, 'provisionTessel');

    this.exec = sinon.stub(cp, 'exec', (command, callback) => {
      callback();
    });

    this.provisionSpy = sinon.spy(Tessel.prototype, 'provisionTessel');

    this.getName = sinon.stub(Tessel.prototype, 'getName', () => {
      return Promise.resolve('Tessel-1');
    });

    this.getTessel = sinon.stub(Tessel, 'get', () => {
      return Promise.resolve(this.tessel);
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
    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;

    // Say it's provisioned to make sure old folder gets deleted
    this.isProvisioned.onFirstCall().returns(true);
    // Make sure to mention that it is not provisioned after folder is deleted
    this.isProvisioned.onSecondCall().returns(false);

    this.provisionTessel({
        force: true
      })
      .then(function() {
        test.equal(this.exec.callCount, 1);
        test.equal(this.exec.lastCall.args[0], 'rm -r ' + Tessel.LOCAL_AUTH_PATH);
        test.equal(this.provisionSpy.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        fs.remove(path.join(process.cwd(), Tessel.LOCAL_AUTH_PATH), function(err) {
          test.ifError(err);
          Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
          test.done();
        });
      }.bind(this));
  },

  completeUnprovisioned: function(test) {
    test.expect(4);
    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;

    this.isProvisioned.returns(false);

    this.provisionTessel().then(() => {
      test.equal(this.exec.callCount, 0);
      test.equal(this.provisionSpy.callCount, 1);
      test.equal(this.closeTesselConnections.callCount, 1);
      test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
      Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
      test.done();
    });
  },

  completeUnprovisionedForced: function(test) {
    test.expect(4);
    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;

    this.isProvisioned.returns(false);

    this.provisionTessel({
      force: true
    }).then(() => {
      test.equal(this.exec.callCount, 0);
      test.equal(this.provisionSpy.callCount, 1);
      test.equal(this.closeTesselConnections.callCount, 1);
      test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
      Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
      test.done();
    });
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
    }).catch(error => {
      test.equal(error, 'some error');
      test.equal(this.closeTesselConnections.callCount, 0);
      test.done();
    });
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
      .then(() => {
        test.equal(this.logsInfo.lastCall.args[0], 'Tessel is already authenticated with this computer.');
        test.done();
      })
      .catch(() => {
        test.ok(false, 'The AlreadyAuthenticatedError will resolve, not reject.');
        test.done();
      });

  },

  requestFromLANTessel: function(test) {
    test.expect(2);
    // Set the connectionType to LAN so it will fail
    this.tessel = new TesselSimulator({
      type: 'LAN'
    });

    // Attempt to provision
    this.tessel.provisionTessel()
      // If an error is not thrown, this test failed
      .then(() => {
        test.ok(false, 'provisionTessel should not have been successful');
        test.done();
      })
      // If the error was thrown, continue to the next test
      .catch((err) => {
        test.equal(err !== undefined, true);
        // Ensure we never tried to set up local keys
        test.equal(this.setupLocal.callCount, 0);
        this.tessel = new TesselSimulator();
        // Finish the test
        test.done();
      });
  },

  keysCreatedCorrectPermissions: function(test) {
    test.expect(3);

    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;
    Tessel.LOCAL_AUTH_PATH = testPath;

    // Create folders for the folder that we'd like to
    createKeyTestFolder((err) => {
      if (err) {
        test.ok(false, `createKeyTestFolder failed: ${err.toString()}`);
        test.done();
      }
      // Attempt to set up local keys
      provision.setupLocal( /* intentionally empty */ )
        .then(() => {
          // Make sure we wrote both keys
          test.equal(this.writeFileSpy.callCount, 2);

          // Permissions should be 0600 (decimal 384)
          // (owner can read and write)
          test.equal(this.writeFileSpy.firstCall.args[2].mode, 384);
          test.equal(this.writeFileSpy.lastCall.args[2].mode, 384);

          Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
          // End the test
          test.done();
        })
        .catch(() => {
          test.ok(false, 'Key write failed.');
          test.done();
        });
    });
  },

  noPreviousLocalKeys: function(test) {
    test.expect(1);

    this.isProvisioned = sinon.stub(Tessel, 'isProvisioned', () => false);

    // Create folders for the folder that we'd like to
    createKeyTestFolder((err) => {
      if (err) {
        test.ok(false, `createKeyTestFolder failed: ${err.toString()}`);
        test.done();
      }
      // Attempt to set up local keys
      provision.setupLocal(testPath)
        .then(() => {
          // Make sure we wrote both keys
          test.equal(this.writeFileSpy.callCount, 2);

          this.isProvisioned.restore();
          // End the test
          test.done();
        })
        .catch(() => {
          test.ok(false, 'Key write failed.');
          test.done();
        });
    });
  },

  fallbackKeyPath: function(test) {
    test.expect(4);

    this.isProvisioned = sinon.stub(Tessel, 'isProvisioned', () => false);

    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;
    Tessel.LOCAL_AUTH_PATH = testPath;

    // Create folders for the folder that we'd like to
    createKeyTestFolder((err) => {
      if (err) {
        test.ok(false, `createKeyTestFolder failed: ${err.toString()}`);
        test.done();
      }
      // Attempt to set up local keys
      provision.setupLocal( /* intentionally empty */ )
        .then(() => {
          // Make sure we wrote both keys
          test.equal(this.writeFileSpy.callCount, 2);
          test.equal(path.dirname(this.writeFileSpy.firstCall.args[0]), testPath);
          test.equal(path.dirname(this.writeFileSpy.lastCall.args[0]), testPath);

          // Ensure that key ends with a newline
          var publicKey = this.writeFileSpy.firstCall.args[1];
          test.equal(publicKey[publicKey.length - 1], '\n');

          Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
          this.isProvisioned.restore();
          // End the test
          test.done();
        })
        .catch(() => {
          test.ok(false, 'Key write failed.');
          test.done();
        });
    });
  },

  keyAlreadyInRemoteAuth: function(test) {
    test.expect(3);

    createTestKeys((err) => {
      if (err) {
        test.ok(false, `createTestKeys failed: ${err.toString()}`);
        test.done();
      } else {
        provision.authTessel(this.tessel, testPath)
          .then(() => {
            test.ok(false, 'Authorize did not return fail even though remote Tessel already listed user key.');
            test.done();
          })
          .catch(error => {
            test.equal(error !== undefined, true);
            // We should have checked that the remote file exists
            test.equal(this.fileExistsSpy.callCount, 1);
            // We should not have tried to write anything to the file
            test.equal(this.appendStdinToFile.callCount, 0);

            test.done();
          });

        // Emit close for ensuring remote file exists
        setTimeout(() => {
          this.tessel._rps.emit('close');
          // Write out fake key file data
          setTimeout(() => {
            this.tessel._rps.stdout.push(fakeKeyFileData);
            // Finish key file data process
            setTimeout(() => {
              this.tessel._rps.emit('close');
            }, 10);
          }, 10);
        }, 10);
      }
    });
  },

  deviceReadyForProvision: function(test) {
    test.expect(3);

    createTestKeys(error => {
      if (error) {
        test.ok(false, `createTestKeys failed: ${error.toString()}`);
        test.done();
      } else {
        // Attempt to authorize the remote Tessel by writing the SSH keys
        provision.authTessel(this.tessel, testPath)
          .then(() => {
            // We should have checked that the remote file exists
            test.equal(this.fileExistsSpy.callCount, 1);
            // We should not have tried to write anything to the file
            test.equal(this.appendStdinToFile.callCount, 1);
            // Ensure the proper key was provided to the authorized_keys file
            test.done();
          })
          .catch(function unexpectedRoute() {
            test.ok(false, 'Provision did not copy keys to remote device when it should have.');
            test.done();
          });

        // Emit close for ensuring remote file exists
        setTimeout(() => {
          this.tessel._rps.emit('close');
          // Write out no keys so it's forced to write a new one
          setTimeout(() => {
            this.tessel._rps.stdout.push('');
            // Finish key file read back process
            setTimeout(() => {
              this.tessel._rps.emit('close');
              // Ensure the fake key file data was sent to stdin
              this.tessel._rps.on('stdin', function(data) {
                test.equal(data.toString(), fakeKeyFileData);
              });
              // Finish key copy process
              setTimeout(() => {
                this.tessel._rps.emit('close');
              }, 1);
            }, 1);
          }, 1);
        }, 1);
      }
    });
  }
};

exports['provision.setDefaultKey'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  // setDefaultKey should reject with an error if no path was provided
  failNoKey: function(test) {
    test.expect(1);

    provision.setDefaultKey()
      .then(function noCall() {
        // This test should throw an error. Fail if it didn't
        test.ok(false, 'provision.setDefaultKey should not have been successful');
        test.done();
      })
      .catch(function doCall(err) {
        test.ok(err, 'Returned error is undefined');
        test.done();
      });
  },

  // setDefaultKey should reject with an error if a non-string was provided
  failWrongType: function(test) {
    test.expect(1);

    provision.setDefaultKey(path.parse('~/.tessel/id_rsa'))
      .then(function noCall() {
        // This test should throw an error. Fail if it didn't
        test.ok(false, 'provision.setDefaultKey should not have been successful');
        test.done();
      })
      .catch(function doCall(err) {
        test.ok(err, 'Returned error is undefined');
        test.done();
      });
  },

  // setDefaultKey should reject with an error if a non-existent file was provided
  failNoFiles: function(test) {
    test.expect(1);
    provision.setDefaultKey('./no_files_here')
      .then(function noCall() {
        // This test should throw an error. Fail if it didn't
        test.ok(false, 'provision.setDefaultKey should not have been successful');
        test.done();
      })
      .catch(function doCall(err) {
        test.ok(err, 'Returned error is undefined');
        test.done();
      });
  },

  successfulSetting: function(test) {
    test.expect(1);

    var key = path.join(__dirname, './real_file_i_promise');
    var privateKeyPath = path.join(__dirname, './real_file_i_promise');
    var publicKeyPath = path.join(__dirname, './real_file_i_promise' + '.pub');
    fs.writeFileSync(privateKeyPath, 'test_contents');
    fs.writeFileSync(publicKeyPath, 'test_contents');
    provision.setDefaultKey(key)
      .then(function doCall() {
        test.equal(Tessel.LOCAL_AUTH_KEY, key);
        fs.unlinkSync(privateKeyPath);
        fs.unlinkSync(publicKeyPath);
        test.done();
      })
      .catch(function noCall() {
        // This test should not throw an error. Fail if it did
        test.ok(false, 'provision.setDefaultKey should have been successful');
        test.done();
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
    }
    // Create fake keys
    async.parallel([
      (next) => fs.writeFile(testPath + '.pub', fakeKeyFileData, next), (next) => fs.writeFile(testPath, fakeKeyFileData, next),
    ], callback);
  });
}

function createKeyTestFolder(callback) {
  mkdirp(testDir, callback);
}

function deleteKeyTestFolder(callback) {
  if (!callback) {
    callback = function() {};
  }
  fs.remove(testDir, callback);
}
