var Client = require('ssh2').Client
  , envfile = require('envfile')
  , osenv = require('osenv')
  , fs = require('fs')
  , async = require('async')
  , Tessel = require('./tessel/tessel')
  , listMdns = require('./tessel/mdns-list')
  , Promise = require('bluebird')
  ;

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

LANConnection.prototype.open = function(callback) {
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
      // Reject with error
      reject(err);
    }).connect(self.auth);
  });
}

// Find all LAN connected Tessels
function findConnections() {
  var lanConfig, envConfig;
  // Grab all mDNS connected Tessels
  return findmDNSConnections()
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
              port: 22,
              privateKey: fs.readFileSync(envConfig.keyPath),
              passphrase: envConfig.keyPassphrase
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
      if (tessel.host === lanConfig.host){
        return new LANConnection(lanConfig);
      }
      // Add credentials before testing?
      return new LANConnection(tessel);
    }, {concurrency: 6})
    // Test the connections.
    // Not sure if we want to throw errors here or somewhere else.
    .map(function(connection){
      return connection.open();
    }, {concurrency: 6});
}

function findmDNSConnections(callback) {
  return listMdns()
}

module.exports.findConnections = findConnections;
