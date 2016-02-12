// System Objects
var util = require('util');
var stream = require('stream');
var events = require('events');

var Duplex = stream.Duplex;
var Emitter = events.EventEmitter;

// Third Party Dependencies
var debug = require('debug')('discovery:usb');
var debugCommands = require('debug')('commands:usb');

// Internal
var DFU = require('./dfu');
var logs = require('./logs');



var haveusb = true;
try {
  var usb = require('usb');
  var VENDOR_REQ_OUT = usb.LIBUSB_REQUEST_TYPE_VENDOR | usb.LIBUSB_RECIPIENT_DEVICE | usb.LIBUSB_ENDPOINT_OUT;
  // var VENDOR_REQ_IN  = usb.LIBUSB_REQUEST_TYPE_VENDOR | usb.LIBUSB_RECIPIENT_DEVICE | usb.LIBUSB_ENDPOINT_IN;
} catch (e) {
  haveusb = false;
  logs.err('WARNING: No usb controller found on this system.');
}

var Daemon = require('./usb/usb_daemon');

var TESSEL_VID = 0x1209;
var TESSEL_PID = 0x7551;
var REQ_BOOT = 0xBB;
var USB = {};

USB.Connection = function(device) {
  Duplex.call(this);
  this.device = device;
  this.connectionType = 'USB';
  this.epIn = undefined;
  this.epOut = undefined;
};

util.inherits(USB.Connection, Duplex);

USB.Connection.prototype.exec = function(command, options, callback) {

  // Account for the case where options are not provided but a callback is
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  // Account for the case where a callback wasn't provided
  if (callback === undefined) {
    // Dummy callback
    callback = function() {};
  }

  // Execute the command
  if (!Array.isArray(command)) {
    return callback(new Error('Command to execute must be an array of args.'));
  }

  // Log executed command
  debugCommands(command);

  // Create a new process
  Daemon.openProcess(this, (err, proc) => {
    if (err) {
      return callback(err);
    } else {

      // Format the args into something the USB protocol can understand
      command = this._processArgsForTransport(command);

      // Write the bash command
      proc.control.end(command);

      // Once the command has been written, call the callback with the resulting process
      proc.control.once('finish', () => callback(null, proc));
    }
  });
};

USB.Connection.prototype._write = function(chunk, enc, callback) {

  if (this.closed) {
    callback(new Error('Connection was already closed...'));
  } else {
    this.epOut.transfer(chunk, callback);
  }
};

USB.Connection.prototype._read = function() {
  if (this.closed) {
    return this.push(null);
  }
};

USB.Connection.prototype._receiveMessages = function() {
  // Default transfer size
  var transferSize = 4096;
  // Start polling
  this.epIn.startPoll(2, transferSize);
  // When we get data, push it into the stream
  this.epIn.on('data', (data) => this.push(data));
};

USB.Connection.prototype.open = function() {
  // Try to open connection
  try {
    this.device.open();
  } catch (e) {
    if (e.message === 'LIBUSB_ERROR_ACCESS' && process.platform === 'linux') {
      logs.err('Please run `sudo t2 install-drivers` to fix device permissions.\n(Error: could not open USB device.)');
    }
    // Reject if error
    return Promise.reject(e);
  }

  // Try to initialize interface
  this.intf = this.device.interface(0);
  try {
    this.intf.claim();
  } catch (e) {
    // Reject if error
    return Promise.reject(e);
  }

  // Set interface settings
  return this.setAltSetting()
    .then(() => {
      this.epIn = this.intf.endpoints[0];
      this.epOut = this.intf.endpoints[1];
      if (!this.epIn || !this.epOut) {
        return Promise.reject(new Error('Device endpoints were not able to be loaded'));
      }

      // Map desciptions
      return new Promise((resolve, reject) => {
        this.device.getStringDescriptor(this.device.deviceDescriptor.iSerialNumber, function(err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    })
    .then((data) => {
      this.serialNumber = data;
      // Register this connection with daemon (keeps track of active remote processes)
      Daemon.register(this);

      return new Promise((resolve, reject) => {
        // If the USB Pipe isn't enabled on the other end (ie it is booting)
        this.epIn.on('error', (err) => {
          // Close the device resources
          this._close();
          // Catch the error and return if we haven't already
          return reject(err);
        });

        // Start receiving messages
        this._receiveMessages();

        // If all is well, resolve the promise with the valid connection
        resolve(this);
      });
    });
};

USB.Connection.prototype.setAltSetting = function() {
  return new Promise((resolve, reject) => {
    // Set interface settings
    this.intf.setAltSetting(0, (error) => {
      if (error) {
        return reject(error, this);
      } else {
        // Set interface settings
        this.intf.setAltSetting(2, (error) => {
          if (error) {
            return reject(error, this);
          } else {
            return resolve();
          }
        });
      }
    });
  });
};

USB.Connection.prototype.end = function() {
  var self = this;
  return new Promise((resolve, reject) => {
    // Tell the USB daemon to end all processes active
    // on account of this connection
    Daemon.deregister(self, function(err) {
      if (err) {
        reject(err);
      } else {
        self._close(resolve());
      }
    });
  });
};

USB.Connection.prototype._close = function(callback) {
  if (this.closed) {
    return callback && callback();
  }

  this.closed = true;
  this.epIn.stopPoll(() => {
    var attempt = () => {
      try {
        this.device.close();
      } catch (e) {
        setTimeout(attempt, 100);
        // FIXME: I really think that there should be an return here, else the
        //        callback will get called for every attempt!
      }
      if (typeof callback === 'function') {
        callback();
      }
    };

    this.intf.release(true, attempt);
  });
};

// Returns a device in DFU mode
USB.Connection.prototype.enterBootloader = function() {
  return Promise.resolve()
    .then(() => {
      return new Promise((resolve) => {
        this.epIn.stopPoll(resolve);
      });
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        Daemon.deregister(this, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    })
    .then(() => {
      // Tell the mcu to go into bootloader mode
      return new Promise((resolve, reject) => {
        this.device.controlTransfer(VENDOR_REQ_OUT, REQ_BOOT, 0, 0, new Buffer(0), function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    })
    .then(() => {
      // Wait for it to tenter the mode
      return this._waitUntilInBootloader();
    })
    .then((device) => {
      return new Promise(function(resolve, reject) {
        // Find the DFU interface
        var dfu = new DFU(device, 0);

        // Claim the USB device
        dfu.claim(function(err) {
          if (err) {
            return reject(err);
          } else {
            // Return the DFU device
            resolve(dfu);
          }
        });
      });
    });
};

// Waits until it finds a USB device that is a Tessel with a bootloader
// and returns that USB device
USB.Connection.prototype._waitUntilInBootloader = function() {
  var retryCount = 10;
  var retryTimeout = 250;
  return new Promise((resolve, reject) => {
    var retry = () => {
      this._findBootedDeviceBySerialNumber(this.device.deviceDescriptor.iSerialNumber)
        // A  Tessel was found!
        .then(function(bootedDevice) {
          // Make sure it's in the proper mode
          if (bootedDevice) {
            return resolve(bootedDevice);
          }
          // It didn't find it
        }, function(err) {
          if (--retryCount > 0) {
            return setTimeout(retry, retryTimeout);
          } else {
            reject(err);
          }
        });
    };

    setTimeout(retry, retryTimeout);
  });
};

// Looks through all attached USB devices for a Tessel in bootloader mode
USB.Connection.prototype._findBootedDeviceBySerialNumber = function(serialNumber) {
  return new Promise(function(resolve, reject) {
    // Fetch all attached USB devices
    if (usb) {
      var list = usb.getDeviceList();

      for (var i = 0; i < list.length; i++) {
        var device = list[i];
        // Make sure this is a Tessel
        if ((device.deviceDescriptor.idVendor === TESSEL_VID) && (device.deviceDescriptor.idProduct === TESSEL_PID) && (device.deviceDescriptor.iSerialNumber === serialNumber)) {
          // Make sure it's in bootloader mode
          if (device.deviceDescriptor.bcdDevice >> 8 === 0) {
            return resolve(device);
          }
        }
      }
    }
    return reject(new Error('No device found in bootloader mode'));
  });
};

USB.Connection.prototype._processArgsForTransport = function(command) {

  if (!Array.isArray(command)) {
    return;
  }

  // For each command
  command.forEach(function(arg, i) {
    // If this isn't the last item
    if (i !== command.length - 1) {
      // Demarcate the end of an arg with a null byte
      command[i] += '\0';
    }
  });

  // Join all the args into a string
  command = command.join('');

  return command;
};

var scanner;

function startScan() {
  if (scanner === undefined) {
    scanner = new USB.Scanner();

    setImmediate(() => scanner.start());
  }

  return scanner;
}

function stopScan() {
  if (scanner !== undefined) {
    scanner.stop();
    scanner = undefined;
  }

  return scanner;
}

USB.Scanner = function() {};

util.inherits(USB.Scanner, Emitter);

USB.Scanner.prototype.start = function() {
  var deviceInspector = (device) => {
    if ((device.deviceDescriptor.idVendor === TESSEL_VID) && (device.deviceDescriptor.idProduct === TESSEL_PID)) {
      debug('Device found.');
      var connection = new USB.Connection(device);
      this.emit('connection', connection);
    }
  };

  if (haveusb) {
    usb.getDeviceList().forEach(deviceInspector);

    usb.on('attach', deviceInspector);
  }
};

USB.Scanner.prototype.stop = function() {
  if (haveusb) {
    usb.removeAllListeners('attach');
  }
};

module.exports.startScan = startScan;
module.exports.stopScan = stopScan;
module.exports.TESSEL_VID = TESSEL_VID;
module.exports.TESSEL_PID = TESSEL_PID;

if (global.IS_TEST_ENV) {
  module.exports.USB = USB;
}
