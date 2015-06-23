var util = require('util'),
  Duplex = require('stream').Duplex,
  Promise = require('bluebird'),
  EventEmitter = require('events').EventEmitter;

var haveusb = true;
try {
  var usb = require('usb');
} catch (e) {
  haveusb = false;
  console.error('WARNING: No usb controller found on this system.');
}

var Daemon = require('./usb/usb_daemon');

var TESSEL_VID = 0x9999;
var TESSEL_PID = 0xffff;

function USBConnection(device) {
  Duplex.call(this);
  this.device = device;
  this.connectionType = 'USB';
  this.epIn = undefined;
  this.epOut = undefined;
}

util.inherits(USBConnection, Duplex);

USBConnection.prototype.exec = function(command, callback) {
  var self = this;

  // Execute the command
  if (!Array.isArray(command)) {
    return callback && callback(new Error('Command to execute must be an array of args.'));
  }

  // Create a new process
  Daemon.openProcess(self, function(err, proc) {
    if (err) {
      return callback && callback(err);
    } else {

      // Format the args into something the USB protocol can understand
      command = self._processArgsForTransport(command);

      // Write the bash command
      proc.control.end(command);

      // Once the command has been written, call the callback with the resulting process
      proc.control.once('finish', callback.bind(self, null, proc));
    }
  });
};

USBConnection.prototype._write = function(chunk, enc, callback) {
  var self = this;
  if (this.closed) {
    callback(new Error('Connection was already closed...'));
  } else {
    this.epOut.transfer(chunk, function(err, data) {
      if (err) {
        // console.log("transfer epOut", err);
        self.emit('error', err);
      } else {
        callback(data);
      }
    });
  }
};

USBConnection.prototype._read = function() {
  var self = this;

  if (self.closed) {
    return self.push(null);
  }

  self.epIn.transfer(4096, function(err, data) {
    if (err) {
      // console.log("transfer epIn", err);
      self.emit('error', err);
    } else {
      self.push(data);
    }
  });
};

USBConnection.prototype.open = function() {
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
        // If all is well, resolve the promise with the valid connection
        return resolve(self);
      });
    });
  });
};

USBConnection.prototype.end = function(callback) {
  var self = this;
  // Tell the USB daemon to end all processes active
  // on account of this connection
  Daemon.deregister(this, function(err) {
    self._close();
    if (typeof callback === 'function') {
      callback(err);
    }
  });
};

USBConnection.prototype._close = function(callback) {
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

USBConnection.prototype._processArgsForTransport = function(command) {

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
    scanner = new Scanner();
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

function Scanner() {}

util.inherits(Scanner, EventEmitter);

Scanner.prototype.start = function() {
  var self = this;
  usb.getDeviceList().forEach(deviceInspector);

  usb.on('attach', deviceInspector);
  usb.on('detach', detachDevice);


  function detachDevice(device) {
    if ((device.deviceDescriptor.idVendor === TESSEL_VID) && (device.deviceDescriptor.idProduct === TESSEL_PID)) {
      process.nextTick(function(){
        self.emit('detach', device);
      });
    }
  }

  function deviceInspector(device) {
    if ((device.deviceDescriptor.idVendor === TESSEL_VID) && (device.deviceDescriptor.idProduct === TESSEL_PID)) {
      var connection = new USBConnection(device);
      process.nextTick(function(){
        self.emit('connection', connection);
      })

      connection.on('error', function(e){
        // catch the error,
        // check to see if this device has been disconnected after 200ms
        setTimeout(function(){
          // if it has, don't emit error
          // otherwise emit the error
          usb.getDeviceList().forEach(function(d){
            if (d == device) {
              throw e;
            }
          })
        }, 200);
      });
    }
  }
};

Scanner.prototype.stop = function() {
  usb.removeAllListeners('attach');
};

module.exports.startScan = startScan;
module.exports.stopScan = stopScan;
