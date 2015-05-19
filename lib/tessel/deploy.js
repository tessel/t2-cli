var Tessel = require('./tessel')
  , commands = require('./commands')
  , logs = require('../logs')
  , fs = require('fs')
  ;

var RUN_PATH = '/tmp/remote-script/';
var PUSH_PATH = '/app/';
var PUSH_START_SCRIPT_NAME = 'start';
var NODE_PUSH_SCRIPT = __dirname + '/../../resources/start_node_script.sh';
/*
  Run a script on a Tessel
    param opts: unused so far
    param push: whether or not this script is pushed into RAM or flash
*/
Tessel.prototype.deployScript = function(opts, push) {
  var self = this;

  var filepath = push ? PUSH_PATH : RUN_PATH;
  if (push) {
    filepath = PUSH_PATH;
  }

  // Stop running any existing scripts
  stopRunningScript(self, filepath, function() {
    // Delete any code that was previously at this file path
    deleteOldCode(self, filepath, function() {
      logs.info('Bundling up code...');
      // Create the folder again
      createNewCodeFolder(self, filepath, function() {
        // Bundle and send tarred code to T2
        untarStdin(self, filepath, opts, function(ret) {
          // If we are pushing
          if (push) {
            // Push the script into flash
            pushScript(self);
          }
          // If we are pushing
          else {
            // Push the code into ram
            runScript(self, filepath, ret);
          }
        });
      });
    });
  });
};

function stopRunningScript(t, filepath, callback) {
  // Stop running any scripts
  t.connection.exec(commands.stopRunningScript(filepath), function(err, remoteProcess) {
    if (err) throw err;

    remoteProcess.once('close', callback);
  });
}

function deleteOldCode(t, filepath, callback) {
  // Remove the old scripts
  t.connection.exec(commands.deleteFolder(filepath), function(err, remoteProcess) {
    if (err) throw err;

    // Once they are removed...
    remoteProcess.once('close', callback);
  });
}

function createNewCodeFolder(t, filepath, callback) {
  t.connection.exec(commands.createFolder(filepath), function(err, remoteProcess) {
      if (err) throw err;

    remoteProcess.once('close', callback);
  });
}

function untarStdin(t, filepath, opts, callback) {
  t.connection.exec(commands.untarStdin(filepath), function(err, remoteProcess) {
    remoteProcess.stderr.on('data', function(d) {
      logs.err("Unable to deploy code:", d.toString());
      t.connection.end(function() {
        process.exit(1);
      });
    });

    var tesselClassic = require('tessel');

    // Gather details about the file structure of the script being sent
    var ret = tesselClassic.analyzeScript(process.cwd() + "/" + opts.entryPoint, {verbose: opts.verbose});
    // Tar up the code to improve transfer rates
    tesselClassic.tarCode(ret.pushdir, {node: true}, function(err, bundle) {
      logs.info('Bundled. Writing to T2....', bundle.length);
      // Throw any unfortunate errors
      if (err) throw err;

      // Wait for the transfer to finish...
      remoteProcess.once('close', function() {
        logs.info('Deployed.');
        callback && callback(ret);
      });

      // Write the code bundle to the hardware
      remoteProcess.stdin.end(bundle);
    });
  });
}

function runScript(t, filepath, ret) {
  logs.info('Running script...');
  t.connection.exec(commands.runScript(filepath, ret.relpath), function(err, remoteProcess) {
    if (err) throw err;

    // Once we get a SIGINT from the console
    process.once('SIGINT', function () {
      // Kill the process (should cause the stream to close)
      logs.info("Stopping script...");
    });

    // When the stream closes
    remoteProcess.once('close', function() {
      // End the connection
      t.connection.end(function() {
        // Exit the process
        process.exit(1);
      });
    });

    // Pipe data and errors
    remoteProcess.stdout.pipe(process.stdout);
    remoteProcess.stderr.pipe(process.stderr);
  });
}

function pushScript(t) {
  // Write the node start file
  writeToFile(t, startPushedScript.bind(this, t));
}

function writeToFile(t, callback) {
  var executablePath = PUSH_PATH + PUSH_START_SCRIPT_NAME;
  t.connection.exec(commands.openStdinToFile(executablePath), function(err, remoteProcess) {
    if (err) throw err;
    remoteProcess.stdin.once('finish', function() {
      t.connection.exec(commands.setExecutablePermissions(executablePath), function(err, remoteProcess) {
        if (err) throw err;
        remoteProcess.once('close', function() {
          logs.info('You may now disconnect from the Tessel. Your code will be run whenever Tessel boots up. To remove this code, use `tessel erase`.');
          callback && callback();
        });
      });
    });

    fs.readFile(NODE_PUSH_SCRIPT, function(err, data) {
      if (err) throw err;
      remoteProcess.stdin.end(data);
    });
  });
}

function startPushedScript(t) {
  // Once it has been written, run the script with Node
  t.connection.exec(commands.startPushedScript(), function(err, remoteProcess) {
    remoteProcess.once('close', function() {
      logs.info('Running script...');
      t.connection.end(function() {
        process.exit(1);
      });
    });
  });
}
