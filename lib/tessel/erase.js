var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

Tessel.prototype.eraseScript = function() {
  var self = this;
  return new Promise(function(resolve, reject) {

    logs.info('Erasing files from Flash...');
    // Stop processes and delete everything in the folder
    self.connection.exec(commands.stopRunningScript(), function(err, remoteProcess) {
      // Buffer to store incoming error data
      var errBuf = new Buffer(0);
      //If we receive error data (which we would if there is no script running)
      remoteProcess.stderr.on('data', function(e) {
        // Concatenate the data
        errBuf = Buffer.concat([errBuf, e]);
      });
      // Once the process completes
      remoteProcess.once('close', function() {
        // Check if an error occurred
        if (errBuf.length) {
          // If we get a notice that the command failed
          if (errBuf.toString().indexOf('Command failed') !== -1) {
            // Let the user know what went wrong
            reject('No files have been pushed. Run `tessel push FILE` to push to Flash.');
          } else {
            // Otherwise this is an unexpected error
            reject('An unexpected error occurred:' + errBuf.toString());
          }
        }
        // Assume it worked if there was no error
        else {
          logs.info('Files erased.');
          resolve();
        }
      });
    });
  });
};
