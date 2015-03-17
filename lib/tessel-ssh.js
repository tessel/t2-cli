var Client = require('ssh2').Client
  , envfile = require('envfile')
  , config = envfile.parseFileSync(__dirname + '/../config.env')
  , fs = require('fs')
  ;

function createConnection(callback) {
  // Create a new SSH client connection object
  var conn = new Client()
  // Open up an SSH Connection
  conn.on('ready', function() {
    callback && callback(null, conn);
  })
  conn.on('error', function(err) {
    callback && callback(err);
  }).connect({
    host: config.host,
    port: 22,
    username: config.username,
    privateKey: fs.readFileSync(config.keyPath),
    passphrase: config.keyPassphrase
  });
}

module.exports.createConnection = createConnection;
