var osenv = require('osenv');
var fs = require('fs-extra');
var keypair = require('keypair');
var pemToRsaSSHKey = require('ssh-key-to-pem').pemToRsaSSHKey;
var controller = require('./controller');
var commands = require('./tessel/commands');

var dir = osenv.home() + '/.tessel';
// var filename = 'id_rsa' TODO:delete the testing line
var filename = 'id_rsaTest';
var filepath = dir + '/' + filename;

var tessel;

function setup (opts) {
  // Check if local .tessel file has keypair, if not, put it there
  setupLocal(function () {
    // Get the Tessel object
    console.log('Getting Tessel...')
    controller.getTessel({}, function (err, Tessel) {
      if(err) {
        console.log(err);
      } else {
        console.log('Tessel acquired.')
        tessel = Tessel;

        // Authorize Tessel for SSH
        authTessel(tessel);

        // If name specified, set hostname
        if(opts.name) {
          setHostname(opts._[1], tessel)
        }
      }
    });
  });
}

// Make sure local computer is set up to authorize with Tessel
function setupLocal (callback) {
  // Check if keypair already in place
  // TODO: fs.exists is going to be deprecated, what's a better way to do this?
  if(!(fs.existsSync(filepath) && fs.existsSync(filepath + '.pub'))) {
    console.log('Creating public and private keys for Tessel authentication...');

    // Generate SSH key
    var pair = keypair();
    console.log(pair)
    console.log(pemToRsaSSHKey(pair.public))

    // Make sure dir exists
    fs.ensureDir(dir, function (err) {
      err && console.log(err);

      // Put SSH keys for Tessel in that folder
      fs.writeFile(filepath + '.pub', pair.public, function (err) {
        err && console.log(err);
        console.log('Public key written.');
      });
      fs.writeFile(filepath, pair.private, function (err) {
        err && console.log(err);
        console.log('Private key written.');
      });
      callback && callback();
    });
  } else {
    callback && callback();
  }
}

// Put the specified SSH key in Tessel's auth file
function authTessel (tessel) {
  console.log('Authenticating Tessel with public key...');

  var sourceFile = filepath + '.pub';
  var authFile = '/etc/dropbear/authorized_keys';

  // Read the public key
  fs.readFile(filepath + '.pub', {encoding: 'utf-8'}, function (err, pubKey) {
    // Copy pubKey into authFile
    // TODO something is screwy here because we're bypassing the pubKey we just got
    tessel.connection.exec(commands.appendFile(sourceFile, authFile), function (err, streams) {
      err && console.log(err);
      streams.stderr.pipe(process.stderr);
      streams.stdout.pipe(process.stdout);
      if(!err) {
        console.log('Tessel authenticated with public key.');
      }
    });
  });
}

// Sets the hostname of the Tessel
function setHostname (name, tessel) {
  // TODO: Any security we need to do surrounding hostnames?
  console.log('Setting hostname of Tessel to ' + name + '...');
  tessel.connection.exec(commands.setHostname(name), function (err, streams) {
    err && console.log(err);
    streams.stderr.pipe(process.stderr);
    streams.stdout.pipe(process.stdout);
    if (!err) {
      console.log('Hostname of Tessel set to ' + name);
    }
  });
}

module.exports.setup = setup;
