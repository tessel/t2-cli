// System Objects
var events = require('events');
var util = require('util');

var Emitter = events.EventEmitter;

// Third Party Dependencies
var debug = require('debug')('discovery');

// Internal
var lan = require('./lan-connection');
var log = require('./log');
var Tessel = require('./tessel/tessel');
var usb = require('./usb-connection');


function TesselSeeker() {
  this.lanScan = null;
  this.usbScan = null;
  this.seekDuration = undefined;
  this.scanTimeout = undefined;
}

util.inherits(TesselSeeker, Emitter);

TesselSeeker.prototype.start = function(opts) {
  // Initialize the opts if it wasn't provided
  opts = opts || {};

  // An array of pending open connections
  var pendingOpen = [];

  var connectionHandler = (conn) => {
    var tessel = new Tessel(conn);
    var opening = tessel.connection.open()
      .then(() => {
        if (opts.authorized !== undefined) {
          if (tessel.connection.authorized !== opts.authorized) {
            debug('Kicking ' + conn.host.slice(0, -6) + ' due to authorized filter: ' + opts.authorized);
            return Promise.reject();
          }
        }
        /*if (opts.authorized && !tessel.connection.authorized) {
          debug('Kicking ' + conn.host.slice(0, -6) + ' due to authorized filter: ' + opts.authorized);
          return;
        }*/
      })
      .then(() => {
        debug('Connection opened:', tessel.connection.host);
        if (conn.connectionType === 'LAN' && !conn.authorized) {
          tessel.name = conn.host.slice(0, -6);
          this.emit('tessel', tessel);
        } else {
          debug('Fetching name:', tessel.connection.host);
          return tessel.getName()
            .then(() => {
              this.emit('tessel', tessel);
              return Promise.resolve();
            });
        }
      }).catch(function(err) {
        debug('Error opening device', err);
        if (tessel.connection.connectionType === 'USB') {
          log.warn('Detected a Tessel that may be booting.');
        }
      });
    // Push this Promise into the pending array
    pendingOpen.push(opening);
  };

  // If the user explicitly specified the usb flag,
  // then cli should not filter on authorization status.
  if (opts.usb && !opts.lan) {
    opts.authorized = undefined;
  }

  // If no connection preference was supplied
  if (!opts.usb && !opts.lan) {
    // Default to all connections
    opts.usb = opts.lan = true;
  }

  // If the user has specifically requested lan devices
  if (opts.lan) {
    debug('Will scan for LAN devices');
    // Start the scan
    this.lanScan = lan.startScan();
    // When we get a connection, handle it
    this.lanScan.on('connection', connectionHandler);
  }

  // If the user has explicitly requested a USB search
  if (opts.usb) {
    debug('Will scan for USB devices');
    // Start the scan
    this.usbScan = usb.startScan();
    // When we get a connection, handle it
    this.usbScan.on('connection', connectionHandler);
  }

  // If a timeout was provided
  if (opts.timeout && typeof opts.timeout === 'number') {
    // Set a timeout function
    this.scanTimeout = setTimeout(() => {
      debug('Timeout hit! Waiting for pending to finish...');
      // Once all the pending open commands complete
      Promise.all(pendingOpen)
        // Stop the scan (which emits 'end')
        .then(() => {
          debug('Done! Stopping.');
          this.stop();
        });
    }, opts.timeout);
  }

  return this;
};

TesselSeeker.prototype.stop = function() {

  if (this.lanScan !== null) {
    this.lanScan = lan.stopScan();
  }

  if (this.usbScan !== null) {
    this.usbScan = usb.stopScan();
  }

  // If a timeout was provided
  if (this.scanTimeout) {
    // Clear that timeout
    clearTimeout(this.scanTimeout);
    // Emit that this scan stopped
    setImmediate(() => this.emit('end'));
  }

  return this;
};

module.exports.TesselSeeker = TesselSeeker;
