var fs = require('fs')
  , readLine = require ("readline")
  , keypress = require('keypress')
  , ssh = require('./tessel-ssh');
  ;

function sshRoot (opts) {

  ssh.createConnection(function connectionCreated(err, conn) { 
    if (err) throw err;
    keypress(process.stdin);

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
  });
}

module.exports.sshRoot = sshRoot;