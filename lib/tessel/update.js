var Tessel = require('./tessel');
var commands = require('./commands');
var usb = require('usb');
var usb_connection = require('../usb_connection');
var TESSEL_VID = usb_connection.TESSEL_VID;
var TESSEL_PID = usb_connection.TESSEL_PID;
var updatePath = '/tmp/update.bin';

/*
  Gathers openWRT and SAMD21 Firmware
  image information.
*/
Tessel.prototype.fetchCurrentBuildInfo = function() {
  return new Promise(function(resolve) {
    // TODO:
    resolve({
      version: '0.0.0',
      builds: {
        firmware: '0.0.0',
        openwrt: '0.0.0'
      }
    });
  });
};

Tessel.prototype.update = function(newImage) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!Buffer.isBuffer(newImage.openwrt) 
      || !Buffer.isBuffer(newImage.firmware)) {
      return reject("Invalid update binaries.");
    }
    else {
      return self.updateOpenWRT(newImage.openwrt)
      .then(self.updateFirmware.bind(self, newImage.firmware))
    }
  });
};

Tessel.prototype.updateOpenWRT = function(image) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Write the new image to a file in the /tmp dir
    return self.connection.exec(commands.openStdinToFile(updatePath))
    .then(function(remoteProc) {
      // When we finish writing the image
      remoteProc.once('close', function() {
        console.log('sysupgrading...');
        // Begin the sysupgrade
        // The USBDaemon will cut out or the SSH command will close
        self.connection.exec(commands.sysupgrade(updatePath));
        resolve();
      });
      console.log('writing image...', image.length);
      // Write the image
      remoteProc.stdin.end(image);
    })
    .catch(reject);
  });
};

Tessel.prototype.updateFirmware = function(image) {
  var self = this;

  return new Promise(function(resolve, reject) {
    // This must be USB connection
    if (self.connection.connectionType != 'USB') {
      return console.log('nope, this is LAN');
    }

    return self.connection.enterBootloader()
    .then(function executeFlash(dfu) {
      return self.writeFlash(dfu, image);
    });
  });
}

Tessel.prototype.writeFlash = function(dfu, image) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Download the firmware image
    dfu.dnload(image, function complete(err) {
        if (err) {
          reject(err);
        }
        else {
          console.log('Firmware update complete!');
          resolve();
        }
      }
    );
  });
}
