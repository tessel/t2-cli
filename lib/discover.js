var usb = require('./usb_connection'),
  lan = require('./lan_connection'),
  Tessel = require('./tessel/tessel'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter;

function TesselSeeker() {
  this.lanScan = undefined;
  this.seekDuration = undefined;
}

util.inherits(TesselSeeker, EventEmitter);

TesselSeeker.prototype.start = function() {
  var self = this;

  self.lanScan = lan.startScan();

  self.lanScan.on('connection', connectionHandler.bind(self));

  self.usbScan = usb.startScan();

  self.usbScan.on('connection', connectionHandler.bind(self));

  function connectionHandler(conn) {
    var tessel = new Tessel(conn);
    tessel.connection.open()
      .then(function() {
        if (conn.connectionType === 'LAN' && !conn.authorized) {
          tessel.name = conn.host.slice(0, -6);
          self.emit('tessel', tessel);
        } else {
          tessel.getName(function(err) {
            if (err) {
              tessel.name = '{Unknown}';
            }
            self.emit('tessel', tessel);
          });
        }
      });
  }

  return self;
};

TesselSeeker.prototype.stop = function() {
  if (this.lanScan === this.usbScan === undefined) {
    return;
  }

  if (this.lanScan !== undefined) {
    this.lanScan.stop();

    this.lanScan = undefined;
  }

  if (this.usbScan !== undefined) {
    this.usbScan.stop();

    this.usbScan = undefined;
  }

  return this;
};

module.exports.TesselSeeker = TesselSeeker;
