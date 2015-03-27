var Client = require('ssh2').Client
  , envfile = require('envfile')
  , osenv = require('osenv')
  , fs = require('fs')
  , async = require('async')
  , Tessel = require('./tessel/tessel')
  , listMdns = require('./tessel/list')
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
  // Create a new SSH client connection object
  this.ssh = new Client()
  // Open up an SSH Connection
  this.ssh.on('ready', function() {
    callback && callback(null);
  });
  this.ssh.on('error', function(err) {
    callback && callback(err);
  }).connect(this.auth);
}

// Find all LAN connected Tessels
function findConnections(callback) {

  // Grab all mDNS connected Tessels
  findmDNSConnections(function(err, connections) {
    // Riase any errors
    if (err) {
      return callback && callback(err);
    }

    // Check if a config file exists
    fs.exists(__dirname + '/../config.env', function (exists) {
      // If it does
      if (exists) {
        // parse it
        config = envfile.parseFileSync(__dirname + '/../config.env')
        // Create a LAN Connection with the provided auth credentials
        var conn = new LANConnection({
          host: config.host,
          username: 'root',
          port: 22,
          privateKey: fs.readFileSync(config.keyPath),
          passphrase: config.keyPassphrase
        });

        // Insert the specified connection as the first item
        // so that it will be preferred
        connections.unshift(conn);
      }

      // Open the connections and return them
      return openConnections(connections, callback);
    });
  });

  // For each LAN Conenction, try to open up an SSH session
  // Should we really be doing this here?
  function openConnections(connections, callback) {
    async.each(connections, function(conn, cb) {
      conn.open(function(err) {
        conn.initError = err;
        cb(err);
      });
    }, function(err) {
      callback(err, connections)
    });
  }
}

// TODO: Actually find Tessels on the network using mDNS
function findmDNSConnections(callback) {
  listMdns(function(error, tessels){
    if(error){
      console.log('error', error)
    }
    var connections = [];
    tessels.forEach(function(tessel){
      connections.push(new LANConnection(tessel));
    });
    callback &&  callback(null, connections);
  });
}



module.exports.findConnections = findConnections;
