var fs = require('fs-extra');
var keypair = require('keypair');

var dir = '~/.tessel';
var filename = 'id_rsa';

// If keypair doesn't already exist...
// TODO: fs.exists is going to be deprecated, what's a better way to do this?
if(!(fs.existsSync(dir + '/' + filename) && fs.existsSync(dir + '/' + filename + '.pub'))) {
  console.log('no')
  // Make sure dir exists
  // TODO: what does this need to be on other systems?
  fs.ensureDir(dir, function (err) {
    err && console.log(err);

    // Generate SSH key
    var pair = keypair();

    // Put SSH key for Tessel in that folder
    fs.writeFile(dir + '/' + filename + '.pub', pair.public, function (err) {
      err && console.log(err);
      console.log('Public key written.');
    });
    fs.writeFile(dir + '/' + filename, pair.private, function (err) {
      err && console.log(err);
      console.log('Private key written.');
    });
  });
} else {
  console.log('already exists')
}
// Put the SSH key from the dir in Tessel's /etc/dropbear/authorized_keys
