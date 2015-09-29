var Tessel = require('./tessel');
var commands = require('./commands');
var path = require('path');
var updates = require('../update-fetch');
var updatePath = path.join('/tmp/', updates.OPENWRT_BINARY_FILE);
var remoteVersioningFile = '/etc/tessel-version';
var logs = require('.././logs');

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
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!Buffer.isBuffer(newImage.openwrt) || !Buffer.isBuffer(newImage.firmware)) {
      return reject('Invalid update binaries.');
    } else {
      return self.updateOpenWRT(newImage.openwrt)
        .then(self.updateFirmware.bind(self, newImage.firmware))
        .then(resolve, reject);
    }
  });
};

Tessel.prototype.updateOpenWRT = function(image) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logs.info('Updating OpenWRT (1/2)');

    // Write the new image to a file in the /tmp dir
    return self.connection.exec(commands.openStdinToFile(updatePath))
      .then(function(remoteProc) {
        // When we finish writing the image
        remoteProc.once('close', function() {
          // Begin the sysupgrade
          logs.info('Starting OpenWRT update. Please do not remove power from Tessel.');
          // The USBDaemon will cut out or the SSH command will close
          self.connection.exec(commands.sysupgrade(updatePath))
            .then(function(remoteProc) {

              // This is the best way I've figured out to tell
              // when the update is complete. I realize that tying completion
              // of the CLI command to random text output by OpenWRT might not
              // be the best thing...
              remoteProc.stdout.on('data', function(d) {
                if (d.toString().indexOf('Upgrade completed') !== -1) {
                  resolve();
                  return;
                }
              });
            });
        });
        logs.info('Transferring image of size', (image.length / 1e6).toFixed(2), 'MB');
        // Write the image
        remoteProc.stdin.end(image);
      })
      .catch(reject);
  });
};

Tessel.prototype.updateFirmware = function(image) {
  var self = this;
  logs.info('Updating firwmare (2/2)');
  return new Promise(function(resolve, reject) {
    // This must be USB connection

    var connection = self.usbConnection;

    if (!connection) {
      return reject('Must have Tessel connected over USB to complete update. Aborting update.');
    }

    return connection.enterBootloader()
      .then(function executeFlash(dfu) {
        return self.writeFlash(dfu, image)
          .then(resolve, reject);
      });
  });
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
