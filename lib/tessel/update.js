// System Objects
var path = require('path');

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var logs = require('../logs');
var Tessel = require('./tessel');
var updates = require('../update-fetch');

var updatePath = path.join('/tmp/', updates.OPENWRT_BINARY_FILE);
var remoteVersioningFile = '/etc/tessel-version';

/*
  Gathers openWRT and SAMD21 Firmware
  image information.
*/
Tessel.prototype.fetchCurrentBuildInfo = function() {
  // Read the version file
  return this.simpleExec(commands.readFile(remoteVersioningFile))
    .then(function fileRead(fileContents) {
      // Trim the file new line and return
      return fileContents.trim();
    });
};

Tessel.prototype.update = function(newImage) {
  if (!Buffer.isBuffer(newImage.openwrt) || !Buffer.isBuffer(newImage.firmware)) {
    return Promise.reject('Invalid update binaries.');
  }

  return this.updateOpenWRT(newImage.openwrt)
    .then(() => this.updateFirmware(newImage.firmware));
};

Tessel.prototype.updateOpenWRT = function(image) {
  logs.info('Updating OpenWRT (1/2)');

  return new Promise((resolve, reject) => {
    // Write the new image to a file in the /tmp dir
    this.connection.exec(commands.openStdinToFile(updatePath), (err, remoteProc) => {
      if (err) {
        return reject(err);
      }

      logs.info('Transferring image of size', (image.length / 1e6).toFixed(2), 'MB');
      // When we finish writing the image
      remoteProc.once('close', resolve);
      // Write the image
      remoteProc.stdin.end(image);
    });
  })
  .then(() => {
    return new Promise((resolve) => {
      // Begin the sysupgrade
      logs.info('Starting OpenWRT update. Please do not remove power from Tessel.');
      // The USBDaemon will cut out or the SSH command will close
      this.connection.exec(commands.sysupgrade(updatePath), (err, remoteProc) => {
        remoteProc.stdout.on('data', function(d) {
          if (d.toString().includes('Upgrade completed')) {
            resolve();
          }
        });
      });
    });
  });
};

Tessel.prototype.updateFirmware = function(image) {
  logs.info('Updating firwmare (2/2)');
  // This must be USB connection

  var connection = this.usbConnection;

  if (!connection) {
    return Promise.reject('Must have Tessel connected over USB to complete update. Aborting update.');
  }

  return connection.enterBootloader()
    .then((dfu) => this.writeFlash(dfu, image));
};

Tessel.prototype.writeFlash = function(dfu, image) {
  return new Promise(function(resolve, reject) {
    // Download the firmware image
    dfu.dnload(image, function complete(err) {
      if (err) {
        reject(err);
      } else {
        logs.info('Firmware update complete!');
        // Remove once we can indicate that Tessel is booting up.
        logs.info('Tessel is rebooting. Please wait about 30 seconds before using Tessel.');
        resolve();
      }
    });
  });
};
