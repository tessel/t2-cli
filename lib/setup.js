var osenv = require('osenv');
var fs = require('fs-extra');
var controller = require('./controller');

var dir = osenv.home() + '/.tessel';
var filename = 'id_rsa';
var filepath = dir + '/' + filename;

// Get the Tessel object
// TODO this way potentially introduces a race condition
var tessel;
controller.getTessel(function (err, Tessel) {
  if(err) {
    console.log(err);
  }
  tessel = Tessel;
});

function setup (opts) {
  // If name specified, set hostname
  if(opts.name) {
    setHostname(opts._[1])
  }
  // Read the public key and copy it to the Tessel
  fs.readFile(filepath + '.pub', {encoding: 'utf-8'}, function (err, data) {
    authTessel(data);
  });
}

// Put the specified SSH key in Tessel's auth file
function authTessel (pubKey) {
  console.log('Authenticating Tessel with public key...');

  var sourceFile = filepath + '.pub';
  var authFile = '/etc/dropbear/authorized_keys';

  // Copy pubKey into authFile
  tessel.connection.exec(commands.appendFile(sourceFile, authFile), function (err, streams) {
    err && console.log(err);
    streams.stderr && console.log(streams.stderr);
    if(!err && !streams.stderr) {
      console.log('Tessel authenticated with public key.');
    }
  });
}

// Sets the hostname of the Tessel
function setHostname (name) {
  // TODO: Any security we need to do surrounding hostnames?
  tessel.connection.exec(commands.setHostname(name), function (err, streams) {
    err && console.log(err);
    streams.stderr && console.log(streams.stderr);
    if (!err && !streams.stderr) {
      console.log('Hostname of Tessel set to ' + name);
    }
  });
}

module.exports.setup = setup;
