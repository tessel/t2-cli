#!/usr/bin/env node

'use strict';

// System Objects
var child_process = require('child_process');
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');
var osenv = require('osenv');

// Internal
var log = require('./log');

module.exports.drivers = function() {
  return new Promise((resolve, reject) => {
    if (process.platform === 'linux') {
      // --loglevel may be at "error" for npm postinstall script.
      // if it's relevant, set the loglevel to info
      log.level('info');

      var tesselRules = '85-tessel.rules';
      var source = path.posix.join(__dirname, '/../resources/', tesselRules);
      var dest = `/etc/udev/rules.d/${tesselRules}`;

      try {
        fs.copySync(source, dest);
      } catch (e) {
        if (e.code === 'EACCES') {
          log.error(`Could not write to ${dest}`);
          log.info('Run "sudo t2 install drivers"');
          return reject(-1);
        } else {
          return reject(e);
        }
      }
      log.info(`udev rules installed to ${dest}`);


      var udevadm = child_process.spawn('udevadm', ['control', '--reload-rules']);
      udevadm.on('close', (code) => {
        if (code !== 0) {
          log.error('Error reloading udev');
          return reject(code);
        } else {
          log.info('Done. Unplug and re-plug Tessel to update permissions.');
          return resolve(code);
        }
      });
    } else {
      log.info('No driver installation necessary.');
      return resolve();
    }
  });
};

module.exports.homedir = function() {
  var userTesselDirectory = path.join(osenv.home(), '.tessel');
  var preferencesJson = path.join(userTesselDirectory, 'preferences.json');

  return new Promise((resolve, reject) => {

    fs.ensureDir(userTesselDirectory, error => {
      if (error) {
        return reject(error);
      }
      log.info('Home directory verified.');
      fs.ensureFile(preferencesJson, error => {
        if (error) {
          return reject(error);
        }
        fs.readJson(preferencesJson, (error, contents) => {
          let operation = 'verified';
          if (error || contents === undefined) {
            contents = {};
            operation = 'initialized';
          }

          fs.outputJson(preferencesJson, contents, error => {
            if (error) {
              return reject(error);
            }
            log.info(`Preferences ${operation}.`);
            return resolve();
          });
        });
      });
    });
  });
};
