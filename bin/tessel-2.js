#!/usr/bin/env node

var nomnom = require("nomnom"),
  controller = require('../lib/controller'),
  key = require('../lib/key'),
  init = require('../lib/init'),
  logs = require('../lib/logs'),
  concat = require('concat-stream');

var nameOption = {
  metavar: 'NAME',
  help: 'The name of the tessel on which the command will be executed'
};

var parser = nomnom();

parser.command('provision')
  .callback(function(opts) {
    controller.provisionTessel(opts)
      .catch(function(err) {
        if (err instanceof Error) {
          throw err;
        }
        logs.warn(err);
        process.exit(1);
      });
  })
  .help('Authorize your computer to control the USB-connected Tessel');

parser.command('run')
  .callback(function(opts) {
    controller.deployScript(opts, false)
      .catch(function(err) {
        if (err instanceof Error) {
          throw err;
        }
        logs.err(err);
        process.exit(1);
      });
  })
  .option('name', nameOption)
  .option('lan', {
    flag: true,
    help: 'Use LAN connection'
  })
  .option('usb', {
    flag: true,
    help: 'Use USB connection'
  })
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'The entry point file to deploy to Tessel'
  })
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .help('Deploy a script to Tessel and run it with Node');

parser.command('push')
  .callback(function(opts) {
    // true: push=true
    controller.deployScript(opts, true)
      .catch(function(err) {
        if (err instanceof Error) {
          throw err;
        }
        logs.warn(err);
        process.exit(1);
      });
  })
  .option('name', nameOption)
  .option('lan', {
    flag: true,
    help: 'Use LAN connection'
  })
  .option('usb', {
    flag: true,
    help: 'Use USB connection'
  })
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'The entry point file to deploy to Tessel'
  })
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .help('Deploy a script to memory on Tessel and run it with Node whenever Tessel boots up');

parser.command('erase')
  .callback(function(opts) {
    controller.eraseScript(opts)
      .catch(function(err) {
        if (err instanceof Error) {
          throw err;
        }
        logs.warn(err);
        process.exit(1);
      });
  })
  .option('name', nameOption)
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .help('Erases files pushed to Flash using the tessel push command');

parser.command('list')
  .callback(function(opts) {
    controller.listTessels(opts)
      .then(function() {
        process.exit(1);
      })
      .catch(function(err) {
        if (err instanceof Error) {
          throw err;
        }
        logs.err(err);
        process.exit(1);
      });
  })
  .option('timeout', {
    abbr: 't',
    metavar: 'TIMEOUT',
    help: 'Set timeout in seconds for scanning for networked tessels'
  })
  .help('Show all connected Tessels');

parser.command('init')
  .callback(init)
  .option('interactive', {
    flag: true,
    abbr: 'i',
    help: 'Run in interactive mode'
  })
  .help('Initialize repository for your Tessel project');

parser.command('wifi')
  .callback(function(opts) {
    //TODO: Refactor switch case into controller.wifi
    if (opts.list) {
      controller.printAvailableNetworks(opts)
        .then(function() {
          process.exit(1);
        })
        .catch(function(err) {
          if (err instanceof Error) {
            throw err;
          }
          logs.warn(err);
          process.exit(1);
        });
    } else if (opts.ssid && opts.password) {
      controller.connectToNetwork(opts)
        .then(function() {
          process.exit(1);
        })
        .catch(function(err) {
          if (err instanceof Error) {
            throw err;
          }
          logs.warn(err);
          process.exit(1);
        });
    }
  })
  .option('name', nameOption)
  .option('list', {
    abbr: 'l',
    flag: true,
    help: "List available Wifi networks"
  })
  .option('ssid', {
    abbr: 'n',
    metavar: 'SSID',
    help: "Set the SSID of the network to connect to"
  })
  .option('password', {
    abbr: 'p',
    metavar: 'PASSWORD',
    help: "Set the password of the network to connect to"
  })
  .help('Configure the wireless connection');

parser.command('key')
  .option('method', {
    position: 1,
    required: true,
    choices: ['generate'],
  })
  .callback(function(opts) {
    key(opts)
      .then(function() {
        process.exit(0);
      })
      .catch(function(err) {
        logs.warn(err);
        process.exit(1);
      });
  });

parser.command('rename')
  .option('newName', {
    help: 'The new name for the selected Tessel',
    position: 1,
  })
  .option('name', nameOption)
  .option('reset', {
    abbr: 'r',
    flag: true
  })
  .callback(function(opts) {
    controller.renameTessel(opts)
      .then(function() {
        process.exit(0);
      })
      .catch(function(err) {
        if (err instanceof Error) {
          throw err;
        }
        logs.err(err);
        process.exit(1);
      });
  })
  .help("Change the name of a Tessel to something new.");

function lookupPath (name, next) {
  var spawn = require('child_process').spawn;
  var p = spawn('which', [name])
  p.stdout.pipe(concat(function (loc) {
    var fullloc = loc.toString().replace(/^\s+|\s+$/, '');
    next(null, fullloc);
  }));
}

parser.printer(function(string) {
  if (string.match(/no such command/)) {
    var exec = 't2-' + nomnom().parse()[0];
    lookupPath(exec, function (err, full) {
      if (!full) {
        console.log(string);
        return;
      }
      var spawn = require('child_process').spawn;
      spawn(full, process.argv.slice(3), {
        stdio: 'inherit',
      })
      .on('exit', function (code) {
        process.exit(code);
      })
    });
  }
});

parser.parse();
