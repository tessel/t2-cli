var Tessel = require('./tessel');
var commands = require('./commands');

Tessel.prototype.nameTessel = function (opts) {
  var self = this;
  //TODO check to make sure this is the correct way to pass in options
  setHostname(opts._[1], self, function () {
    closeAndExit(self);
  });
}

// Sets the hostname of the Tessel
function setHostname (name, tessel, callback) {
  console.log('Setting hostname of Tessel to ' + name + '...');
  tessel.connection.exec(commands.setHostname(name), function (err, streams) {
    err && console.log(err);
    // If Tessel talks, listen
    streams.stderr.pipe(process.stderr);
    streams.stdout.pipe(process.stdout);
    streams.stdout.once('end', function () {
      // Commit hostname
      tessel.connection.exec(commands.commitHostname, function (err, streams) {
        err && console.log(err);
        // If Tessel talks, listen
        streams.stderr.pipe(process.stderr);
        streams.stdout.pipe(process.stdout);
        streams.stdout.once('end', function () {
          // Set hostname in kernel
          tessel.connection.exec(commands.openStdinToFile('/proc/sys/kernel/hostname'), function (err, streams) {
            err && console.log(err);
            // If Tessel talks, listen
            streams.stderr.pipe(process.stderr);
            streams.stdout.pipe(process.stdout);
            streams.stdout.once('end', function () {
              // Hostname is set
              console.log('Hostname set.');
              callback && callback();
            });
          });
        });
      });
    });
  });
}

function closeAndExit(tessel) {
  tessel.connection.end(function () {
    process.exit(0);
  });
}
