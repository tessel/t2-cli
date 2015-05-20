var Client = require('ssh2').Client
  , osenv = require('osenv')
  , fs = require('fs')
  , Promise = require('bluebird')
  , _ = require('lodash')
  , mdns = require('mdns-js')
  , shellescape = require('shell-escape')
  ;

//if you have another mdns daemon running, like avahi or bonjour, uncomment following line
mdns.excludeInterface('0.0.0.0');

function LANConnection(opts) {
  this.auth = {};
  this.ip = Array.isArray(opts.addresses) ? opts.addresses[0] : opts.host;
  this.auth.host = opts.host || '';
  this.auth.port = opts.port || 22;
  this.auth.username = opts.username || 'root';
  this.auth.privateKey = opts.privateKey || fs.readFileSync(osenv.home() + '/.tessel/id_rsa');
  this.auth.passphrase = opts.passphrase || '';
  this.auth.readyTimeout = 5000;
  this.connectionType = 'LAN';
  this.authorized = false;
  this.ssh;
}

LANConnection.prototype.exec = function(command, callback) {
  // Execute the command
  if (!Array.isArray(command)) {
    return callback && callback(new Error("Command to execute must be an array of args."));
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
  this.ssh.end();
  callback && callback();
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
  if (!Array.isArray(command)) return;

  // Join the args into a string
  command = shellescape(command);
  // command = command.join(' ');

  // Return the string
  return command;
};

// Find all LAN connected Tessels
function findConnections(timeout) {
  // Grab all mDNS connected Tessels
  return findmDNSConnections(timeout)
    .then(function(tessels){
      return new Promise(function(resolve) {
          // Pass the tessel's through or else you have no tessels
          return resolve(tessels);
      });
    })
    // Create new LAN connections for each tessel.
    .map(function(tessel){
      try {
        return new LANConnection(tessel);
      } catch (e) {
        return null;
      }
    })
    .filter(function (connection) {
      return connection;
    })
    // Test the connections.
    // Not sure if we want to throw errors here or somewhere else.
    .map(function(connection){
      return connection.open();
    });
}

function findmDNSConnections(timeout){
  return new Promise(function(resolve, reject) {

    // If delay given is not a number, reject
    if(typeof timeout !== 'number'){
      reject(new Error('mdns-list.js | timeout should be a number'));
      return;
    }
    // Initial list of Tessels
    var tessels = [];

    // Create a Tessel browser
    var browser = mdns.createBrowser('_tessel._tcp');

    // When the browser finds a new device
    browser.on('update', function (data) {
      // Check if it's a Tessel
      if( _.findIndex(tessels, data) > -1){
        return;
      }
      // Push it to our array
      tessels.push(data);
    });

    // When the browser becomes ready
    browser.once('ready', function(){
      try {
        // Start discovering Tessels
        browser.discover();
      } catch(error) {
        // Return if there was an error
        return reject(error);
      }

      // Otherwise, check back in after two seconds
      setTimeout(function(){
        // Stop discovering
        browser.stop();
        // Return the discovered Tessels
        resolve(tessels);
      // TODO: figure out a way to not make this a hardcoded number of seconds... just keep scanning?
      }, timeout*1000);
    });
  });
}

module.exports.findConnections = findConnections;
