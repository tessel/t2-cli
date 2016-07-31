var Tessel = require('./tessel');
var update = require('../update-fetch');
var log = require('../log');
var flash = require('../flash');

Tessel.prototype.restore = function restore(opts) {
  var usbConnection = this.connection;
  return new Promise(function(resolve, reject) {
    if (opts.openwrt) {
      log.info('Proceeding with updating OpenWrt...');

      // download images
      return update.fetchRestore()
        .then((result) => {
          flash(usbConnection, result.uboot, result.squashfs, (err) => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        });
    }
    return reject(new Error('You need to specify --openwrt to proceed.'));
  });
};
