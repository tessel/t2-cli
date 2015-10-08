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

TesselSeeker.prototype.start = function(opts) {
  var self = this;
  self.msg = {
    noAuth: 'No Authorized Tessels Found.',
    auth: 'No Tessels Found.'
  };
  // Initialize the opts if it wasn't provided
  opts = opts || {};

  // An array of pending open connections
  var pendingOpen = [];

  // If no connection preference was supplied
  if (!opts.usb && !opts.lan) {
    // Default to all connections
    opts.usb = opts.lan = true;
  }

  // If the user has specifically requested lan devices
  if (opts.lan) {
    debug('Will scan for LAN devices');
    // Start the scan
    self.lanScan = lan.startScan();
    // When we get a connection, handle it
    self.lanScan.on('connection', connectionHandler.bind(self));
  }

  // If the user has explicitly requested a USB search
  if (opts.usb) {
    debug('Will scan for USB devices');
    // Start the scan
    self.usbScan = usb.startScan();
    // When we get a connection, handle it
    self.usbScan.on('connection', connectionHandler.bind(self));
  }

  function connectionHandler(conn) {
    var tessel = new Tessel(conn);
    var opening = tessel.connection.open()
      .then(function() {
        if (opts.authorized !== undefined) {
          if (tessel.connection.authorized !== opts.authorized) {
            debug('Kicking ' + conn.host.slice(0, -6) + ' due to authorized filter: ' + opts.authorized);
            return Promise.reject();
          } else {
            return true;
          }
        } else {
          return true;
        }
        /*if (opts.authorized && !tessel.connection.authorized) {
          debug('Kicking ' + conn.host.slice(0, -6) + ' due to authorized filter: ' + opts.authorized);
          return;
        }*/
      })
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
      }).catch(function() {
        return Promise.resolve();
      });
    // Push this Promise into the pending array
    pendingOpen.push(opening);
  }

  // If a timeout was provided
  if (opts.timeout && typeof opts.timeout === 'number') {
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
    }, opts.timeout);
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
