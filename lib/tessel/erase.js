var Tessel = require('./tessel')
  , commands = require('./commands')
  , tessel = require('tessel')
  ;

Tessel.prototype.eraseScript = function(opts, callback) {
  var self = this;
  tessel.logs.info('Erasing code...');
  // Stop processes and delete everything in the folder
  this.connection.exec(commands.stopRunningScript(), function(err, streams) {
    streams.stdin.on('error', function(e) {
      tessel.logs.error("Unable to erase code:", e);
      return callback && callback(err);
    });
    streams.stdout.on('end', function () {
      tessel.logs.info('Code erased.');
      self.connection.end(function() {
        process.exit(1);
      });
    });
  });
};
