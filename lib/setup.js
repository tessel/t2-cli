var osenv = require('osenv');
var fs = require('fs-extra');
var exec = require('child_process').exec, child;

var dir = osenv.home() + '/.tessel';
var filename = 'id_rsa';
var filepath = dir + '/' + filename;

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
  var command = 'dd if=' + sourceFile + ' of=' + authFile + ' conv=notrunc oflag=append';
  var child = exec(command, function (err, stdout, stderr) {
    err && console.log(err);
    stdout && console.log(stdout);
    stderr && console.log(stderr);
    if(!err && !stderr) {
      console.log('Tessel authenticated with public key.');
    }
  })
}

// Sets the hostname of the Tessel
function setHostname (name) {
  // Any security we need to do surrounding hostnames?
  var commands = "uci set system.@system[0].hostname=" + name + "; uci commit system; echo $(uci get system.@system[0].hostname) > /proc/sys/kernel/hostname";
  // TODO: Execute the commands
}

module.exports.setup = setup;
