var Tessel = require('./tessel')
  , commands = require('./commands')
  , logs = require('../logs')
  ;

Tessel.prototype.eraseScript = function(opts, callback) {
  var self = this;
  logs.info('Erasing files from Flash...');
  // Stop processes and delete everything in the folder
  this.connection.exec(commands.stopRunningScript(), function(err, remoteProcess) {
    var errBuf = new Buffer(0);
    remoteProcess.stderr.on('data', function(e) {
      errBuf = Buffer.concat([errBuf, e]);
    });
    remoteProcess.once('close', function () {
      if (errBuf.length) {
        if (errBuf.toString().indexOf('Command failed') != -1) {
          logs.err('No files have been pushed. Run `tessel push FILE` to push to Flash.');
        }
        else {
          logs.err('Something strange happened.');
        }
      }
      else {
        logs.info('Files erased.');
      }
      self.connection.end(function() {
        process.exit(1);
      });
    });
  });
};
