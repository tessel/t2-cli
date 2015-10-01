var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

Tessel.prototype.eraseScript = function() {
  var self = this;

  logs.info('Erasing files from Flash...');
  return self.simpleExec(commands.stopRunningScript())
    .then(function stopped() {
      return self.simpleExec(commands.disablePushedScript())
    })
    .then(function disabled() {
      return self.simpleExec(commands.deleteFolder(Tessel.PUSH_PATH))
        .then(function erased() {
          logs.info('Files erased.');
        })
    })
    .catch(function(error) {
      // If we get a notice that the command failed
      if (error.message.indexOf('Command failed') !== -1) {
        // Let the user know what went wrong
        return Promise.reject('No files have been pushed. Run `tessel push FILE` to push to Flash.');
      } else {
        // Otherwise this is an unexpected error
        return Promise.reject('An unexpected error occurred:' + error.message);
      }
    });
};
