var tessel = require('tessel')
  , ssh = require('./tessel-ssh')
  ;

function sftpDeploy(opts, push) {
  var filepath = '/tmp/remote_script';
  if (push) {
    filepath = '/app';
  }

  tessel.logs.info('Connecting to remote Tessel...');

  // Create a new SSH client connection object
  ssh.createConnection(function(err, conn) {

    // Throw any errors that pop up
    if (err) throw err;

    // Log that it was successful
    tessel.logs.info('Connected.');

    // Stop any running processes and remove old files
    conn.exec('/etc/init.d/tessel-app stop; rm -rf ' + filepath, function(err, stdin) {
      stdin.on('close', function () {
        tessel.logs.info('Bundling up code...');
        // Command V2 to extract a tarball it receives on stdin to the remote deploy dir
        conn.exec('mkdir ' + filepath + '/; tar -x -C ' + filepath, function(err, rstdin) {
          rstdin.on('error', function(e) {
            tessel.logs.error("Unable to deploy code:", e);
            process.exit(1);
          });

          // Gather details about the file structure of the script being sent
          var ret = tessel.analyzeScript(process.cwd() + "/" + opts.entryPoint, {verbose: opts.verbose});
          // Tar up the code to improve transfer rates
          tessel.tarCode(ret.pushdir, {node: true}, function(err, bundle) {
            tessel.logs.info('Bundled.')
            // Throw any unfortunate errors
            if (err) throw err;

            tessel.logs.info('Deploying code of size', ret.size, 'bytes ...');
            // Write the zipped code to stdin on v2

            // Wait for the transfer to finish...
            rstdin.once('finish', function() {
              tessel.logs.info('Deployed.');
              if (push) {
                tessel.logs.info('Setting up to run on boot...');
                conn.exec("echo '#!/bin/sh\ncd /app\nexec node .' > " + filepath + "/start && chmod +x '" + filepath + "/start'", function (err, newStream) {
                  newStream.on('close', function () {
                    tessel.logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
                    tessel.logs.info('Running script...');
                    // Once it has been written, run the script with Node
                    conn.exec('/etc/init.d/tessel-app start', function(err, stream) {
                      stream.on('close', function() {
                        conn.end();
                      })
                    });
                  });
                });
              } else {
                tessel.logs.info('Running script...');
                // Once it has been written, run the script with Node
                conn.exec('node ' + filepath + '/' + ret.relpath, function(err, stream) {
                  if (err) throw err;
                  stream.on('close', function(code, signal) {
                    stream.signal('KILL');
                    conn.end();
                  }).on('data', function(data) {
                    console.log(data.toString());
                  }).stderr.on('data', function(data) {
                    console.log("Err: ", data.toString());
                    stream.signal('KILL');
                    conn.end();
                  });
                });
              }
            });
            rstdin.end(bundle);
          });
        });
      });
    });
  });
}

module.exports.sftpDeploy = sftpDeploy;
