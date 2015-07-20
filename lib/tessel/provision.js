//creates a .tessel folder with ssh keys in your home directory and uses those ssh keys to authorize you to push code to the USB-connected Tessel

var osenv = require('osenv');
var fs = require('fs-extra');
var path = require('path');
var keygen = require('ssh-keygen');
var async = require('async');
var Tessel = require('./tessel');
var commands = require('./commands');
var logs = require('../logs');
var directory = path.join(osenv.home(), '.tessel');
var filename = 'id_rsa';
var filepath = path.join(directory, filename);
var remoteAuthFile = '/etc/dropbear/authorized_keys';

Object.defineProperty(Tessel, 'TESSEL_AUTH_PATH', {
  get: function() {
    return directory;
  },
  set: function(value) {
    directory = value;
    filepath = path.join(directory, filename);
  }
});

Tessel.isProvisioned = function() {
  return fs.existsSync(filepath) && fs.existsSync(filepath + '.pub');
};

Tessel.prototype.provisionTessel = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (self.connection.connectionType === 'USB') {
      // Check if local .tessel file has keypair, if not, put it there
      return setupLocal(filepath)
        .then(function() {
          return authTessel(self, filepath)
            .then(function() {
              resolve();
            });
        });
    } else {
      reject('Tessel must be connected with USB to use this command.');
    }
  });
};

// Make sure local computer is set up to authorize with Tessel
function setupLocal(keyPath) {

  if (!keyPath || typeof keyPath !== 'string') {
    keyPath = filepath;
  }

  return new Promise(function(resolve, reject) {
    logs.info('Creating public and private keys for Tessel authentication...');
    // Generate SSH key
    keygen({}, function(err, out) {
      if (err) {
        return reject(err);
      }

      var privateKey = out.key;
      var publicKey = out.pubKey;

      // Make sure dir exists
      fs.ensureDir(path.dirname(keyPath), function(err) {
        if (err) {
          return reject(err);
        }

        // Put SSH keys for Tessel in that folder
        // Set the permission to 0600 (decimal 384)
        // owner can read and write
        async.parallel([
            fs.writeFile.bind(this, keyPath + '.pub', publicKey, {
              encoding: 'utf8',
              mode: 384
            }),
            fs.writeFile.bind(this, keyPath, privateKey, {
              encoding: 'utf8',
              mode: 384
            }),
          ],
          function(err) {
            if (err) {
              return reject(err);
            }

            logs.info('SSH Keys written.');
            resolve();
          });
      });
    });
  });
}

// Put the specified SSH key in Tessel's auth file
function authTessel(tessel, filepath) {
  return new Promise(function(resolve, reject) {
    logs.info('Authenticating Tessel with public key...');
    // Make sure Tessel has the authFile
    checkAuthFileExists(tessel, remoteAuthFile)
      .then(function readKey() {
        // Read the public key
        fs.readFile(filepath + '.pub', {
          encoding: 'utf-8'
        }, function(err, pubKey) {
          if (err) {
            return reject(err);
          }

          // See if the public key is already in the authFile
          return checkIfKeyInFile(tessel, remoteAuthFile, pubKey)
            .then(function keyNotInFile() {
              // Copy pubKey into authFile
              return copyKey(tessel, remoteAuthFile, pubKey)
                .then(resolve);
            })
            .catch(reject);
        });
      });
  });
}

function checkAuthFileExists(tessel, authFile) {
  return new Promise(function(resolve, reject) {
    // Ensure that the remote authorized_keys file exists
    return tessel.connection.exec(commands.ensureFileExists(authFile))
      .then(function(remoteProc) {

        // Var to store incoming error data
        var errBuf = '';

        // If we get incoming data
        remoteProc.stderr.on('data', function(data) {
          // Concat it
          errBuf += data.toString();
        });

        // Once this process completes
        remoteProc.once('close', function() {
          // Check if there was an error
          if (errBuf.length) {
            // If there was, report it
            reject(errBuf);
          }
          // Otherwise, continue
          else {
            resolve();
          }
        });
      });
  });
}

function checkIfKeyInFile(tessel, authFile, pubKey) {
  return new Promise(function(resolve, reject) {
    // Read the public keys from the auth file
    return tessel.connection.exec(commands.readFile(authFile))
      .then(function(remoteProc) {
        // Var to hold pub key data
        var dataBuf = '';
        // Var to hold any emitted errors
        var errBuf = '';

        // When stderr data is returned
        remoteProc.stderr.on('data', function(err) {
          // concat it until the process closes
          errBuf += err.toString();
        });

        // When we get data
        remoteProc.stdout.on('data', function(data) {
          // concat it until the process closes
          dataBuf += data.toString();
        });

        // Whenthe process closes
        remoteProc.once('close', function() {
          // Check if an error was reported
          if (errBuf.length) {
            return reject(errBuf);
          }
          // If there were no errors
          else {
            // If keys on the remote device contain our key
            if (dataBuf.indexOf(pubKey) > -1) {
              // Report that the key already exists
              return reject('Tessel is already authenticated with this computer.');
            }
            // Otherwise, the key needs to be added
            else {
              return resolve();
            }
          }
        });
      });
  });
}

function copyKey(tessel, authFile, pubKey) {
  return new Promise(function(resolve, reject) {
    // Open up stdin to the authorized_keys file
    return tessel.connection.exec(commands.appendStdinToFile(authFile))
      .then(function(remoteProc) {
        // Var to concat error data
        var errBuf = '';
        // If error data comes in
        remoteProc.stderr.on('data', function(err) {
          // Save it
          errBuf += err.toString();
        });
        // Handle the end of the stream
        remoteProc.once('close', function() {
          // If errors were logged
          if (errBuf.length) {
            // Report the failure
            return reject(errBuf);
          } else {
            // Everything worked as expected
            logs.info('Tessel authenticated with public key.');
            // End the process
            return resolve();
          }
        });

        // Send the key
        remoteProc.stdin.end(pubKey);
      });
  });
}

module.exports.setupLocal = setupLocal;
module.exports.authTessel = authTessel;
module.exports.checkAuthFileExists = checkAuthFileExists;
