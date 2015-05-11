#!/usr/bin/env node

var parser = require("nomnom"),
  controller = require('../lib/controller'),
  key = require('../lib/key'),
  init = require('../lib/init'),
  logs = require('../lib/logs');

var nameOption = {
  metavar: 'NAME',
  help: 'The name of the tessel on which the command will be executed'
};

var language = {
  metavar : 'LANG',
  abbr: 'l',
  help : 'The language to use <javascript|rust|python>. Javascript by default'

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
  .callback(function(opts) {
    init(opts)
    .then(function(){
      process.exit(0);
    })
    .catch(function (err) {
      tessel.logs.warn(err);
      process.exit(1);
    });
  })
  .option('interactive', {
    flag: true,
    abbr: 'i',
    help: 'Run in interactive mode'
  })
  .option('lang', language)
  .option('directory', {
    position: 1,
    help: 'Provide a directory to initialize your project'
  })
  .help('Initialize repository for your Tessel project')

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

parser.parse();
