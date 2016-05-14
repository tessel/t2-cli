#!/usr/bin/env node

// System Objects
var child_process = require('child_process');
var fs = require('fs');

// Third Party Dependencies
// ...

// Internal
var logs = require('../lib/logs');

function mdnsInstall(resolve, reject) {
  child_process.exec('npm install mdns', function(error) {
    if (error) {
      return reject(error);
    }

    return resolve();
  });
}

module.exports.install = function() {
  return new Promise(function(resolve, reject) {
    if (process.platform === 'linux') {
      var rules_name = '85-tessel.rules';
      var dest = '/etc/udev/rules.d/' + rules_name;
      var rules = fs.readFileSync(__dirname + '/../resources/' + rules_name);

      try {
        fs.writeFileSync(dest, rules);
      } catch (e) {
        if (e.code === 'EACCES') {
          logs.info('Could not write to ' + dest);
          logs.info('Run `sudo t2 install-drivers`');
          return -1;
        } else {
          throw e;
        }
      }
      logs.info('udev rules installed to ' + dest);


      var udevadm = child_process.spawn('udevadm', ['control', '--reload-rules']);
      udevadm.on('close', function(code) {
        if (code !== 0) {
          logs.err('Error reloading udev');
          return reject(code);
        } else {
          logs.info('Done. Unplug and re-plug Tessel to update permissions.');
          return resolve(code);
        }
      });
    } else {
      logs.info('No usb driver installation necessary.');
      return resolve();
    }
  });
};

module.exports.installMDNS = () => new Promise((resolve, reject) => {
  if (process.platform === 'linux') {
    child_process.exec('apt-get install -y libavahi-compat-libdnssd-dev', (error) => {
      if (error) {
        if (error.code === 'EACCES') {
          logs.info('Could not install "libavahi-compat-libdnssd-dev" for mDNS discovery');
          logs.info('Run `sudo t2 install-drivers`');
          return -1;
        } else {
          throw error;
        }
      }

      return mdnsInstall(resolve, reject);
    });
  } else if (process.platform === 'darwin') {
    return mdnsInstall(resolve, reject);
  }
});
