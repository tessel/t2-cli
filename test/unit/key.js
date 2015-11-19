var sinon = require('sinon');
var logs = require('../../lib/logs');
var testDir = __dirname + '/tmp/';
var testFile = 'test_rsa';
var path = require('path');
var testPath = path.join(testDir, testFile);
var provision = require('../../lib/tessel/provision');
var osenv = require('osenv');
var authPath = path.join(osenv.home(), '.tessel');
var idrsa = 'id_rsa';
var authKey = path.join(authPath, idrsa);
var Tessel = require('../../lib/tessel/tessel');
var fs = require('fs-extra');
var async = require('async');
var NodeRSA = require('node-rsa');
var sshpk = require('sshpk');

function createKeyTestFolder(callback) {
  fs.mkdirs(testDir, callback);
}

exports['provision.setDefaultKey'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});
    this.setDefaultKeySpy = this.sandbox.spy(provision, 'setDefaultKey');
    this.fsSpyStatSync = this.sandbox.spy(fs, 'statSync');
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  noKeyPath: function(test) {
    var self = this;
    test.expect(3);
    provision.setDefaultKey()
      .then(function() {
        test.fail('noKeyPath - should not pass because provision.setDefaultKey should return rejection');

      }).catch(function() {
        test.equal(self.setDefaultKeySpy.callCount, 1);
        // ensure the Tessel.TESSEL_AUTH_PATH has a default when using options without presetting key s
        test.equal(Tessel.TESSEL_AUTH_PATH, authPath);
        test.equal(Tessel.TESSEL_AUTH_KEY, authKey);
        test.done();
      });
  },

  keyIsNoString: function(test) {
    var self = this;
    test.expect(3);
    provision.setDefaultKey(1234)
      .then(function() {
        test.fail('...');
      }).catch(function() {
        test.equal(self.setDefaultKeySpy.callCount, 1);
        // ensure the Tessel.TESSEL_AUTH_PATH has a default when using options without presetting key s
        test.equal(Tessel.TESSEL_AUTH_PATH, authPath);
        test.equal(Tessel.TESSEL_AUTH_KEY, authKey);
        test.done();
      });
  },

  keyNotPresent: function(test) {
    var self = this;
    test.expect(3);
    provision.setDefaultKey('wrongkeypath')
      .then(function() {
        test.fail('keyNotPresent - wrongkeypath seams to exist');
      }).catch(function() {
        //console.log('test failed ?', fs.statSync.firstCall);
        test.equal(self.setDefaultKeySpy.callCount, 1);
        test.equal(fs.statSync.callCount, 1);
        test.equal(fs.statSync.firstCall.exception.code, 'ENOENT');
        test.done();
      });
  },

  validAlternateKey: function(test) {
    var self = this;
    test.expect(4);
    // Create folders for the folder that we'd like to
    createKeyTestFolder(function(err) {
      if (err) {
        console.log('createKeyTestFolder: ' + err);
        process.exit();
      }
      // Attempt to set up local keys
      // Generate SSH key
      var key = new NodeRSA({
        b: 2048
      });
      var privateKey = key.exportKey('private');
      var publicKey = sshpk.parseKey(key.exportKey('public'), 'pem').toString('ssh') + '\n';

      // Put SSH keys for Tessel in that folder
      // Set the permission to 0600 (decimal 384)
      // owner can read and write
      async.parallel([
          fs.writeFile.bind(this, testPath + '.pub', publicKey, {
            encoding: 'utf8',
            mode: 384
          }),
          fs.writeFile.bind(this, testPath, privateKey, {
            encoding: 'utf8',
            mode: 384
          }),
        ],
        function(err) {
          if (err) {
            console.log('parallel writer: ' + err);
            process.exit();
          }
          provision.setDefaultKey(testPath)
            .then(function() {
              fs.remove(testDir, function(err) {
                if (err) {
                  console.log('Error removing tmp directory: ' + err);
                  process.exit();
                }
                test.equal(self.setDefaultKeySpy.callCount, 1);
                test.equal(fs.statSync.callCount, 2);
                test.equal(fs.statSync.firstCall.exception, undefined);
                test.equal(fs.statSync.secondCall.exception, undefined);
                test.done();
              });
            }).catch(function() {
              test.fail('validAlternateKey - provision.setDefaultKey promize rejection');
            });
        });
    });
  }
};
