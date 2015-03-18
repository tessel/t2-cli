var osenv = require('osenv');
var fs = require('fs-extra');
var keypair = require('keypair');

var dir = osenv.home() + '/.tessel';
var filename = 'id_rsa';
var filepath = dir + '/' + filename;

// If keypair doesn't already exist.
// TODO: fs.exists is going to be deprecated, what's a better way to do this?
if(!(fs.existsSync(filepath) && fs.existsSync(filepath + '.pub'))) {
  console.log('Creating public and private keys for Tessel authentication...');

  // Generate SSH key
  var pair = keypair();

  // Make sure dir exists
  fs.ensureDir(dir, function (err) {
    err && console.log(err);

    // Put SSH key for Tessel in that folder
    var pubReady = false;
    var privReady = false;
    fs.writeFile(filepath + '.pub', pair.public, function (err) {
      err && console.log(err);
      console.log('Public key written.');
      pubReady = true;
      if (pubReady & privReady) {
        authTessel();
      }
    });
    fs.writeFile(filepath, pair.private, function (err) {
      err && console.log(err);
      console.log('Private key written.');
      privReady = true;
      if (pubReady & privReady) {
        authTessel();
      }
    });
  });
} else {
  authTessel();
}

// Put the SSH key from the dir in Tessel's /etc/dropbear/authorized_keys
function authTessel (pubKey) {
  console.log('Authenticating Tessel with public key...')
}
