var usb = require('usb')
  , util = require('util')
  , async = require('async')
  , Duplex = require('stream').Duplex
  , Promise = require('bluebird');
  ;

var TESSEL_VID = 0x9999;
var TESSEL_PID = 0xffff;

function USBConnection(device) {
  Duplex.call(this);
  this.device = device;
  this.connectionType = "USB";
  this.epIn;
  this.epOut;
}

util.inherits(USBConnection, Duplex);

// TODO: Execute shell commands by writing them over USB
USBConnection.prototype.exec = function(command, callback) {
  // Execute the command

}

USBConnection.prototype._write = function(chunk, enc, callback) {
  var self = this;
  self.epOut.transfer(chunk, callback);
};

USBConnection.prototype._read = function(num) {
  var self = this;
  self.epIn.transfer(4096, function(err, data) {
    if (err) {
      self.emit('error', err);
    } else {
      self.push(data);
    }
  });
};

USBConnection.prototype.open = function(callback) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Try to open connection
    try {
      self.device.open();
    } catch (e) {
      if (e.message === 'LIBUSB_ERROR_ACCESS' && process.platform === 'linux') {
        console.error("Please run `sudo tessel install-drivers` to fix device permissions.\n(Error: could not open USB device.)")
      }
      // Reject if error
      return reject(e, self);
    }

    // Try to initialize interface
    self.intf = self.device.interface(0);
    try {
      self.intf.claim();
    } catch (e) {
      if (e.message === 'LIBUSB_ERROR_BUSY') {
        e = "Device is in use by another process";
      }
      // Reject if error
      return reject(e, self);
    }
    // Set interface settings
    self.intf.setAltSetting(2, function(error) {
      if (error) return reject(error, self);
      self.epIn = self.intf.endpoints[0];
      self.epOut = self.intf.endpoints[1];
    });
    // Map desciptions
    self.device.getStringDescriptor(self.device.deviceDescriptor.iSerialNumber, function (error, data) {
      if (error) return reject(error, self);
      self.serialNumber = data;
      // If all is well, resolve the promise with the valid connection
      return resolve(self);
    })
  });
}

function findConnections() {
  return new Promise(function(resolve, reject) {
      var connections = usb.getDeviceList()
          .map(function(dev) {
            if ((dev.deviceDescriptor.idVendor == TESSEL_VID) && (dev.deviceDescriptor.idProduct == TESSEL_PID)) {
              return new USBConnection(dev);
            }
          })
          .filter(function(x) {return x});
      resolve(connections);
    })
    .map(function(conn){
      console.log(typeof conn);
      return conn.open();
    })
    .catch(function(error, conn){
      console.log(error, conn.connectionType)
      conn.initError = error;
      return conn;
    })
}

exports.findConnections = findConnections;
