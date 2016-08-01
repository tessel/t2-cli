// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var Tessel = require('./tessel');
var update = require('../update-fetch');
var log = require('../log');
var flash = require('../flash');

Tessel.prototype.restore = function restore () {
  var usbConnection = this.connection;
  return new Promise((resolve, reject) => {

    log.info('Proceeding with updating OpenWrt...');

    // download images
    return update
      .fetchRestore()
      .then((result) => {
        flash(usbConnection, result.uboot, result.squashfs)
          .then(resolve)
          .catch(reject)
      });
  });
};
