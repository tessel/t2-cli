var Tessel = require('./tessel')
  , commands = require('./commands')
  ;

Tessel.prototype.getName = function(callback) {
  var self = this;

  self.connection.exec(commands.getHostname(), function(err, remoteProc) {
    if (err) {
      callback && callback(err);
    }
    else {
      var name = '';
      remoteProc.stderr.pipe(process.stderr);

      remoteProc.stdout.on('data', function(d) {
        name += d.toString();
      });

      remoteProc.stdout.once('end', function(d) {
        self.name = name.replace(/^\s+|\s+$/g, "");
        callback && callback(null, self.name);
      })
    }
  })
};
