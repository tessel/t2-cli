// Test dependencies are required and exposed in common/bootstrap.js

var testDir = __dirname + '/tmp/';
var testFile = 'test_rsa';
var testPath = path.join(testDir, testFile);
var authPath = path.join(osenv.home(), '.tessel');
var idrsa = 'id_rsa';
var authKey = path.join(authPath, idrsa);

function createKeyTestFolder(callback) {
  fs.mkdirs(testDir, callback);
}

exports['provision.setDefaultKey'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn', function() {});
    this.logInfo = this.sandbox.stub(log, 'info', function() {});
    this.logBasic = this.sandbox.stub(log, 'basic', function() {});
    this.setDefaultKeySpy = this.sandbox.spy(provision, 'setDefaultKey');
    this.fsSpyStatSync = this.sandbox.spy(fs, 'statSync');

    this.parseKey = this.sandbox.stub(sshpk, 'parseKey', _ => _);
    this.RSA = this.sandbox.stub(global, 'RSA', () => {
      return {
        exportKey: _ => _
      };
    });

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    fs.remove(testDir, done);
  },

  noKeyPath: function(test) {
    test.expect(3);
    provision.setDefaultKey()
      .then(() => {
        test.ok(false, 'noKeyPath - should not pass because provision.setDefaultKey should return rejection');
        test.done();
      }).catch(() => {
        test.equal(this.setDefaultKeySpy.callCount, 1);
        // ensure the Tessel.LOCAL_AUTH_PATH has a default when using options without presetting key s
        test.equal(Tessel.LOCAL_AUTH_PATH, authPath);
        test.equal(Tessel.LOCAL_AUTH_KEY, authKey);
        test.done();
      });
  },

  keyIsNoString: function(test) {
    test.expect(3);
    provision.setDefaultKey(1234)
      .then(() => {
        test.ok(false, 'setDefaultKey was expected to fail, but did not');
        test.done();
      }).catch(() => {
        test.equal(this.setDefaultKeySpy.callCount, 1);
        // ensure the Tessel.LOCAL_AUTH_PATH has a default when using options without presetting key s
        test.equal(Tessel.LOCAL_AUTH_PATH, authPath);
        test.equal(Tessel.LOCAL_AUTH_KEY, authKey);
        test.done();
      });
  },

  keyNotPresent: function(test) {
    test.expect(3);
    provision.setDefaultKey('wrongkeypath')
      .then(() => {
        test.ok(false, 'keyNotPresent - wrongkeypath seams to exist');
        test.done();
      }).catch(() => {
        //console.log('test failed ?', fs.statSync.firstCall);
        test.equal(this.setDefaultKeySpy.callCount, 1);
        test.equal(fs.statSync.callCount, 1);
        test.equal(fs.statSync.firstCall.exception.code, 'ENOENT');
        test.done();
      });
  },

  validAlternateKey: function(test) {
    test.expect(4);
    // Create folders for the folder that we'd like to
    createKeyTestFolder((error) => {
      if (error) {
        test.ok(false, error.message);
        test.done();
      }
      // Attempt to set up local keys
      // Generate SSH key
      var key = new RSA({
        b: 2048
      });

      var privateKey = key.exportKey('private');
      var publicKey = sshpk.parseKey(key.exportKey('public'), 'pem').toString('ssh') + '\n';

      // Put SSH keys for Tessel in that folder
      // Set the permission to 0600 (decimal 384)
      // owner can read and write
      var fileOpts = {
        encoding: 'utf8',
        mode: 0o600,
      };

      async.parallel([
        (next) => fs.writeFile(testPath + '.pub', publicKey, fileOpts, next), (next) => fs.writeFile(testPath, privateKey, fileOpts, next),
      ], (error) => {
        if (error) {
          test.ok(false, error.message);
          test.done();
        }
        provision.setDefaultKey(testPath)
          .then(() => {
            fs.remove(testDir, (err) => {
              if (err) {
                test.ok(false, 'Error removing tmp directory: ' + err);
                test.done();
              }
              test.equal(this.setDefaultKeySpy.callCount, 1);
              test.equal(fs.statSync.callCount, 2);
              test.equal(fs.statSync.firstCall.exception, undefined);
              test.equal(fs.statSync.secondCall.exception, undefined);
              test.done();
            });
          }).catch(() => {
            test.ok(false, 'validAlternateKey - provision.setDefaultKey promize rejection');
            test.done();
          });
      });
    });
  }
};
