var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  , fs = require('fs')
  ; 

var RUN_PATH = '/tmp/remote-script/';
var PUSH_PATH = '/app/';
var PUSH_START_SCRIPT_NAME = 'start';
var NODE_PUSH_SCRIPT = __dirname + '/../../resources/start_node_script.sh';
/* 
  Run a script on a Tessel
    param opts: unused so far
    param push: whether or not this script is pushed into RAM or flash
*/
Tessel.prototype.deployScript = function(opts, push) {
  var self = this;

  var filepath = push ? PUSH_PATH : RUN_PATH;
  if (push) {
    filepath = PUSH_PATH;
  }
  // Stop any running processes
  self.connection.exec(commands.stopRunningScript(), function(err, streams) {
    if (err) throw err;
    // Remove the old scripts
    self.connection.exec(commands.deleteFolder(filepath), function(err, streams) {
      if (err) throw err;
      // Once they are removed...
      streams.stdout.once('end', function () {
        tessel.logs.info('Bundling up code...');
        // Command V2 to extract a tarball it receives on stdin to the remote deploy dir
        self.connection.exec(commands.createFolder(filepath), function(err, streams) {
          streams.stderr.pipe(process.stderr);
          if (err) throw err;
          streams.stdout.once('end', function() {
            self.connection.exec(commands.untarStdin(filepath), function(err, streams) {

              streams.stderr.on('error', function(e) {
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

                // Wait for the transfer to finish...
                streams.stdin.once('finish', function() {
                  tessel.logs.info('Deployed.');

                  if (push) {
                    // Write the node start file
                    self.connection.exec(commands.openStdinToFile(PUSH_PATH + PUSH_START_SCRIPT_NAME), function(err, streams) {
                      if (err) throw err;
                      streams.stdin.once('finish', function() {
                        tessel.logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
                        tessel.logs.info('Running script...');
                        // Once it has been written, run the script with Node
                        self.connection.exec(commands.startPushedScript(), function(err, streams) {
                          self.connection.end(function() {
                            process.exit(1);
                          });
                        });
                      });
                      fs.readFile(NODE_PUSH_SCRIPT, function(err, data) {
                        if (err) throw err;
                        streams.stdin.end(data);
                      })
                    });
                  } else {
                    tessel.logs.info('Running script...');
                    // Once it has been written, run the script with Node
                    self.connection.exec(commands.runScript(filepath, ret.relpath), function(err, streams) {
                      if (err) throw err;

                      // Once we get a SIGINT from the console
                      process.once('SIGINT', function () {
                        // Kill the process (should cause the stream to close)
                        tessel.logs.info("Stopping script...");
                      });

                      // When the stream closes
                      streams.stdout.once('end', function(code, signal) {
                        // End the connection
                        self.connection.end(function() {
                          // Exit the process
                          process.exit(1);
                        });
                      });

                      // Pipe data and errors
                      streams.stdout.pipe(process.stdout);
                      streams.stderr.pipe(process.stderr);
                    });
                  }
                });
                // Write the code bundle to the hardware
                streams.stdin.end(bundle);
              });
            });
          });
        });
      });
    });
  });
}