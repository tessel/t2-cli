var commands = require('../../lib/tessel/commands'),
    logs = require('../../lib/logs'),
    Promise = require('bluebird')

// We are testing two usb ports
var NUM_USB_PORT = 2;

function checkVidPid(opts, selectedTessel) {
  return new Promise(function(resolve, reject) {
    // List USB devices with VID and PID matching provided options
    selectedTessel.connection.exec(commands.listUSBDevices(opts.vid, opts.pid), function(err, remoteProc) {
      // Report any errors
      if (err) { 
        return reject(err);
      }

      // Var for gathering strings
      var devices = '';

      // We need this error handler because the lsusb function
      // will return a non-zero exit value if no devices are found
      remoteProc.once('error', function() {});

      // Report any errors that get reported on the remote process
      remoteProc.stderr.on('data', function(d) {
        logs.err(d.toString());
      });

      // Add new data strings to the concatenated var
      remoteProc.stdout.on('data', function(d) {
        devices += d;
      });

      // When the process completes
      remoteProc.once('close', function() {

        // Each listed device will have a newline and we must
        // account for the default newline at the end of the command
        var numDevices = devices.split('\n').length - 1;

        // If we didn't get a device on each port
        if (numDevices != NUM_USB_PORT) {
          // Fail the test
          reject("Incorrect number of USB devices detected: " + numDevices);
        }
        else {
          // Otherwise it worked. Set the success LED
          selectedTessel.setGreenLED(1)
          .then(function() { 
            logs.info("USB Tests Passed.")
            return resolve(selectedTessel);
          })
        }
      })
    })
  });
}

// opts.filePath = path of file to dd
// opts.bytes = number of bytes to dd
// opts.verify = buffer of data to verify against
function readFile(opts, selectedTessel) {
  return new Promise(function(resolve, reject) {
    console.log("reading file", opts.filePath);
    selectedTessel.connection.exec(commands.readDisk(opts.filePath, opts.bytes), function(err, remoteProc) {
      if (err) { 
        return reject(err);
      }

      var foundFile = null;
      var err = '';
      remoteProc.stderr.on('data', function(d) {
        // eat up the error because dd shows the records read on stederr
        err += d.toString();
      });

      // Add new data strings to the concatenated var
      remoteProc.stdout.on('data', function(d) {
        if (!foundFile) {
          foundFile = d;
        } else {
          foundFile = Buffer.concat([foundFile, d]);
        }
      });

      remoteProc.once('close', function() {
        // check buffer equals. node 0.10 does not have buffer.equals

        function rejectErr() {
          reject("file found does not match verification file. Found:"+foundFile+", expected: "+opts.verify);
        }

        if (foundFile.length != opts.verify.length) {
          return rejectErr();
        }

        for (var i = 0; i < foundFile.length; i++) {
          if (foundFile[i] !== opts.verify[i]) return rejectErr();
        }

        return resolve(selectedTessel);
      });
    });
  });
}

module.exports.checkVidPid = checkVidPid;
module.exports.readFile = readFile;