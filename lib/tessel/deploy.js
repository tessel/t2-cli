var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  ; 

var RUN_PATH = '/tmp/remote-script/';
var PUSH_PATH = '/app';

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

  // Stop any running processes and remove old files
  self.connection.exec(commands.stopRunningScript(filepath), function(err, streams) {
    streams.stdin.on('close', function () {
      tessel.logs.info('Bundling up code...');
      // Command V2 to extract a tarball it receives on stdin to the remote deploy dir
      self.connection.exec(commands.prepareScriptPath(filepath), function(err, streams) {
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

          tessel.logs.info('Deploying code of size', ret.size, 'bytes ...');
          // Write the zipped code to stdin on v2

          // Wait for the transfer to finish...
          streams.stdin.once('finish', function() {
            tessel.logs.info('Deployed.');
            if (push) {
              tessel.logs.info('Setting up to run on boot...');
              console.log('runninng', commands.runOnBoot(filepath));
              self.connection.exec(commands.runOnBoot(filepath), function (err, streams) {
                streams.stdin.on('close', function () {
                  tessel.logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
                  tessel.logs.info('Running script...');
                  // Once it has been written, run the script with Node
                  self.connection.exec(commands.startPushedScript(), function(err, streams) {
                    streams.stdin.on('close', function() {
                      self.connection.end();
                    });
                  });
                });
              });
            } else {
              tessel.logs.info('Running script...');
              // Once it has been written, run the script with Node
              self.connection.exec(commands.runScript(filepath, ret.relpath), function(err, streams) {
                if (err) throw err;
                streams.stdin.on('close', function(code, signal) {
                  streams.stdout.signal('KILL');
                  self.connection.end();
                });
                streams.stdin.on('data', function(data) {
                  console.log(data.toString());
                });
                streams.stderr.on('data', function(data) {
                  console.log("Err: ", data.toString());
                  streams.stdout.signal('KILL');
                  self.connection.end();
                });
              });
            }
          });
          // Write the code bundle to the hardware
          streams.stdout.end(bundle);
        });
      });
    });
  });
}