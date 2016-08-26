// System Objects
// ...

// Third Party Dependencies
var Progress = require('progress');

// Internal
var log = require('../log');
var Tessel = require('./tessel');
var update = require('../update-fetch');

// Datasheet Reference:
// http://www.cypress.com/file/177966/download
//
//
// Constants

// 7.5.1 Status Register 1 (SR1)
// - Write Enable (WREN 06h)
// p. 48
// 8.2 Write Enable Command (WREN)
// p. 57
const COMMAND_WREN = 0x06;

// 9.2.2 Read Identification (RDID 9Fh)
// p. 71
const COMMAND_RDID = 0x9F;

// 9.3.1 Read Status Register-1 (RDSR1 05h)
// p. 72
const COMMAND_RDSR1 = 0x05;

// 9.6.3 Bulk Erase (BE 60h or C7h)
// p. 105
const COMMAND_BE = 0x60;

// 9.5.1.1 Page Programming
// p. 98
const PAGE_SIZE = 256;

// TODO: Find reference
const EXPECTED_RDID = '010219';

// TODO: Find reference
const MAX_READ_SIZE = Math.pow(2, 24);


Tessel.prototype.restore = function(options) {
  return new Promise((resolve, reject) => {
    var rdid = Promise.resolve();

    // If no "force/-f" flag is present, then
    // we must validate the device id. This is the
    // default behavior. Only extreme circumstances
    // call for forcing the restore process.
    if (!options.force) {
      rdid = exportables.validateDeviceId(this.usbConnection);
    }

    // 1. Download Images for download images
    // 2. Flash images to USB connected Tessel 2
    return rdid.then(update.fetchRestore).then(images => {
      return exportables.flash(this, images).then(resolve).catch(reject);
    });
  });
};

// Contains functionality that must be stubbable in tests
var exportables = {};

function address(addr) {
  return [(addr >> 24) & 0xFF, (addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF];
}

function toBuffer() {
  return Buffer.concat(Array.from(arguments).map(
    (arg) => Array.isArray(arg) ? new Buffer(arg) : arg
  ));
}

function randUint8() {
  return Math.round(Math.random() * 255);
}

// Generate a mediatek factory partition
// TODO: Find reference
exportables.partition = function(mac1, mac2) {
  return toBuffer(
    [0x20, 0x76, 0x03, 0x01],
    mac1,
    Array(30).fill(0xFF),
    mac2
  );
};

exportables.transaction = function(usb, bytesOrCommand, readLength, statusPoll, writeEnable) {
  readLength = readLength || 0;
  statusPoll = statusPoll || false;
  writeEnable = writeEnable || false;

  if (typeof bytesOrCommand === 'number') {
    bytesOrCommand = [bytesOrCommand];
  }

  if (bytesOrCommand.length > 500 || readLength >= MAX_READ_SIZE) {
    return Promise.reject(new Error('Transaction too large'));
  }

  var flags = Number(statusPoll) | (Number(writeEnable) << 1);
  var hdr = [(readLength >> 0) & 0xFF, (readLength >> 8) & 0xFF, (readLength >> 16) & 0xFF, flags];
  var data = toBuffer(hdr, bytesOrCommand);

  return new Promise((resolve, reject) => {
    usb.epOut.transfer(data, (error) => {
      if (error) {
        return reject(error);
      }
      if (readLength > 0) {
        usb.epIn.transfer(readLength, (error, data) => {
          if (error) {
            return reject(error);
          }
          return resolve(data);
        });
      } else {
        return resolve();
      }
    });
  });
};

exportables.validateDeviceId = function(usb) {
  return new Promise((resolve, reject) => {
    return exportables.transaction(usb, COMMAND_RDID, 3).then(buffer => {
      if (buffer.toString('hex') !== EXPECTED_RDID) {
        return reject(new Error('Invalid Device ID (Flash Memory Communication Error)'));
      }
      return resolve();
    });
  });
};

// 9.6.3 Bulk Erase (BE 60h or C7h)
exportables.bulkEraseFlash = function(usb) {
  return exportables.transaction(usb, COMMAND_BE).then(() => exportables.waitTransactionComplete(usb));
};

// NOTE: The following commands do not directly interact with the flash memory registers
// described in the cited sections. The register is actually read in firmare/flash.c
// (https://github.com/tessel/t2-firmware/blob/1d3e13931d9d668013e5446330c74faa09477c17/firmware/flash.c#L3-L22 )

// 8.2 Write Enable Command
// p. 57
exportables.enableWrite = function(usb) {
  return exportables.transaction(usb, COMMAND_WREN);
};

// 9.3.1 Read Status Register-1 (RDSR1 05h)
// p. 72
exportables.status = function(usb) {
  return exportables.transaction(usb, COMMAND_RDSR1, 1).then(buffer => {
    return Promise.resolve(buffer ? buffer[0] : buffer);
  });
};

// Status Register: Poll until WIP bit reports 0
exportables.waitTransactionComplete = function(usb) {
  return new Promise(resolve => {
    var poll = () => {
      exportables.status(usb).then(status => {
        // If "status" is anything but 0, keep checking.
        if (status) {
          return poll();
        }
        resolve();
      });
    };
    poll();
  });
};

exportables.write = function(usb, offset, buffer) {

  var bar = new Progress('     [:bar] :percent :etas remaining', {
    clear: true,
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: buffer.length
  });

  log.spinner.stop();

  return new Promise(resolve => {
    var sendChunk = () => {
      var size = buffer.length > PAGE_SIZE ? PAGE_SIZE : buffer.length;
      exportables.writePage(usb, offset, buffer.slice(0, size)).then(() => {
        buffer = buffer.slice(size);
        offset += PAGE_SIZE;

        bar.tick(size);

        // If "buffer" still has contents, keep sending chunks.
        if (buffer.length) {
          sendChunk();
        } else {
          resolve();
        }
      });
    };
    sendChunk();
  }).then(() => exportables.waitTransactionComplete(usb));
};

// Write a 256 Byte Page to Flash
exportables.writePage = function(usb, start, page) {
  var buffer = toBuffer([0x12], address(start), page);
  return exportables.transaction(usb, buffer, 0, true, true);
};

exportables.flash = function(tessel, buffers) {
  var usb = tessel.usbConnection;

  log.info('Restoring your Tessel...');

  return new Promise((resolve, reject) => {
    var uid = [randUint8(), randUint8(), randUint8(), randUint8()];

    // 9.5.2 Page Program (PP 02h or 4PP 12h)
    var mac1 = [0x02, 0xA3].concat(uid);
    var mac2 = [0x02, 0xA4].concat(uid);

    buffers.partition = exportables.partition(mac1, mac2);

    return exportables.enableWrite(usb).then(() => {
        log.info('Bulk Erasing Flash Memory (this may take a minute)...');
        return exportables.bulkEraseFlash(usb);
      })
      .then(() => {
        log.info('Writing U-Boot...');
        return exportables.write(usb, 0, buffers.uboot);
      })
      .then(() => {
        log.info('Writing MediaTek factory partition...');
        return exportables.write(usb, 0x40000, buffers.partition);
      })
      .then(() => {
        log.info('Writing OpenWRT SquashFS (this may take a few minutes)...');
        return exportables.write(usb, 0x50000, buffers.squashfs);
      })
      .then(() => {
        log.info('Restore successful. Please reboot your Tessel');
        return resolve();
      }).catch(reject);
  });
};

if (global.IS_TEST_ENV) {
  module.exports = exportables;
}
