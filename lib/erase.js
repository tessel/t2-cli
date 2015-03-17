var tessel = require('tessel')
  , ssh = require('./tessel-ssh')
  ;

function erase(opts) {
  var filepath = '/app';

  tessel.logs.info('Connecting to remote Tessel...');

  // Create a new SSH client connection object
  ssh.createConnection(function(err, conn) {

    // Throw any errors that pop up
    if (err) throw err;

    // Log that it was successful
    tessel.logs.info('Connected.');

    tessel.logs.info('Erasing code...');
    // Command V2 to extract a tarball it receives on stdin to the remote deploy dir
    conn.exec('rm -rf ' + filepath, function(err, rstdin) {
      rstdin.on('error', function(e) {
        tessel.logs.error("Unable to erase code:", e);
        process.exit(1);
      });
      rstdin.end(function () {
        tessel.logs.info('Code erased.');
        process.exit(1);
      });
    });
  });
}

module.exports.erase = erase;