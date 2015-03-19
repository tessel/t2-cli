var usb = require('usb')
  , util = require('util')
  , async = require('async')
  , Duplex = require('stream').Duplex
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

  try {
    this.device.open();
  } catch (e) {
    if (e.message === 'LIBUSB_ERROR_ACCESS' && process.platform === 'linux') {
      console.error("Please run `sudo tessel install-drivers` to fix device permissions.\n(Error: could not open USB device.)")
    }
    return callback && callback(e)
  }

  self.intf = self.device.interface(0);
  try {
    self.intf.claim();
  } catch (e) {
    if (e.message === 'LIBUSB_ERROR_BUSY') {
      e = "Device is in use by another process";
    }
    return callback(e);
  }

  self.intf.setAltSetting(2, function(error) {
    if (error) return callback && callback(error);
    self.epIn = self.intf.endpoints[0];
    self.epOut = self.intf.endpoints[1];
  });

  this.device.getStringDescriptor(this.device.deviceDescriptor.iSerialNumber, function (error, data) {
    if (error) return callback(error);
    self.serialNumber = data;
    return callback && callback();
  })
}

// Unabashedly copied from original CLI
function findConnections(callback) {
  var connections = usb.getDeviceList().map(function(dev) {
    if ((dev.deviceDescriptor.idVendor == TESSEL_VID) && (dev.deviceDescriptor.idProduct == TESSEL_PID)) {
      return new USBConnection(dev);
    }
  }).filter(function(x) {return x});

  async.each(connections, function(conn, cb) { 
    conn.open(function(err) {
      conn.initError = err;
      cb(err);
    });
  }, function(err) {
    callback(err, connections)
  });
}

exports.findConnections = findConnections;