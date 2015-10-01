var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

Tessel.prototype.eraseScript = function() {
  var self = this;
  return new Promise(function(resolve, reject) {

    logs.info('Erasing files from Flash...');
    return self.simpleExec(commands.stopRunningScript())
      .then(function stopped() {
        logs.info('Files erased.');
        return resolve();
      })
      .catch(function(error) {
        // If we get a notice that the command failed
        if (error.message.indexOf('Command failed') !== -1) {
          // Let the user know what went wrong
          return reject('No files have been pushed. Run `tessel push FILE` to push to Flash.');
        } else {
          // Otherwise this is an unexpected error
          return reject('An unexpected error occurred:' + error.message);
        }
      });
  });
};
