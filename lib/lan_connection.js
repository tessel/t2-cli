var Client = require('ssh2').Client;
var fs = require('fs');
var Promise = require('bluebird');
var mdns = require('mdns-js');
var shellescape = require('shell-escape');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var path = require('path');
var Tessel = require('./tessel/tessel');
var debug = require('debug')('discovery:lan');
var logs = require('./logs');

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
    this.auth.privateKey = opts.privateKey || fs.readFileSync(path.join(Tessel.TESSEL_AUTH_PATH + '/id_rsa'));
  }
};

LAN.Connection.prototype.exec = function(command) {
  var self = this;
  return new Promise(function(resolve, reject) {

    // Execute the command
    if (!Array.isArray(command)) {
      return reject(new Error('Command to execute must be an array of args.'));
    }
    // Turn an array of args into a string to execute over SSH
    command = self._processArgsForTransport(command);

    // Execute the bash command
    self.ssh.exec(command, function(err, godStream) {
      if (err) {
        return reject(err);
      }

      godStream.stdin = godStream;
      godStream.stdout = godStream;

      return resolve(godStream);
    });
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
    self.ssh = new Client();
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
    scanner.on('error', function(error) {
      // Handle any errors encountered by the scanner
      if (logs.verbose) {
        logs.err(error.message);
      }
    });
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

util.inherits(LAN.Scanner, EventEmitter);

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
        process.nextTick(function() {
          self.emit('error', err);
        });
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
        process.nextTick(function() {
          self.emit('error', err);
        });
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
