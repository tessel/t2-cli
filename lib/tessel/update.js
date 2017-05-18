// System Objects
var path = require('path');
var fs = require('fs');

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var log = require('../log');
var Tessel = require('./tessel');
var updates = require('../update-fetch');

var updatePath = `/tmp/${updates.OPENWRT_BINARY_FILE}`;
var remoteVersioningFile = '/etc/tessel-version';

/*
  Gathers openWRT and SAMD21 Firmware
  image information.
*/
Tessel.prototype.fetchCurrentBuildInfo = function() {
  // Read the version file
  return this.simpleExec(commands.readFile(remoteVersioningFile))
    .then(fileContents => fileContents.trim());
};

Tessel.prototype.update = function(opts, newImage) {
  return new Promise((resolve) => {
      if (newImage.openwrt.length > 0) {
        return this.updateOpenWRT(opts, newImage.openwrt).then(resolve);
      } else {
        log.warn('No OpenWRT binary loaded... skipping OpenWRT update');
        resolve();
      }
    })
    .then(() => {
      return new Promise((resolve) => {
        if (newImage.firmware.length > 0) {
          return this.updateFirmware(newImage.firmware).then(resolve);
        } else {
          log.warn('No firmware binary loaded... skipping firmware update');
          resolve();
        }
      });
    });
};

Tessel.prototype.updateOpenWRT = function(opts, image) {
  // This ensures usb updates will work on older OpenWRT images
  // by overwriting the upgrade file
  return this.fixOldUpdateScripts()
    .then(() => {
      return new Promise((resolve, reject) => {
        log.info('Updating OpenWRT (1/2)');
        // Write the new image to a file in the /tmp dir
        this.connection.exec(commands.openStdinToFile(updatePath), (err, remoteProc) => {
          if (err) {
            return reject(err);
          }

          log.info(`Transferring image of size ${(image.length / 1e6).toFixed(2)} MB. This will take 2-4 minutes...`);
          // When we finish writing the image
          remoteProc.once('close', () => {
            // Report success
            log.info('Transfer complete.');
            // Continue with the update process
            return resolve();
          });
          // Write the image
          remoteProc.stdin.end(image);
        });
      });
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        // Begin the sysupgrade
        log.info('Starting OpenWRT update.');
        log.info('Please do not remove power from Tessel.');
        log.info('This process will take at least 2 minutes...');

        var sysupgradeCommand = [];
        if (opts.n) {
          log.info('Configuration is not saved during update.');
          sysupgradeCommand = commands.sysupgradeNoSaveConfig(updatePath);
        } else {
          log.info('Configuration is saved during update.');
          sysupgradeCommand = commands.sysupgrade(updatePath);
        }

        // The USBDaemon will cut out or the SSH command will close
        this.connection.exec(sysupgradeCommand, (err, remoteProc) => {
          if (err) {
            return reject(err);
          } else {
            // We don't want our CLI to try to wait for this process to close
            // because it will never be acknowledged by the USB Daemon
            // during the sysupgrade
            remoteProc.waitForClose = false;

            /*
            I have experimentally found that the update process completes after
            about 2 minutes. If we try to resolve before then, sometimes the update completes
            but not always. Additionally, the update usually emits 'Update
            completed' on stdout but not always so we can't trust that for
            determining completion...
            */
            var updateCompleteTimeout = setTimeout(resolve, Tessel.openWRTUpdateTime);

            // Continue to analyze incoming stdout data
            remoteProc.stdout.on('data', function(d) {
              // If we get an upgrade complete message before our timeout
              if (d.toString().includes('Upgrade completed')) {
                // Clear the timeout
                clearTimeout(updateCompleteTimeout);
                // Resolve now
                resolve();
              }
            });
          }
        });
      });
    });
};

Tessel.prototype.updateFirmware = function(image) {
  return new Promise((resolve, reject) => {
    log.info('Updating firmware (2/2)');

    // This must be USB connection
    var connection = this.usbConnection;

    if (!connection) {
      return reject('Must have Tessel connected over USB to complete update. Aborting update.');
    }

    connection.enterBootloader()
      .then((dfu) => this.writeFlash(dfu, image))
      .then(resolve);
  });
};

Tessel.prototype.writeFlash = function(dfu, image) {
  return new Promise(function(resolve, reject) {
    // Download the firmware image
    dfu.dnload(image, function complete(err) {
      if (err) {
        reject(err);
      } else {
        log.info('Firmware update complete!');
        resolve();
      }
    });
  });
};

Tessel.prototype.fixOldUpdateScripts = function() {
  return new Promise((resolve, reject) => {
      // Read the common.sh file that needs to be replaced into memory
      fs.readFile(path.join(__dirname, '../../resources/openwrt/common.sh'), (err, contents) => {
        if (err) {
          return reject(err);
        } else {
          // Open stdin to a new temporary file
          this.connection.exec(commands.openStdinToFile('/lib/upgrade/common_tmp.sh'), (err, remoteProcess) => {
            if (err) {
              return reject(err);
            } else {
              // When we finish writing the file, resolve
              remoteProcess.once('close', resolve);

              // Write the contents of the file to the process
              remoteProcess.stdin.end(contents);
            }
          });
        }
      });
    })
    // Rename the temporary file to the real file name before finishing
    .then(() => this.simpleExec(commands.moveFolder('/lib/upgrade/common_tmp.sh', '/lib/upgrade/common.sh')));
};

Tessel.openWRTUpdateTime = 120 * 1000;
