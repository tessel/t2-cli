// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.
var assert = require('assert');

//           bRequest  bmRequestType wValue      wIndex      wLength     Data
// var DFU_DETACH    = 0; // OUT        wTimeout    Interface   Zero        None
var DFU_DNLOAD = 1; // OUT        wBlockNum   Interface   Length      Firmware
var DFU_UPLOAD = 2; // IN         Zero        Interface   Length      Firmware
var DFU_GETSTATUS = 3; // IN         Zero        Interface   6           Status
var DFU_CLRSTATUS = 4; // OUT        Zero        Interface   Zero        None
// var DFU_GETSTATE  = 5; // IN         Zero        Interface   1           State
var DFU_ABORT = 6; // OUT        Zero        Interface   Zero        None

// bmRequestType flags
var TYPE_IN = 0xA1;
var TYPE_OUT = 0x21;

function DFU(device, altsetting) {
  this.device = device;
  this.device.open();
  this.device.timeout = 10 * 1000;
  this.altsetting = altsetting || 0;

  var found = false;

  for (var i = 0; i < this.device.interfaces.length; i++) {
    var descriptor = this.device.interfaces[i].descriptor;
    // Find the DFU interface
    if (descriptor.bInterfaceClass === 0xfe && descriptor.bInterfaceSubClass === 0x01) {
      found = true;
      this.bInterface = descriptor.bInterfaceNumber;
      this.iface = this.device.interfaces[i];

      if (descriptor.extra[1] !== 0x21) {
        throw new Error('DFU functional descriptor is invalid');
      }

      this.canDownload = !!(descriptor.extra[2] & (1 << 0));
      this.canUpload = !!(descriptor.extra[2] & (1 << 1));
      this.manifestationTolerant = !!(descriptor.extra[2] & (1 << 1));
      this.detachTimeOut = descriptor.extra.readUInt16LE(3);
      this.transferSize = descriptor.extra.readUInt16LE(5);
      break;
    }
  }

  if (!found) {
    throw new Error('No DFU interface found!');
  }
}

DFU.prototype.claim = function(callback) {
  this.iface.claim();
  this.iface.setAltSetting(this.altsetting, callback);
};

DFU.prototype.getStatus = function(callback) {
  this.device.controlTransfer(TYPE_IN, DFU_GETSTATUS, 0, this.bInterface, 6, function(error, data) {
    if (error) {
      return callback(error);
    }

    callback(null, {
      status: data[0],
      pollTime: data[1] << 0 | data[2] << 8 | data[3] << 16,
      state: data[4],
      iString: data[5],
    });

  });
};

DFU.prototype.clearStatus = function(callback) {
  this.device.controlTransfer(TYPE_OUT, DFU_CLRSTATUS, 0, this.bInterface, 0, callback);
};

DFU.prototype.abort = function(callback) {
  this.device.controlTransfer(TYPE_OUT, DFU_ABORT, 0, this.bInterface, 0, callback);
};

DFU.prototype.dnloadChunk = function(blockNum, data, callback) {
  assert(data.length <= this.transferSize);
  this.device.controlTransfer(TYPE_OUT, DFU_DNLOAD, blockNum, this.bInterface, data, callback);
};

DFU.prototype.dnload = function(data, callback, statuscb) {
  var pos = 0;
  var seq = 0;
  var step = () => {

    if (typeof statuscb === 'function') {
      statuscb(pos, data.length);
    }

    this.dnloadChunk(seq, data.slice(pos, pos + this.transferSize), (error) => {
      if (error) {
        console.log('chunk error', error);
        if (error) {
          return this.handleError(error, callback);
        }
      }

      this.getStatus((error) => {
        if (error) {
          console.log('status error', error);
          return callback(error);
        }

        seq += 1;
        pos += this.transferSize;

        if (pos < data.length) {
          step();
        } else {

          if (typeof statuscb === 'function') {
            statuscb(data.length, data.length);
          }

          this.dnloadChunk(seq, Buffer.alloc(0), (error) => {
            if (error) {
              return callback(error);
            }

            this.getStatus((error) => {
              if (error) {
                return callback(error);
              }
              setTimeout(callback, 100);
            });
          });
        }
      });
    });
  };

  step();
};

DFU.prototype.uploadChunk = function(blockNum, length, callback) {
  this.device.controlTransfer(TYPE_IN, DFU_UPLOAD, blockNum, this.bInterface, length, callback);
};

DFU.prototype.upload = function(callback) {
  var buffers = [];
  var seq = 0;
  var step = () => {
    this.uploadChunk(seq, this.transferSize, (error, data) => {
      if (error) {
        return this.handleError(error, callback);
      }

      buffers.push(data);

      if (data.length === this.transferSize) {
        seq += 1;
        step();
      } else {
        callback(null, Buffer.concat(buffers));
      }
    });
  };

  step();
};

DFU.prototype.handleError = function(error, callback) {
  if (error.errno = 4) {
    // get status for a stall
    this.getStatus(function(status_error, status) {
      if (status_error) {
        console.log('status error', status_error);
        status_error.previous = error;
        return callback(status_error);
      }

      error.status = status;
      console.log('status after error', status);
      callback(error);
    });

  } else {
    callback(error);
  }
};

module.exports = DFU;
