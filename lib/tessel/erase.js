// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var logs = require('../logs');
var Tessel = require('./tessel');

Tessel.prototype.eraseScript = function() {
  logs.info('Erasing files from Flash...');
  return this.simpleExec(commands.stopRunningScript())
    .then(() => {
      return this.simpleExec(commands.disablePushedScript());
    })
    .then(() => {
      return this.simpleExec(commands.deleteFolder(Tessel.REMOTE_PUSH_PATH))
        .then(function erased() {
          logs.info('Files erased.');
        });
    })
    .catch((error) => {
      // If we get a notice that the command failed
      if (error.message.indexOf('Command failed') !== -1) {
        // Let the user know what went wrong
        return Promise.reject('No files have been pushed. Run `t2 push FILE` to push to Flash.');
      } else {
        // Otherwise this is an unexpected error
        return Promise.reject('An unexpected error occurred:' + error.message);
      }
    });
};
