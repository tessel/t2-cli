var util = require('util'),
  Duplex = require('stream').Duplex,
  Promise = require('bluebird'),
  EventEmitter = require('events').EventEmitter,
  logs = require('./logs'),
  debug = require('debug')('discovery:usb');

var haveusb = true;
try {
  var usb = require('usb');
} catch (e) {
  haveusb = false;
  console.error('WARNING: No usb controller found on this system.');
}

var Daemon = require('./usb/usb_daemon');

var TESSEL_VID = 0x1209;
var TESSEL_PID = 0x7551;

var USB = {};

USB.Connection = function(device) {
  Duplex.call(this);
  this.device = device;
  this.connectionType = 'USB';
  this.epIn = undefined;
  this.epOut = undefined;
};

util.inherits(USB.Connection, Duplex);

USB.Connection.prototype.exec = function(command) {
  var self = this;
  return new Promise(function(resolve, reject) {

    // Execute the command
    if (!Array.isArray(command)) {
      return reject(new Error('Command to execute must be an array of args.'));
    }

    // Create a new process
    Daemon.openProcess(self, function(err, proc) {
      if (err) {
        return reject(err);
      } else {

        // Format the args into something the USB protocol can understand
        command = self._processArgsForTransport(command);

        // Write the bash command
        proc.control.end(command);

        // Once the command has been written, call the callback with the resulting process
        proc.control.once('finish', resolve.bind(self, proc));
      }
    });
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
  var self = this;
  // Default transfer size
  var transferSize = 4096;
  // Start polling
  self.epIn.startPoll(2, transferSize);

  // When we get data, push it into the stream
  self.epIn.on('data', self.push.bind(self));

  // Report errors as they arise
  self.epIn.on('error', function(e) {
    // If this stream was already closed, just return
    if (self.closed) {
      return;
    } else {
      // Otherwise print the error
      logs.err('Error reading USB message endpoint:', e);
      // Return a non-zero return code
      process.exit(-5);
    }
  });
};

USB.Connection.prototype.open = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Try to open connection
    try {
      self.device.open();
    } catch (e) {
      if (e.message === 'LIBUSB_ERROR_ACCESS' && process.platform === 'linux') {
        console.error('Please run `sudo tessel install-drivers` to fix device permissions.\n(Error: could not open USB device.)');
      }
      // Reject if error
      return reject(e, self);
    }

    // Try to initialize interface
    self.intf = self.device.interface(0);
    try {
      self.intf.claim();
    } catch (e) {
      // Reject if error
      return reject(e, self);
    }
    // Set interface settings
    self.intf.setAltSetting(2, function(error) {
      if (error) {
        return reject(error, self);
      }
      self.epIn = self.intf.endpoints[0];
      self.epOut = self.intf.endpoints[1];
      if (!self.epIn || !self.epOut) {
        return reject(new Error('Device endpoints weren not able to be loaded'), self);
      }

      // Map desciptions
      self.device.getStringDescriptor(self.device.deviceDescriptor.iSerialNumber, function(error, data) {
        if (error) {
          return reject(error, self);
        }

        self.serialNumber = data;
        // Register this connection with daemon (keeps track of active remote processes)
        Daemon.register(self);
        // Start receiving messages
        self._receiveMessages();
        // If all is well, resolve the promise with the valid connection
        return resolve(self);
      });
    });
  });
};

USB.Connection.prototype.end = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Tell the USB daemon to end all processes active
    // on account of this connection
    Daemon.deregister(self, function(err) {
      self._close();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

USB.Connection.prototype._close = function(callback) {
  var self = this;

  if (self.closed) {
    return callback && callback();
  }

  self.closed = true;
  self.intf.release(true, function() {
    self.device.close();
    if (typeof callback === 'function') {
      callback();
    }
  }.bind(self));
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

    setImmediate(scanner.start.bind(scanner));
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

util.inherits(USB.Scanner, EventEmitter);

USB.Scanner.prototype.start = function() {
  var self = this;
  if (haveusb) {
    usb.getDeviceList().forEach(deviceInspector);
    usb.on('attach', deviceInspector);
  } else {
    console.warn('WARNING: No usb controller found on this system.');

  }

  function deviceInspector(device) {
    if ((device.deviceDescriptor.idVendor === TESSEL_VID) && (device.deviceDescriptor.idProduct === TESSEL_PID)) {
      debug('Device found.');
      var connection = new USB.Connection(device);
      self.emit('connection', connection);
    }
  }
};

USB.Scanner.prototype.stop = function() {
  if (haveusb) {
    usb.removeAllListeners('attach');
  } 
};

module.exports.startScan = startScan;
module.exports.stopScan = stopScan;

if (global.IS_TEST_ENV) {
  module.exports.USB = USB;
}
