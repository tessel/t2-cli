// System Objects
var events = require('events');
var path = require('path');
var util = require('util');

var Emitter = events.EventEmitter;

// Third Party Dependencies
var debug = require('debug')('discovery:lan');
var fs = require('fs-extra');
var mdns = require('mdns-js');
var shellescape = require('shell-escape');
var ssh = require('ssh2');

// Internal
var Tessel = require('./tessel/tessel');

//if you have another mdns daemon running, like avahi or bonjour, uncomment following line
mdns.excludeInterface('0.0.0.0');

var LAN = {};

LAN.Connection = function(opts) {
  this.auth = {};
  this.ip = Array.isArray(opts.addresses) ? opts.addresses[0] : opts.host;
  this.host = opts.host || '';
  this.auth.host = this.ip;
  this.auth.port = opts.port || 22;
  this.auth.username = opts.username || 'root';
  this.auth.passphrase = opts.passphrase || '';
  this.auth.privateKey = undefined;
  this.auth.readyTimeout = 5000;
  this.connectionType = 'LAN';
  this.authorized = false;
  this.ssh = undefined;

  if (Tessel.isProvisioned()) {
    this.auth.privateKey = opts.privateKey || fs.readFileSync(path.join(Tessel.LOCAL_AUTH_KEY));
  }
};

LAN.Connection.prototype.exec = function(command, options, callback) {

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

  // Ensure this connection hasn't been closed
  if (this.closed) {
    return callback(new Error('Remote SSH connection has already been closed'));
  }

  // Execute the command
  if (!Array.isArray(command)) {
    return callback(new Error('Command to execute must be an array of args.'));
  }

  // Turn an array of args into a string to execute over SSH
  command = this._processArgsForTransport(command);

  // Execute the bash command
  this.ssh.exec(command, options, function(err, godStream) {
    if (err) {
      return callback(err);
    }

    godStream.stdin = godStream;
    godStream.stdout = godStream;

    return callback(null, godStream);
  });
};

LAN.Connection.prototype.end = function() {
  var self = this;
  return new Promise(function(resolve) {
    // End the SSH connection
    self.ssh.end();
    resolve();
  });
};

LAN.Connection.prototype.open = function() {
  var self = this;
  return new Promise(function(resolve) {
    // Create a new SSH client connection object
    self.ssh = new ssh.Client();
    // Open up an SSH Connection
    self.ssh.on('ready', function() {
      debug('Device ready:', self.host);
      // Tessel allows connection
      self.authorized = true;
      // Resolve with connection
      resolve(self);
    });
    self.ssh.on('error', function() {
      debug('Device open error:', self.host);
      // Tessel does not allow connection
      self.authorized = false;
      // Reject with error
      resolve(self);
    }).connect(self.auth);
    self.ssh.once('close', function() {
      self.closed = true;
    });
  });
};

LAN.Connection.prototype._processArgsForTransport = function(command) {

  // Ensure the args are an array
  if (!Array.isArray(command)) {
    return;
  }

  // Join the args into a string
  command = shellescape(command);
  // command = command.join(' ');

  // Return the string
  return command;
};

var scanner;

function startScan() {
  if (scanner === undefined) {
    scanner = new LAN.Scanner();
    scanner.start();
  }

  return scanner;
}

function stopScan() {
  if (scanner !== undefined) {
    scanner.stop();
    scanner = undefined;
  }
}

LAN.Scanner = function() {
  this.browser = undefined;
  this.discovered = [];
};

util.inherits(LAN.Scanner, Emitter);

LAN.Scanner.prototype.start = function() {
  var self = this;

  global.setImmediate(function startScanning() {
    self.browser = mdns.createBrowser('_tessel._tcp');

    // When the browser becomes ready
    self.browser.once('ready', function() {
      try {
        // Start discovering Tessels
        self.browser.discover();
      } catch (err) {
        self.emit('error', err);
      }
    });

    // When the browser finds a new device
    self.browser.on('update', function(data) {
      try {
        debug('Device found:', data.fullname);
        // Check if it's a Tessel
        if (self.discovered.indexOf(data) > -1) {
          return;
        }

        var connection = new LAN.Connection(data);

        self.emit('connection', connection);
      } catch (err) {
        self.emit('error', err);
      }
    });
  });
};

LAN.Scanner.prototype.stop = function() {
  this.browser.stop();
};

module.exports.startScan = startScan;
module.exports.stopScan = stopScan;

if (global.IS_TEST_ENV) {
  module.exports.LAN = LAN;
}
