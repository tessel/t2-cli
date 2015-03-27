var osenv = require('osenv');
var fs = require('fs-extra');
var exec = require('child_process').exec, child;

var dir = osenv.home() + '/.tessel';
var filename = 'id_rsa';
var filepath = dir + '/' + filename;

function setup (opts) {
  fs.readFile(filepath + '.pub', {encoding: 'utf-8'}, function (err, data) {
    authTessel(data);
  });
}

// Put the SSH key from the dir in Tessel's /etc/dropbear/authorized_keys
function authTessel (pubKey) {
  console.log('Authenticating Tessel with public key...');

  var sourceFile = 'package.json'
  // var sourceFile = filepath + '.pub';
  var authFile = 'myTestDir/doc'
  // var authFile = '/etc/dropbear/authorized_keys';

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

module.exports.setup = setup;
