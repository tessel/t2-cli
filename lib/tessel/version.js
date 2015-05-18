var Tessel = require('./tessel')
  , commands = require('./commands')
  , Promise = require('bluebird')
  ;

var REQ_INFO = 0x30;
var REQ_INFO_VERSION = 0x0;

Tessel.prototype.getVersion = function (opts) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!opts.mcu && !opts.cp) {
      // no options were passed, do both
      opts.mcu = true;
      opts.cp = true;
    }
    var res = {};
    var waiting = [];

    if (opts.mcu) {
      waiting.push('mcu');
      // get the version from the mediatek
      var mcuData;

      self.connection.exec(commands.opkgVersion(), function(err, remoteProcess) {
        remoteProcess.stderr.on('data', function(d) {
          logs.err(d.toString());
        });

        // Gather the results
        remoteProcess.stdout.on('data', function(d) {
          mcuData += d;
        });

        remoteProcess.once('close', function() {
          self.connection.end(function() {
            // Return the version
            version = mcuData.match(/(Version: )(.*)/);
            if (version && version.length >= 2) {
              version = version[2];
            } else {
              // error could not parse out version number
              return reject("Could not find MCU version number, got", mcuData);
            }
            gotData('mcu', version);
          });
        });
      });
    }

    if (opts.cp) {
      waiting.push('cp');
      // get the version from the cp
      self.connection.device.controlTransfer(0xC0, REQ_INFO, REQ_INFO_VERSION, 0, 64, function(err, data) {
        if (err) {
          logs.err(err);
          return reject(err);
        }
        gotData('cp', data.toString());
      });
    }

    function gotData(key, data){
      waiting.splice(waiting.indexOf(key), 1);

      if (opts.build) {
        data = data.split('-')[data.split('-').length - 1];
      } else {
        // return the version number
        data = data.split('-')[0];
      }

      res[key] = data;
      if (waiting.length == 0) {
        return resolve(res);
      }
    }
  });
}
