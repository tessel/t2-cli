var usb = require('./usb_connection'),
  lan = require('./lan_connection'),
  Tessel = require('./tessel/tessel'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  debug = require('debug')('discovery'),
  logs = require('./logs');

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
        debug('Connection opened:', tessel.connection.host);
        if (conn.connectionType === 'LAN' && !conn.authorized) {
          tessel.name = conn.host.slice(0, -6);
          self.emit('tessel', tessel);
        } else {
          debug('Fetching name:', tessel.connection.host);
          tessel.getName()
            .then(function() {
              self.emit('tessel', tessel);
            })
            .catch(function(err) {
              logs.error('unable to fetch name:', err);
            });
        }
      });
  }

  return self;
};

TesselSeeker.prototype.stop = function() {

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
