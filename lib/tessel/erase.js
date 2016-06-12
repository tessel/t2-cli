// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var log = require('../log');
var Tessel = require('./tessel');

Tessel.prototype.eraseScript = function() {
  log.info('Erasing files from Flash...');
  log.spinner.start();
  return this.simpleExec(commands.app.stop())
    .then(() => {
      return this.simpleExec(commands.app.disable());
    })
    .then(() => {
      return this.simpleExec(commands.deleteFolder(Tessel.REMOTE_PUSH_PATH))
        .then(function erased() {
          log.spinner.stop();
          log.info('Files erased.');
        });
    })
    .catch((error) => {
      log.spinner.stop();
      // If we get a notice that the command failed
      if (error.message.includes('Command failed')) {
        // Let the user know what went wrong
        return Promise.reject('No files have been pushed. Run `t2 push FILE` to push to Flash.');
      } else {
        // Otherwise this is an unexpected error
        return Promise.reject('An unexpected error occurred:' + error.message);
      }
    });
};
