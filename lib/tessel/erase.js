var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  ;

Tessel.prototype.eraseScript = function(opts, callback) {
  var self = this;
  tessel.logs.info('Erasing code...');
  // Stop processes and delete everything in the folder
  this.connection.exec(commands.stopRunningScript(), function(err, remoteProcess) {
    var errBuf = new Buffer(0);
    remoteProcess.stderr.on('data', function(e) {
      errBuf = Buffer.concat([errBuf, e]);
    });
    remoteProcess.once('end', function () {
      if (errBuf.length) {
        if (errBuf.toString().indexOf('Command failed') != -1) {
          tessel.logs.err('No code has been pushed. Run `tessel push FILE` to push to Flash.');
        }
        else {
          tessel.logs.err('Something strange happened.');
        }
      }
      else {
        tessel.logs.info('Code erased.');
      }
      tessel.logs.info("Done.");
      self.connection.end(function() {
        process.exit(1);
      });
    });
  });
};
