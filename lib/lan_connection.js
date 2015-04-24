var Client = require('ssh2').Client
  , envfile = require('envfile')
  , osenv = require('osenv')
  , fs = require('fs')
  , async = require('async')
  , Tessel = require('./tessel/tessel')
  , Promise = require('bluebird')
  , _ = require('lodash')
  , mdns = require('mdns-js')
  , path = require('path')
  , expandTilde = require('expand-tilde')
  ;

//if you have another mdns daemon running, like avahi or bonjour, uncomment following line
mdns.excludeInterface('0.0.0.0');

function LANConnection(opts) {
  this.auth = {};
  this.ip = Array.isArray(opts.addresses) ? opts.addresses[0] : opts.host;
  this.auth.host = opts.host || '';
  this.auth.port = opts.port || 22;
  this.auth.username = opts.username || 'root'
  this.auth.privateKey = opts.privateKey || fs.readFileSync(osenv.home() + '/.tessel/id_rsa');
  this.auth.passphrase = opts.passphrase || '';
  this.auth.readyTimeout = 5000;
  this.connectionType = 'LAN';
  this.authorized = false;
  this.ssh;
}

LANConnection.prototype.exec = function(command, callback) {
  // Execute the command
  this.ssh.exec(command, function(err, godStream) {
    if (err) {
      return callback && callback(err);
    }

    var streams = { stdin: godStream, stdout: godStream, stderr: godStream.stderr};

    return callback && callback(null, streams);
  });
}

LANConnection.prototype.end = function() {
  this.ssh.end();
}

LANConnection.prototype.open = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // Create a new SSH client connection object
    self.ssh = new Client()
    // Open up an SSH Connection
    self.ssh.on('ready', function() {
      // Tessel allows connection
      self.authorized = true;
      // Resolve with connection
      resolve(self);
    });
    self.ssh.on('error', function(err) {
      // Tessel does not allow connection
      self.authorized = false;
      // Reject with error
      resolve(self);
    }).connect(self.auth);
  });
}

// Find all LAN connected Tessels
function findConnections(timeout) {
  var lanConfig, envConfig;
  // Grab all mDNS connected Tessels
  return findmDNSConnections(timeout)
    // TODO: Remove this step once Tessel Setup is built
    .then(function(tessels){
      return new Promise(function(resolve, reject) {
        // Check if a config file exists
        fs.exists(__dirname + '/../config.env', function (exists) {
          // If it does
          if (exists) {
            // parse it
            envConfig = envfile.parseFileSync(__dirname + '/../config.env')
            // Create a LAN Config with the provided auth credentials
            lanConfig = {
              host: envConfig.host,
              username: 'root',
              port: envConfig.port || 22,
              privateKey: fs.readFileSync(expandTilde(envConfig.keyPath)),
              passphrase: envConfig.keyPassphrase
            }

            // Push localhost as an option.
            if (envConfig.host == '127.0.0.1') {
              tessels.push({
                host: '127.0.0.1'
              });
            }
          } else {
            return reject('Set up your config.env with keyPath and keyPassphrase');
          }
          // Pass the tessel's through or else you have no tessels
          return resolve(tessels);
        });
      });
    })
    // Create new LAN connections for each tessel.
    .map(function(tessel){
      try {
        if (tessel.host === lanConfig.host){
          return new LANConnection(lanConfig);
        }
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
    })
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
        return callback && callback(error);
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
