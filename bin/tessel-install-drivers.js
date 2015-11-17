#!/usr/bin/env node

var fs = require('fs');
var logs = require('../lib/logs');
var child_process = require('child_process');

module.exports.install = function() {
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
        logs.error('Error reloading udev');
        return code;
      } else {
        logs.info('Done. Unplug and re-plug Tessel to update permissions.');
        return code;
      }
    });
  } else {
    logs.info('No driver installation necessary.');
  }

};
