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
  this.scanTimeout = undefined;
}

util.inherits(TesselSeeker, EventEmitter);

TesselSeeker.prototype.start = function(timeout) {
  var self = this;

  // An array of pending open connections
  var pendingOpen = [];

  self.lanScan = lan.startScan();

  self.lanScan.on('connection', connectionHandler.bind(self));

  self.usbScan = usb.startScan();

  self.usbScan.on('connection', connectionHandler.bind(self));

  function connectionHandler(conn) {
    var tessel = new Tessel(conn);
    var opening = tessel.connection.open()
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
              return Promise.resolve();
            })
            .catch(function(err) {
              logs.err('unable to fetch name:', err);
              return Promise.resolve();
            });
        }
      });
    // Push this Promise into the pending array
    pendingOpen.push(opening);
  }

  // If a timeout was provided
  if (timeout && typeof timeout === 'number') {
    // Set a timeout function
    self.scanTimeout = setTimeout(function() {
      debug('Timeout hit! Waiting for pending to finish...');
      // Once all the pending open commands complete
      Promise.all(pendingOpen)
        // Stop the scan (which emits 'end')
        .then(function() {
          debug('Done! Stopping.');
          self.stop();
        });
    }, timeout);
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

  // If a timeout was provided
  if (this.scanTimeout) {
    // Clear that timeout
    clearTimeout(this.scanTimeout);
    // Emit that this scan stopped
    setImmediate(function() {
      this.emit('end');
    }.bind(this));
  }

  return this;
};

module.exports.TesselSeeker = TesselSeeker;
