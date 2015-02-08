var Client = require('ssh2').Client
  , conn = new Client()
  , fs = require('fs')
  , tessel = require('tessel')
  , envfile = require('envfile')
  , config = envfile.parseFileSync('config.env')
  ;

// Open up an SSH Connection
conn.on('ready', function() {
  // Log that it was successful
  console.log('Client :: ready');

  // Start an SFTP Transfer
  conn.sftp(function transferStarted (err, sftp) {
    // Throw any unfortunate errors
    if (err) throw err;

    // Command V2 to extract a tarball it receives on stdin to the remote deploy dir
    conn.exec('tar -x -C /root/remote-script', function(err, rstdin) {
      // Gather details about the file structure of the script being sent
      var ret = tessel.analyzeScript(__dirname + '/test/test-deploy-script.js', {verbose: true});
      // Tar up the code to improve transfer rates
      tessel.tarCode(ret.pushdir, {node: true}, function(err, bundle) {
        // Throw any unfortunate errors
        if (err) throw err;

        // Write the zipped code to stdin on v2
        rstdin.end(bundle);

        // Once it has been written, run the script with Node
        conn.exec('node remote-script/', function(err, stream) {
          if (err) throw err;
          stream.on('close', function(code, signal) {
            conn.end();
          }).on('data', function(data) {
            console.log(data.toString());
          }).stderr.on('data', function(data) {
            // console.log(data.toString());
          });
        });
      });
    }); 
  });
}).connect({
  host: config.host,
  port: 22,
  username: config.username,
  privateKey: require('fs').readFileSync(config.keyPath),
  passphrase: config.keyPassphrase
});

