var Client = require('ssh2').Client
  , fs = require('fs')
  , envfile = require('envfile')
  , readLine = require ("readline")
  , config = envfile.parseFileSync(__dirname + '/../config.env')
  , keypress = require('keypress')
  ;

function ssh (opts) {
  var Client = require('ssh2').Client;
  keypress(process.stdin);

  var conn = new Client();
  conn.once('ready', function() {
    conn.shell(function(err, stream) {
      if (err) throw err;
      stream.once('close', function() {
        conn.end();
      })
      stream.pipe(process.stdout);
      stream.stderr.pipe(process.stderr);
      // listen for the "keypress" event
      process.stdin.on('keypress', function (ch, key) {
        // console.log('got "keypress"', key);
        if (key && key.ctrl && key.name == 'c') {
          process.stdin.pause();
          conn.end();
          process.exit();
        }
        else {
          stream.write(ch);
        }
      });

      process.stdin.setRawMode(true);
      process.stdin.resume();
    });
  }).connect({
    host: opts.ip || config.host,
    port: 22,
    username: 'root',
    privateKey: require('fs').readFileSync(opts.keyPath || config.keyPath),
    passphrase: opts.keyPassphrase || config.keyPassphrase
  });
}

module.exports.ssh = ssh;