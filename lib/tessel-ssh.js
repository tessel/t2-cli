var Client = require('ssh2').Client
  , envfile = require('envfile')
  , config = envfile.parseFileSync(__dirname + '/../config.env')
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
    privateKey: require('fs').readFileSync(config.keyPath)
  });
}

module.exports.createConnection = createConnection;