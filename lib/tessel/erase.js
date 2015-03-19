var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  ;

Tessel.prototype.eraseScript = function(opts, callback) {
  tessel.logs.info('Erasing code...');
  // Stop processes and delete everything in the folder
  this.connection.exec(commands.stopRunningScript(PUSH_PATH), function(err, streams) {
    streams.stdin.on('error', function(e) {
      tessel.logs.error("Unable to erase code:", e);
      return callback && callback(err);
    });
    streams.stdout.end(function () {
      tessel.logs.info('Code erased.');
      return callback && Callback();
    });
  });
};