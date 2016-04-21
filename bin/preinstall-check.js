#!/usr/bin/env node

var os = require('os');
var exec = require('child_process').exec;

function mdnsInstall () {
  exec('npm install mdns', function (error) {
    if (error) {
      throw error;
    }

    process.exit(0);
  });
}

const type = os.type();
console.log(type);

if (type === 'Linux') {
  exec('apt-get update && apt-get install -y libavahi-compat-libdnssd-dev', function (error) {
    if (error) {
      throw error;
    }

    mdnsInstall();
  });
} else if (type === 'Darwin') {
  mdnsInstall();
} else {
  process.exit(0);
}

