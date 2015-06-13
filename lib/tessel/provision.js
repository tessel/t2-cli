//creates a .tessel folder with ssh keys in your home directory and uses those ssh keys to authorize you to push code to the USB-connected Tessel

var osenv = require('osenv');
var fs = require('fs-extra');
var keygen = require('ssh-keygen');
var async = require('async');
var Tessel = require('./tessel');
var commands = require('./commands');
var logs = require('../logs');
var dir = osenv.home() + '/.tessel';
var filename = 'id_rsa';
var filepath = dir + '/' + filename;

Tessel.prototype.provisionTessel = function() {
  var self = this;
  if (self.connection.connectionType === 'USB') {
    // Check if local .tessel file has keypair, if not, put it there
    setupLocal(function() {
      // Authorize Tessel for SSH
      authTessel(self);
    });
  } else {
    logs.warn('Tessel must be connected with USB to use this command.');
    closeAndExit(self);
  }
};

// Make sure local computer is set up to authorize with Tessel
function setupLocal(callback) {
  // Check if keypair already in place
  if (!(fs.existsSync(filepath) && fs.existsSync(filepath + '.pub'))) {
    logs.info('Creating public and private keys for Tessel authentication...');

    // Generate SSH key
    keygen({}, function(err, out) {
      // Handle any errors that may have occurred
      if (Tessel._commonErrorHandler(err)) {
        return;
      }

      var privateKey = out.key;
      var publicKey = out.pubKey;

      // Make sure dir exists
      fs.ensureDir(dir, function(err) {
        // Handle any errors that may have occurred
        if (Tessel._commonErrorHandler(err)) {
          return;
        }

        function createKeyFile(filepath, key, successString, callback) {
          // Put SSH keys for Tessel in that folder
          fs.writeFile(filepath, key, {
            mode: '0600'
          }, function(err) {
            // Handle any errors that may have occurred
            if (Tessel._commonErrorHandler(err, callback)) {
              return;
            } else {
              if (typeof callback === 'function') {
                callback();
              }
            }
          });
        }

        // Put SSH keys for Tessel in that folder
        async.parallel([
            createKeyFile.bind(this, filepath + '.pub', publicKey, 'Public key written'),
            createKeyFile.bind(this, filepath, privateKey, 'Private key written')
          ],
          function(err) {
            // Handle any errors that may have occurred
            if (Tessel._commonErrorHandler(err, callback)) {
              return;
            } else {
              if (typeof callback === 'function') {
                callback(null, true);
              }
            }
          });
      });
    });
  } else {
    if (typeof callback === 'function') {
      callback(null, false);
    }
  }
}

// Put the specified SSH key in Tessel's auth file
function authTessel(tessel) {
  logs.info('Authenticating Tessel with public key...');

  var authFile = '/etc/dropbear/authorized_keys';

  // Make sure Tessel has the authFile
  checkAuthFileExists(tessel, authFile, function() {
    // Read the public key
    fs.readFile(filepath + '.pub', {
      encoding: 'utf-8'
    }, function(err, pubKey) {
      // See if the public key is already in the authFile
      checkIfKeyInFile(tessel, authFile, pubKey, function() {
        // Copy pubKey into authFile
        copyKey(tessel, authFile, pubKey);
      });
    });
  });
}

function checkAuthFileExists(tessel, authFile, callback) {
  tessel.connection.exec(commands.ensureFileExists(authFile), function(err, remoteProc) {
    remoteProc.stderr.pipe(process.stderr);
    if (typeof callback === 'function') {
      remoteProc.once('close', callback);
    }
  });
}

function checkIfKeyInFile(tessel, authFile, pubKey, callback) {
  var tempData = '';
  tessel.connection.exec(commands.readFile(authFile), function(err, remoteProc) {
    // Handle any errors that may have occurred
    if (Tessel._commonErrorHandler(err)) {
      return;
    }
    // If Tessel has an error, print it
    remoteProc.stderr.pipe(process.stderr);
    // When we get data
    remoteProc.stdout.on('data', function(data) {
      tempData += data;
    });
    remoteProc.once('close', function() {
      if (tempData.indexOf(pubKey) > -1) {
        logs.info('Tessel is already authenticated with this computer.');
        closeAndExit(tessel);
      } else {
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  });
}

function copyKey(tessel, authFile, pubKey) {
  tessel.connection.exec(commands.appendStdinToFile(authFile), function(err, remoteProc) {
    // Handle any errors that may have occurred
    if (Tessel._commonErrorHandler(err)) {
      return;
    }
    // Handle the end of the stream
    remoteProc.once('close', function() {
      logs.info('Tessel authenticated with public key.');
      // Close the connection
      closeAndExit(tessel);
    });
    // If Tessel has an error, print it
    remoteProc.stderr.pipe(process.stderr);
    // Send the key
    remoteProc.stdin.end(pubKey);
  });
}

function closeAndExit(tessel) {
  tessel.connection.end(function() {
    process.exit(0);
  });
}

module.exports.setupLocal = setupLocal;
