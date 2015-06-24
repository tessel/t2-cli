var commands = require('../../lib/tessel/commands'),
  Promise = require('bluebird')

var numPings = 3;

// takes in opts.host
module.exports = function(opts, selectedTessel) {
  return new Promise(function(resolve, reject) {
    // Send some pings to a remote website
    selectedTessel.connection.exec(commands.checkConnection(opts.host, numPings), function(err, remoteProc) {
      if (err) {
        return reject(err);
      }

      // Var to batch incoming data
      var pingData = '';

      remoteProc.once('error', function(err) {
        return reject(new Error("Ping test failed: Unable to receive data..." + err));
      })

      // When data comes in about ping results, store it
      remoteProc.stdout.on('data', function(data) {
        pingData += data.toString();
      });

      // When the command finishes
      remoteProc.once('close', function() {

        // Check if it passes our tests
        if (ethernetTest(pingData)) {

          // It worked. Set the success LED
          selectedTessel.setBlueLED(1)
          .then(function() { 
            return resolve(selectedTessel);
          });
        }
        // test failed
        else { 
          return reject("Unable to receive data over ethernet");
        }
      })
    })
  });
}

// The hackiest test ever written my god
// test passes if it got all the data from the ping
function ethernetTest(data) {
  // The hackiest test ever written my god
  // test passes if it got all the data from the ping
  if (data.indexOf('64 bytes from') != -1) {
    return true;
  }
  // test failed
  else { 
   return false;
  }
}