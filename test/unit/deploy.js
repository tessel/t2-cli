var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var TesselSimulator = require('../common/tessel-simulator');
var tesselClassic = require('../common/tessel-classic');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var deployFolder = path.join(__dirname, 'tmp');
var deployFile = path.join(deployFolder, 'app.js');
var codeContents = 'console.log(\'testing deploy\');';
var rimraf = require('rimraf');

exports['Tessel.prototype.deployScript'] = {
  setUp: function(done) {
    this.deployScript = sinon.spy(Tessel.prototype, 'deployScript');
    this.stopRunningScript = sinon.spy(commands, 'stopRunningScript');
    this.deleteFolder = sinon.spy(commands, 'deleteFolder');
    this.createFolder = sinon.spy(commands, 'createFolder');
    this.untarStdin = sinon.spy(commands, 'untarStdin');
    this.runScript = sinon.spy(commands, 'runScript');
    this.openStdinToFile = sinon.spy(commands, 'openStdinToFile');
    this.setExecutablePermissions = sinon.spy(commands, 'setExecutablePermissions');
    this.startPushedScript = sinon.spy(commands, 'startPushedScript');

    this.analyzeScript = sinon.spy(tesselClassic, 'analyzeScript');
    this.tarCode = sinon.spy(tesselClassic, 'tarCode');

    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});

    this.tessel = TesselSimulator();

    deleteTemporaryDeployCode()
      .then(done);
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.deployScript.restore();
    this.stopRunningScript.restore();
    this.deleteFolder.restore();
    this.createFolder.restore();
    this.untarStdin.restore();
    this.runScript.restore();
    this.openStdinToFile.restore();
    this.setExecutablePermissions.restore();
    this.startPushedScript.restore();

    this.analyzeScript.restore();
    this.tarCode.restore();

    this.logsWarn.restore();
    this.logsInfo.restore();
    deleteTemporaryDeployCode()
      .then(done)
      .catch(function(err) {
        throw err;
      });
  },

  runScript: function(test) {
    var self = this;
    test.expect(9);
    deployTestCode(self.tessel, test, false, function deployed(err) {
      test.ifError(err);
      test.equal(self.stopRunningScript.callCount, 1);
      test.equal(self.deleteFolder.callCount, 1);
      test.equal(self.createFolder.callCount, 1);
      test.equal(self.untarStdin.callCount, 1);
      test.equal(self.runScript.callCount, 1);
      test.equal(self.openStdinToFile.callCount, 0);
      test.equal(self.setExecutablePermissions.callCount, 0);
      test.equal(self.startPushedScript.callCount, 0);
      test.done();
    });
  },

  pushScript: function(test) {
    var self = this;
    test.expect(9);
    deployTestCode(self.tessel, test, true, function deployed(err) {
      test.ifError(err);
      test.equal(self.stopRunningScript.callCount, 1);
      test.equal(self.deleteFolder.callCount, 1);
      test.equal(self.createFolder.callCount, 1);
      test.equal(self.untarStdin.callCount, 1);
      test.equal(self.runScript.callCount, 0);
      test.equal(self.openStdinToFile.callCount, 1);
      test.equal(self.setExecutablePermissions.callCount, 1);
      test.equal(self.startPushedScript.callCount, 1);
      test.done();
    });
  },

  deployBadFolder: function(test) {
    var self = this;

    test.expect(9);

    function closeAdvance(event) {
      if (event === 'close') {
        setImmediate(function() {
          // Emit the close event to keep it going
          self.tessel._rps.emit('close');
        });
      }
    }

    // When we get a listener that the Tessel process needs to close before advancing
    self.tessel._rps.on('newListener', closeAdvance);

    // Actually deploy the script (but we didn't create the deploy folder in the first place)
    self.tessel.deployScript({
        entryPoint: 'fail.js'
      }, false)
      // If it finishes, it was successful
      .then(function success() {
        self.tessel._rps.removeListener('newListener', closeAdvance);
        test.equal(false, true, 'An error should have been thrown because a non-existent directory was provided');
      })
      // If not, there was an issue
      .catch(function(err) {
        test.ok(err);
        test.equal(self.stopRunningScript.callCount, 1);
        test.equal(self.deleteFolder.callCount, 1);
        test.equal(self.createFolder.callCount, 1);
        test.equal(self.untarStdin.callCount, 1);
        test.equal(self.runScript.callCount, 0);
        test.equal(self.openStdinToFile.callCount, 0);
        test.equal(self.setExecutablePermissions.callCount, 0);
        test.equal(self.startPushedScript.callCount, 0);
        test.done();
      });
  }
};

function deployTestCode(tessel, test, push, callback) {

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
          entryPoint: path.relative(process.cwd(), deployFile)
        }, push)
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
