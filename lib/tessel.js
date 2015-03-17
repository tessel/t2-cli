var commands = require('./commands')
  , tessel = require('tessel')
  ;

var RUN_PATH = '/tmp/remote-script/';
var PUSH_PATH = '/app';

/* 
  Constructor function for Tessel objects
    param connection: the Connection object that represents the physical comm bus
*/
function Tessel(connection) {
  // Set the connection var so we have an abstract interface to relay comms
  this.connection = connection;
  // The human readable name of the device
  this.name;
  // The unique serial number of the device
  this.serialNumber;
}

/* 
  List available WiFi networks
    param opts: unused so far
    param callback: called upon completion in the form (err, null)
*/
Tessel.prototype.scanWiFi = function(opts, callback) {
  // this.connection.write(commands.scanWiFi, function(err, readStream) {
    
  // });
}

/* 
  Run a script on a Tessel
    param opts: unused so far
    param push: whether or not this script is pushed into RAM or flash
*/
Tessel.prototype.runScript = function(opts, push) {
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
              this.connection.exec(commands.runOnBoot(filepath), function (err, streams) {
                streams.stdin.on('close', function () {
                  tessel.logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
                  tessel.logs.info('Running script...');
                  // Once it has been written, run the script with Node
                  conn.exec(commands.startPushedScript(), function(err, streams) {
                    streams.stdin.on('close', function() {
                      conn.end();
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

/* 
  Fetch the human friendly name of this Tessel.
    param callback: called upon completion in the form (err)
*/
Tessel.prototype.getName = function(callback) {
  // TODO: actually fetch a name
  // this.write(commands.getIdentification, function(err, readStream) {

  // });
  // This is for testing purposes only
  this.name = 'Jon\'s Tessel'
  callback && callback();
}

module.exports = Tessel;