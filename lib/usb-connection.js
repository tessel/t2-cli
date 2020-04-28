// System Objects
var util = require('util');
var stream = require('stream');
var events = require('events');
const {
  execSync
} = require('child_process');

var Duplex = stream.Duplex;
var Emitter = events.EventEmitter;

// Third Party Dependencies
const tags = require('common-tags');

// Internal
var DFU = require('./dfu');
var log = require('./log');


function debug(message) {
  log.debug(`(discovery:usb) ${message}`);
}

function debugCommands(message) {
  log.debug(`(commands:usb) ${message}`);
}

var isUSBAvailable = true;
try {
  var usb = require('usb');
  var VENDOR_REQ_OUT = usb.LIBUSB_REQUEST_TYPE_VENDOR | usb.LIBUSB_RECIPIENT_DEVICE | usb.LIBUSB_ENDPOINT_OUT;
  // var VENDOR_REQ_IN  = usb.LIBUSB_REQUEST_TYPE_VENDOR | usb.LIBUSB_RECIPIENT_DEVICE | usb.LIBUSB_ENDPOINT_IN;
} catch (error) {
  isUSBAvailable = false;

  // do not exit the process during tests because usb is not needed to run them
  /* istanbul ignore next */
  if (!global.IS_TEST_ENV) {
    log.error('Node version mismatch for USB drivers.');
    log.info(tags.stripIndent `
      Automatically rebuilding USB drivers for t2-cli to correct this issue. Please try running your command again.

      If the error persists, please file an issue at https://github.com/tessel/t2-cli/issues/new with this warning.
    `);
    execSync(`cd ${__dirname} && npm rebuild --update-binary usb`);
    process.exit(1);
  }
}

var Daemon = require('./usb/usb-daemon');

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

USB.Connection.prototype.open = function(altSetting) {
  altSetting = (altSetting || altSetting === 0) ? altSetting : 2;


  // Try to open connection
  try {
    this.device.open();
    this.closed = false;
  } catch (e) {
    if (e.message === 'LIBUSB_ERROR_ACCESS' && process.platform === 'linux') {
      log.error('Please run `sudo t2 install drivers` to fix device permissions.\n(Error: could not open USB device.)');
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
  var p = this.setAltSetting(altSetting)
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
            this.serialNumber = data;
            resolve();
          }
        });
      });
    });

  if (altSetting === 1) {
    return p.then(() => {
      return Promise.resolve(this);
    });
  }

  return p
    .then(() => {

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

USB.Connection.prototype.setAltSetting = function(altSetting) {
  return new Promise((resolve, reject) => {
    // Set interface settings
    this.intf.setAltSetting(0, (error) => {
      if (error) {
        return reject(error, this);
      } else {
        // Set interface settings
        this.intf.setAltSetting(altSetting, (error) => {
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
  return new Promise((resolve, reject) => {
    // Tell the USB daemon to end all processes active
    // on account of this connection
    Daemon.deregister(this, (err) => {
      if (err) {
        reject(err);
      } else {
        this._close(resolve);
      }
    });
  });
};

USB.Connection.prototype._close = function(callback) {

  if (typeof callback !== 'function') {
    callback = function() {};
  }

  if (this.closed) {
    setImmediate(callback);
    return;
  }

  this.closed = true;

  this.epIn.stopPoll(() => {
    var attempt = () => {
      try {
        this.device.close();
      } catch (_) {
        setTimeout(attempt, 100);
        return;
      }

      callback(null);
    };

    this.intf.release(true, attempt);
  });
};

// Returns a device in DFU mode
USB.Connection.prototype.enterBootloader = function() {
  return new Promise((resolve) => {
      this.epIn.stopPoll(resolve);
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
        this.device.controlTransfer(VENDOR_REQ_OUT, REQ_BOOT, 0, 0, Buffer.alloc(0), function(err) {
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
        .then(bootedDevice => {
          // Make sure it's in the proper mode
          if (bootedDevice) {
            return resolve(bootedDevice);
          }
          // It didn't find it
        }, error => {
          if (--retryCount > 0) {
            return setTimeout(retry, retryTimeout);
          }

          if (process.platform.startsWith('win')) {
            log.info('Placeholder for zadig installation instructions.');
          }


          // No tries left...
          reject(error);
        });
    };

    setTimeout(retry, retryTimeout);
  });
};

// Looks through all attached USB devices for a Tessel in bootloader mode
USB.Connection.prototype._findBootedDeviceBySerialNumber = function(serialNumber) {
  return new Promise((resolve, reject) => {
    var found;
    // Fetch all attached USB devices
    if (usb) {
      found = usb.getDeviceList().find(device => {
        if ((device.deviceDescriptor.idVendor === TESSEL_VID) && 
            (device.deviceDescriptor.idProduct === TESSEL_PID) && 
            (device.deviceDescriptor.iSerialNumber === serialNumber) && 
            (device.deviceDescriptor.bcdDevice >> 8 === 0)) {
          // Shift bcdDevice bits rightward 8 bits to check that
          // the device is in bootloader mode. 
          return device;
        }
      });
    }

    if (found) {
      return resolve(found);
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

var scanner = null;

function startScan() {
  if (scanner === null) {
    scanner = new USB.Scanner();

    setImmediate(() => scanner.start());
  }

  return scanner;
}

function stopScan() {
  if (scanner !== null) {
    scanner.stop();
    scanner = null;
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

  if (isUSBAvailable) {
    usb.getDeviceList().forEach(deviceInspector);

    usb.on('attach', deviceInspector);
  }
};

USB.Scanner.prototype.stop = function() {
  if (isUSBAvailable) {
    usb.removeAllListeners('attach');
  }
};

module.exports.startScan = startScan;
module.exports.stopScan = stopScan;
module.exports.TESSEL_VID = TESSEL_VID;
module.exports.TESSEL_PID = TESSEL_PID;
// Exported for CLI API Consumers
module.exports.USBConnection = USB.Connection;

if (global.IS_TEST_ENV) {
  module.exports.USB = USB;
}
