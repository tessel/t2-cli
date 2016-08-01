var Tessel = require('./tessel');
var update = require('../update-fetch');
var log = require('../log');
var flash = require('../flash');

Tessel.prototype.restore = function restore() {
  var usbConnection = this.connection;
  return new Promise((resolve, reject) => {

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


  });
};
