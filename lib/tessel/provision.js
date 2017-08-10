//creates a .tessel folder with ssh keys in your home directory and uses those ssh keys to authorize you to push code to the USB-connected Tessel


// System Objects
var path = require('path');
var util = require('util');

// Third Party Dependencies
var async = require('async');
var fs = require('fs-extra');
var osenv = require('osenv');
var sshpk = require('sshpk');

// Internal
var commands = require('./commands');
var log = require('../log');
var RSA = require('./rsa-delegation');
var Tessel = require('./tessel');


var authPath = path.join(osenv.home(), '.tessel');
var idrsa = 'id_rsa';
var authKey = path.join(authPath, idrsa);
var remoteAuthFile = '/etc/dropbear/authorized_keys';
var configurable = true;

Object.defineProperty(Tessel, 'LOCAL_AUTH_KEY', {
  configurable,
  get: function() {
    return authKey;
  },
  set: function(value) {
    authKey = value;
    authPath = path.dirname(authKey);
  }
});

Object.defineProperty(Tessel, 'LOCAL_AUTH_PATH', {
  configurable,
  get: function() {
    return authPath;
  },
  set: function(value) {
    authPath = value;
    authKey = path.join(authPath, idrsa);
  }
});

Tessel.isProvisioned = function() {
  return fs.existsSync(authKey) && fs.existsSync(authKey + '.pub');
};

Tessel.prototype.provisionTessel = function() {
  if (this.connection.connectionType !== 'USB') {
    return Promise.reject('Tessel must be connected with USB to use this command.');
  }

  // Check if local .tessel file has keypair, if not, put it there
  return actions.setupLocal(authKey).then(() => {
    return actions.authTessel(this, authKey)
      .catch(function(err) {
        if (err instanceof AlreadyAuthenticatedError) {
          log.info(err.message);
        } else {
          throw err;
        }
      });
  });
};

var actions = {};

// Make sure local computer is set up to authorize with Tessel
actions.setupLocal = function(keyFile) {

  if (!keyFile || typeof keyFile !== 'string') {
    keyFile = authKey;
  }

  return new Promise(function(resolve, reject) {

    if (Tessel.isProvisioned()) {
      return resolve();
    }

    log.info('Creating public and private keys for Tessel authentication...');

    // Generate SSH key
    var key = new RSA({
      b: 2048
    });
    var privateKey = key.exportKey('private');
    var publicKey = sshpk.parseKey(key.exportKey('public'), 'pem').toString('ssh') + '\n';

    // Make sure dir exists
    fs.ensureDir(path.dirname(keyFile), function(err) {
      if (err) {
        return reject(err);
      }

      // Put SSH keys for Tessel in that folder
      // Set the permission to 0600 (decimal 384)
      // owner can read and write
      var fileOptions = {
        encoding: 'utf8',
        mode: 0o600,
      };
      async.parallel([
          (cb) => fs.writeFile(keyFile + '.pub', publicKey, fileOptions, cb), (cb) => fs.writeFile(keyFile, privateKey, fileOptions, cb),
        ],
        (err) => {
          if (err) {
            return reject(err);
          }
          log.info('SSH Keys written.');
          resolve();
        });
    });
  });
};

// Put the specified SSH key in Tessel's auth file
actions.authTessel = function(tessel, filepath) {
  return new Promise(function(resolve, reject) {
    log.info('Authenticating Tessel with public key...');
    // Make sure Tessel has the authFile
    actions.checkAuthFileExists(tessel, remoteAuthFile)
      .then(function readKey() {
        // Read the public key
        fs.readFile(filepath + '.pub', 'utf8', (err, pubKey) => {
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
};

actions.checkAuthFileExists = function(tessel, authFile) {
  // Ensure that the remote authorized_keys file exists
  return tessel.simpleExec(commands.ensureFileExists(authFile));
};

actions.setDefaultKey = function(keyPath) {
  return new Promise(function(resolve, reject) {

    if (!keyPath) {
      return reject(new Error('No key provided to set as default.'));
    }

    if (typeof keyPath !== 'string') {
      return reject(new Error('SSH key path must be a string type.'));
    }
    // If this is not being running through CI tests and the file path
    // requested doesn't exist we need to reject
    if (!fs.statSync(keyPath).isFile() ||
      !fs.statSync(keyPath + '.pub').isFile()) {
      return reject(new Error(keyPath + ' does not contain valid public and private SSH keys.'));
    }

    // All checks pass... set the new key path
    Tessel.LOCAL_AUTH_KEY = keyPath;

    return resolve();
  });
};

function checkIfKeyInFile(tessel, authFile, pubKey) {
  return new Promise(function(resolve, reject) {
    // Read the public keys from the auth file
    return tessel.simpleExec(commands.readFile(authFile))
      .then(function fileRead(fileContents) {
        // If keys on the remote device contain our key
        if (fileContents.indexOf(pubKey) > -1) {
          // Report that the key already exists
          return reject(new AlreadyAuthenticatedError());
        }
        // Otherwise, the key needs to be added
        else {
          return resolve();
        }
      });
  });
}

function copyKey(tessel, authFile, pubKey) {
  return new Promise(function(resolve, reject) {
    // Open up stdin to the authorized_keys file
    tessel.connection.exec(commands.appendStdinToFile(authFile), (err, remoteProcess) => {
      if (err) {
        return reject(err);
      }
      remoteProcess.once('close', () => {
        // Everything worked as expected
        log.info('Tessel authenticated with public key.');
        // End the process
        return resolve();
      });

      // Send the key
      remoteProcess.stdin.end(pubKey);
    });
  });
}

function AlreadyAuthenticatedError() {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = 'Tessel is already authenticated with this computer.';
}

util.inherits(AlreadyAuthenticatedError, Error);

actions.AlreadyAuthenticatedError = AlreadyAuthenticatedError;
module.exports = actions;
