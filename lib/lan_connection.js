var Client = require('ssh2').Client,
  osenv = require('osenv'),
  fs = require('fs'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  mdns = require('mdns-js'),
  shellescape = require('shell-escape'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter;

//if you have another mdns daemon running, like avahi or bonjour, uncomment following line
mdns.excludeInterface('0.0.0.0');

function LANConnection(opts) {
  this.auth = {};
  this.ip = Array.isArray(opts.addresses) ? opts.addresses[0] : opts.host;
  this.host = opts.host || '';
  this.auth.host = this.ip;
  this.auth.port = opts.port || 22;
  this.auth.username = opts.username || 'root';
  this.auth.privateKey = opts.privateKey || fs.readFileSync(osenv.home() + '/.tessel/id_rsa');
  this.auth.passphrase = opts.passphrase || '';
  this.auth.readyTimeout = 5000;
  this.connectionType = 'LAN';
  this.authorized = false;
  this.ssh = undefined;
}

LANConnection.prototype.exec = function(command, callback) {
  // Execute the command
  if (!Array.isArray(command)) {
    return callback && callback(new Error('Command to execute must be an array of args.'));
  }

  // Turn an array of args into a string to execute over SSH
  command = this._processArgsForTransport(command);

  // Execute the bash command
  this.ssh.exec(command, function(err, godStream) {
    if (err) {
      return callback && callback(err);
    }

    godStream.stdin = godStream;
    godStream.stdout = godStream;

    return callback && callback(null, godStream);
  });
};

LANConnection.prototype.end = function(callback) {
  // End the SSH connection
  this.ssh.end();
  // If a callback was provided
  if (typeof callback === 'function') {
    // Call the callback
    callback();
  }
};

LANConnection.prototype.open = function() {
  var self = this;
  return new Promise(function(resolve) {
    // Create a new SSH client connection object
    self.ssh = new Client();
    // Open up an SSH Connection
    self.ssh.on('ready', function() {
      // Tessel allows connection
      self.authorized = true;
      // Resolve with connection
      resolve(self);
    });
    self.ssh.on('error', function() {
      // Tessel does not allow connection
      self.authorized = false;
      // Reject with error
      resolve(self);
    }).connect(self.auth);
  });
};

LANConnection.prototype._processArgsForTransport = function(command) {

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
    scanner = new Scanner();
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

function Scanner() {
  this.browser = undefined;
  this.discovered = [];
}

util.inherits(Scanner, EventEmitter);

Scanner.prototype.start = function() {
  var self = this;

  setImmediate(function startScanning() {
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
        // Check if it's a Tessel
        if (_.findIndex(self.discovered, data) > -1) {
          return;
        }

        var connection = new LANConnection(data);

        self.emit('connection', connection);
      } catch (err) {
        process.nextTick(function() {
          self.emit('error', err);
        });
      }
    });
  });
};

Scanner.prototype.stop = function() {
  this.browser.stop();
};

module.exports.startScan = startScan;
module.exports.stopScan = stopScan;
