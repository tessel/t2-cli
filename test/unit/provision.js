// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

var testDir = __dirname + '/tmp/';
var testFile = 'test_rsa';
var testPath = path.join(testDir, testFile);
var fakeKeyFileData = 'Test Contents';
var pubKey = (`ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDKg4tn+4c1lutKReMLhS8OeoHFC8yej41NUS7OIevSKuHNFEphMztD9L/FA5uAIDrzv1kUixEN5k4mmN3IEXs6oiFlZAQQY2ZSAVrKKNA2B2mR52eqwrIUkDjCiGh78TqRrHTLohl+9bcMebwbchX7zbpUh9ur9Th4n0yDZNhtrEpOWlvg2yxXlJg0h6c8V7145F1jAmpHWuU7cndGJKfzv4OLQTXbEnOvjKWZFLNfPUCTnzzKnFQY2a7MvV66iRRdy/lBahJzDQcNnvXyek+e+6JrWhNAtQm2CrgTFnCnJrut5XL5gzELlr0mAPzmkKAm+7XbFSXaPRbtUqx7QiY1 (unnamed)`).trim();


exports['Tessel.isProvisioned()'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.existsSync = this.sandbox.stub(fs, 'existsSync').returns(true);
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  isProvisionedTrue(test) {
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

  isProvisionedFalse(test) {
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

exports['controller.provision'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.tessel = TesselSimulator();

    this.tessel._rps.on('newListener', (event) => {
      if (event === 'close') {
        setImmediate(() => {
          this.tessel._rps.emit(event);
        });
      }
    });

    this.isProvisioned = this.sandbox.stub(Tessel, 'isProvisioned');
    this.controllerProvisionTessel = this.sandbox.spy(controller, 'provision');

    this.exec = this.sandbox.stub(cp, 'exec').callsFake((command, callback) => {
      callback();
    });

    this.writeFile = this.sandbox.stub(fs, 'writeFile').callsFake((file, contents, options, callback) => {
      callback(null, callback);
    });

    this.readFile = this.sandbox.stub(fs, 'readFile').callsFake((file, options, callback) => {
      callback(null, pubKey.trim());
    });

    this.provision = this.sandbox.spy(Tessel.prototype, 'provision');

    this.getName = this.sandbox.stub(Tessel.prototype, 'getName').callsFake(() => {
      return Promise.resolve('Tessel-1');
    });

    this.getTessel = this.sandbox.stub(Tessel, 'get').callsFake(() => {
      return Promise.resolve(this.tessel);
    });

    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.closeTesselConnections = this.sandbox.spy(controller, 'closeTesselConnections');

    this.exportKey = this.sandbox.stub(RSA.prototype, 'exportKey').callsFake(_ => _);
    this.parseKey = this.sandbox.stub(sshpk, 'parseKey').callsFake(_ => _);
    this.RSA = this.sandbox.stub(global, 'RSA').returns(Object.create(RSA.prototype));


    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.tessel._rps.removeAllListeners();
    this.sandbox.restore();
    deleteKeyTestFolder(done);
  },

  completeForced(test) {
    test.expect(5);
    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;

    // Say it's provisioned to make sure old folder gets deleted
    this.isProvisioned.onFirstCall().returns(true);
    // Make sure to mention that it is not provisioned after folder is deleted
    this.isProvisioned.onSecondCall().returns(false);

    this.controllerProvisionTessel({
        force: true
      })
      .then(() => {
        test.equal(this.exec.callCount, 1);
        test.equal(this.exec.lastCall.args[0], 'rm -r ' + Tessel.LOCAL_AUTH_PATH);
        test.equal(this.provision.callCount, 1);
        test.equal(this.closeTesselConnections.callCount, 1);
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
        test.done();
      });
  },

  completeUnprovisioned(test) {
    test.expect(4);
    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;

    this.isProvisioned.returns(false);

    this.controllerProvisionTessel().then(() => {
      test.equal(this.exec.callCount, 0);
      test.equal(this.provision.callCount, 1);
      test.equal(this.closeTesselConnections.callCount, 1);
      test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
      Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
      test.done();
    });
  },

  completeUnprovisionedForced(test) {
    test.expect(4);
    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;

    Tessel.LOCAL_AUTH_PATH = testPath;

    this.isProvisioned.returns(false);

    this.controllerProvisionTessel({
      force: true
    }).then(() => {
      test.equal(this.exec.callCount, 0);
      test.equal(this.provision.callCount, 1);
      test.equal(this.closeTesselConnections.callCount, 1);
      test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
      Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
      test.done();
    });
  },

  reportFailure(test) {
    test.expect(2);

    this.exec.restore();
    this.exec = this.sandbox.stub(cp, 'exec').callsFake(function(command, callback) {
      callback('some error');
    });

    this.isProvisioned.returns(true);

    this.controllerProvisionTessel({
      force: true
    }).catch(error => {
      test.equal(error, 'some error');
      test.equal(this.closeTesselConnections.callCount, 0);
      test.done();
    });
  }
};

exports['Tessel.prototype.provision'] = {

  setUp(done) {
    this.sandbox = sinon.sandbox.create();

    this.provision = this.sandbox.spy(Tessel.prototype, 'provision');
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.setupLocal = this.sandbox.spy(provision, 'setupLocal');
    this.fileExists = this.sandbox.spy(commands, 'ensureFileExists');
    this.appendStdinToFile = this.sandbox.spy(commands, 'appendStdinToFile');

    this.exportKey = this.sandbox.stub(RSA.prototype, 'exportKey').callsFake(_ => _);
    this.parseKey = this.sandbox.stub(sshpk, 'parseKey').callsFake(_ => _);
    this.RSA = this.sandbox.stub(global, 'RSA').returns(Object.create(RSA.prototype));

    this.writeFile = this.sandbox.stub(fs, 'writeFile').callsFake((dirname, contents, options, callback) => {
      callback(null);
    });
    this.ensureDir = this.sandbox.stub(fs, 'ensureDir').callsFake((dirname, callback) => {
      callback(null);
    });

    this.tessel = TesselSimulator();

    deleteKeyTestFolder();

    done();
  },

  tearDown(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    deleteKeyTestFolder(done);
  },

  alreadyAuthedError(test) {
    test.expect(1);

    this.setupLocal.restore();

    this.setupLocal = this.sandbox.stub(provision, 'setupLocal').callsFake(function() {
      return Promise.resolve();
    });
    this.authTessel = this.sandbox.stub(provision, 'authTessel').callsFake(function() {
      return Promise.reject(new provision.AlreadyAuthenticatedError());
    });

    this.tessel.provision()
      .then(() => {
        test.equal(this.info.lastCall.args[0], 'Tessel is already authenticated with this computer.');
        test.done();
      })
      .catch(() => {
        test.ok(false, 'The AlreadyAuthenticatedError will resolve, not reject.');
        test.done();
      });

  },

  requestFromLANTessel(test) {
    test.expect(2);
    // Set the connectionType to LAN so it will fail
    this.tessel = new TesselSimulator({
      type: 'LAN'
    });

    // Attempt to provision
    this.tessel.provision()
      // If an error is not thrown, this test failed
      .then(() => {
        test.ok(false, 'provision should not have been successful');
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

  keysCreatedCorrectPermissions(test) {
    test.expect(3);

    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;
    Tessel.LOCAL_AUTH_PATH = testPath;

    // Attempt to set up local keys
    provision.setupLocal( /* intentionally empty */ )
      .then(() => {
        // Make sure we wrote both keys
        test.equal(this.writeFile.callCount, 2);

        // Permissions should be 0600 (decimal 384)
        // (owner can read and write)
        test.equal(this.writeFile.firstCall.args[2].mode, 384);
        test.equal(this.writeFile.lastCall.args[2].mode, 384);

        Tessel.LOCAL_AUTH_PATH = tesselAuthPath;
        // End the test
        test.done();
      })
      .catch(() => {
        test.ok(false, 'Key write failed.');
        test.done();
      });
  },

  noPreviousLocalKeys(test) {
    test.expect(1);

    this.isProvisioned = this.sandbox.stub(Tessel, 'isProvisioned').returns(false);

    // Attempt to set up local keys
    provision.setupLocal(testPath)
      .then(() => {
        // Make sure we wrote both keys
        test.equal(this.writeFile.callCount, 2);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'Key write failed.');
        test.done();
      });
  },

  fallbackKeyPath(test) {
    test.expect(4);

    this.isProvisioned = this.sandbox.stub(Tessel, 'isProvisioned').returns(false);

    var tesselAuthPath = Tessel.LOCAL_AUTH_PATH;
    Tessel.LOCAL_AUTH_PATH = testPath;

    // Attempt to set up local keys
    provision.setupLocal( /* intentionally empty */ )
      .then(() => {
        // Make sure we wrote both keys
        test.equal(this.writeFile.callCount, 2);
        test.equal(path.dirname(this.writeFile.firstCall.args[0]), testPath);
        test.equal(path.dirname(this.writeFile.lastCall.args[0]), testPath);

        // Ensure that key ends with a newline
        var publicKey = this.writeFile.firstCall.args[1];
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
  },

  keyAlreadyInRemoteAuth(test) {
    test.expect(3);

    this.writeFile.restore();

    createTestKeys(error => {
      if (error) {
        test.ok(false, `createTestKeys failed: ${error.toString()}`);
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
            test.equal(this.fileExists.callCount, 1);
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

  deviceReadyForProvision(test) {
    test.expect(3);

    this.writeFile.restore();

    createTestKeys(error => {
      if (error) {
        test.ok(false, `createTestKeys failed: ${error.toString()}`);
        test.done();
      } else {
        // Attempt to authorize the remote Tessel by writing the SSH keys
        provision.authTessel(this.tessel, testPath)
          .then(() => {
            // We should have checked that the remote file exists
            test.equal(this.fileExists.callCount, 1);
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
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    this.basic = this.sandbox.stub(log, 'basic');

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  // setDefaultKey should reject with an error if no path was provided
  failNoKey(test) {
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
  failWrongType(test) {
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
  failNoFiles(test) {
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

  successfulSetting(test) {
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
