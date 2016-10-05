// System Objects
// ...

// Third Party Dependencies
var fs = require('fs-extra');
var path = require('path');
var osenv = require('osenv');

// Internal
var commands = require('./commands');
var Tessel = require('./tessel');
var sdk = require('../sdk');

/*
 Installs SDK
 */
Tessel.installSdk = function() {
  return sdk.installSdk()
  .then(() => sdk.installRustlib().catch(e => {
    console.error('WARN', e.message);
    console.error('WARN Continuing with SDK installation...');
  }))
  .then(() => sdk.installRustTarget())
  .then(() => {
    console.log('SDK installed.');
  })
};

/*
 Removes SDK
 */
Tessel.removeSdk = function() {
  return new Promise((resolve, reject) => {
    fs.remove(path.join(osenv.home(), '.tessel/rust'), function () {
      fs.remove(path.join(osenv.home(), '.tessel/sdk'), function () {
        console.log('Tessel SDK uninstalled.');
        resolve();
      });
    });
  });
};
