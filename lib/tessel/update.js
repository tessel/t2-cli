var Tessel = require('./tessel');
var commands = require('./commands');
var path = require('path');
var updates = require('../update-fetch');
var updatePath = path.join('/tmp/', updates.openWRTFile);
var remoteVersioningFile = '/etc/tessel-version';
var logs = require('.././logs');

/*
  Gathers openWRT and SAMD21 Firmware
  image information.
*/
Tessel.prototype.fetchCurrentBuildInfo = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Start the process to read the versioning file
    self.connection.exec(commands.readFile(remoteVersioningFile))
      .then(function(remoteProcess) {

        // Vars to hold contents as they get received
        var fileContents = '';
        var errContents = '';
        // Save file content data
        remoteProcess.stdout.on('data', function(data) {
          fileContents += data.toString();
        });

        // Save any error messages
        remoteProcess.stderr.on('data', function(data) {
          errContents += data.toString();
        });

        // Once the process is complete
        remoteProcess.once('close', function() {
          // If we had an error
          if (errContents.length) {
            // This process failed
            return reject(new Error(errContents));
          }
          // Otherwise we supposedly read the file
          else {
            try {
              // Parse the JSON contents
              resolve(fileContents.trim());
            }
            // JSON parse failed
            catch (e) {
              // Reject with parse error
              return reject(e);
            }
          }
        });
      })
      .catch(reject);
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
        resolve();
      }
    });
  });
};
