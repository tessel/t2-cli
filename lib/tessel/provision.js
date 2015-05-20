//creates a .tessel folder with ssh keys in your home directory and uses those ssh keys to authorize you to push code to the USB-connected Tessel

var osenv = require('osenv');
var fs = require('fs-extra');
var keygen = require('ssh-keygen');

var Tessel = require('./tessel');
var commands = require('./commands');

var dir = osenv.home() + '/.tessel';
var filename = 'id_rsa';
var filepath = dir + '/' + filename;

Tessel.prototype.provisionTessel = function () {
  var self = this;
  if(self.connection.connectionType == "USB") {
    // Check if local .tessel file has keypair, if not, put it there
    setupLocal(function () {
      // Authorize Tessel for SSH
      authTessel(self);
    });
  } else {
    console.warn('Tessel must be connected with USB to use this command.');
    closeAndExit(self);
  }
};

// Make sure local computer is set up to authorize with Tessel
function setupLocal (callback) {
  // Check if keypair already in place
  if(!(fs.existsSync(filepath) && fs.existsSync(filepath + '.pub'))) {
    console.log('Creating public and private keys for Tessel authentication...');

    // Generate SSH key
    keygen({}, function(err, out){
      if(err) return console.log('Something went wrong: '+err);
      var privateKey = out.key;
      var publicKey = out.pubKey;

      // Make sure dir exists
      fs.ensureDir(dir, function (err) {
        err && console.log(err);

        var filesWritten = 0;

        // Put SSH keys for Tessel in that folder
        fs.writeFile(filepath + '.pub', publicKey, function (err) {
          err && console.log(err);
          fs.chmodSync(filepath + '.pub', '600');
          console.log('Public key written.');
          filesWritten++;
          if (filesWritten == 2) {
            callback && callback(null, true);
          }
        });
        fs.writeFile(filepath, privateKey, function (err) {
          err && console.log(err);
          fs.chmodSync(filepath, '600');
          console.log('Private key written.');
          filesWritten++;
          if (filesWritten == 2) {
            callback && callback(null, true);
          }
        });
      });
    });
  } else {
    callback && callback(null, false);
  }
}

// Put the specified SSH key in Tessel's auth file
function authTessel (tessel) {
  console.log('Authenticating Tessel with public key...');

  var authFile = '/etc/dropbear/authorized_keys';

  // Make sure Tessel has the authFile
  checkAuthFileExists(tessel, authFile, function () {
    // Read the public key
    fs.readFile(filepath + '.pub', {encoding: 'utf-8'}, function (err, pubKey) {
      // See if the public key is already in the authFile
      checkIfKeyInFile(tessel, authFile, pubKey, function () {
        // Copy pubKey into authFile
        copyKey(tessel, authFile, pubKey);
      });
    });
  });
}

function checkAuthFileExists (tessel, authFile, callback) {
  tessel.connection.exec(commands.ensureFileExists(authFile), function (err, remoteProc) {
    remoteProc.stderr.pipe(process.stderr);
    remoteProc.once('close', function () {
      callback && callback();
    });
  });
}

function checkIfKeyInFile (tessel, authFile, pubKey, callback) {
  var tempData = '';
  tessel.connection.exec(commands.readFile(authFile), function (err, remoteProc) {
    err && console.log(err);
    // If Tessel has an error, print it
    remoteProc.stderr.pipe(process.stderr);
    // When we get data
    remoteProc.stdout.on('data', function (data) {
      tempData += data;
    });
    remoteProc.once('close', function () {
      if(tempData.indexOf(pubKey) > -1) {
        console.log('Tessel is already authenticated with this computer.');
        closeAndExit(tessel);
      } else {
        callback && callback();
      }
    });
  });
}

function copyKey (tessel, authFile, pubKey) {
  tessel.connection.exec(commands.appendStdinToFile(authFile), function (err, remoteProc) {
    err && console.log(err);
    // Handle the end of the stream
    remoteProc.once('close', function () {
      console.log('Tessel authenticated with public key.');
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
  tessel.connection.end(function () {
    process.exit(0);
  });
}

module.exports.setupLocal = setupLocal;
