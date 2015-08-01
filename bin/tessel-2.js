#!/usr/bin/env node

var parser = require('nomnom'),
  controller = require('../lib/controller'),
  key = require('../lib/key'),
  init = require('../lib/init'),
  logs = require('../lib/logs');

var nameOption = {
  metavar: 'NAME',
  help: 'The name of the tessel on which the command will be executed'
};

var timeoutOption = {
  abbr: 't',
  metavar: 'TIMEOUT',
  help: 'Set timeout in seconds for scanning for networked tessels',
  default: 5
};

function closeSuccessfulCommand() {
  process.exit(0);
}

function closeFailedCommand(err) {
  // If the returned value is an error
  if (err instanceof Error) {
    // Throw it
    throw err;
  }
  // Otherwise
  else {
    // Print a stern warning
    logs.warn(err);
  }
  // Exit with non-zero code
  process.exit(1);
}

parser.command('provision')
  .callback(function(opts) {
    controller.provisionTessel(opts)
      .then(closeSuccessfulCommand, closeFailedCommand);
  })
  .option('force', {
    abbr: 'f',
    flag: true,
    help: 'Delete existing .tessel authorization and reprovision.'
  })
  .help('Authorize your computer to control the USB-connected Tessel');

parser.command('run')
  .callback(function(opts) {
    controller.deployScript(opts, false)
      .then(closeSuccessfulCommand, closeFailedCommand);
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
  .option('timeout', timeoutOption)
  .help('Deploy a script to Tessel and run it with Node');

parser.command('push')
  .callback(function(opts) {
    // true: push=true
    controller.deployScript(opts, true)
      .then(closeSuccessfulCommand, closeFailedCommand);
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
  .option('timeout', timeoutOption)
  .help('Pushes the file/dir to Flash memory to be run anytime the Tessel is powered, runs the file immediately once the file is copied over');

parser.command('erase')
  .callback(function(opts) {
    controller.eraseScript(opts)
      .then(closeSuccessfulCommand, closeFailedCommand);
  })
  .option('name', nameOption)
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .option('timeout', timeoutOption)
  .help('Erases files pushed to Flash using the tessel push command');

parser.command('list')
  .callback(function(opts) {
    controller.listTessels(opts)
      .then(closeSuccessfulCommand, closeFailedCommand);
  })
  .option('timeout', timeoutOption)
  .help('Lists all connected Tessels and their authorization status.');

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
        .then(closeSuccessfulCommand, closeFailedCommand);
    } else if (opts.ssid && opts.password) {
      controller.connectToNetwork(opts)
        .then(closeSuccessfulCommand, closeFailedCommand);
    }
  })
  .option('name', nameOption)
  .option('list', {
    abbr: 'l',
    flag: true,
    help: 'List available Wifi networks'
  })
  .option('ssid', {
    abbr: 'n',
    metavar: 'SSID',
    help: 'Set the SSID of the network to connect to'
  })
  .option('password', {
    abbr: 'p',
    metavar: 'PASSWORD',
    help: 'Set the password of the network to connect to'
  })
  .option('timeout', timeoutOption)
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
        logs.info('Key successfully generated.');
      })
      .then(closeSuccessfulCommand, closeFailedCommand);
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
      .then(closeSuccessfulCommand, closeFailedCommand);
  })
  .option('timeout', timeoutOption)
  .help('Change the name of a Tessel to something new.');


// accessing the root shell of your tessels
// Fixes issue https://github.com/tessel/t2-cli/issues/80
/**
$ t2 root --help
> Usage: tessel root [-i <path>] [--help]
>  -i <path>:   provide a path to the desired ssh key
$ 

$ t2 root
> Accessing root...
root@192.168.128.124 # 
*/
var default_id_rsa = '~/.tessel/id_rsa';
var functional_msg = '\nGain SSH root access to one of your authorized tessels (menu listing if multiple targets)';
parser.command('root')
  .usage(functional_msg + '\n\nUsage: t2 root [-i PATH] [--help]\n\n-i PATH:   Optional targeting a different Private Key \n\n(Note: default target created by "t2 key generate" is ' + default_id_rsa + ')\n')
  .option('path', {
    abbr: 'i',
    full: 'path',
    metavar: 'PATH',
    default: default_id_rsa,
    help: 'Private Key (Note: created by "t2 key generate")'
  })
  .callback(function(opts) {
    controller.root(opts)
    .then(closeSuccessfulCommand,closeFailedCommand);
  })
  .help(functional_msg);


module.exports = function(args) {
  parser.parse(args);
};

if (require.main === module) {
  module.exports(process.argv.slice(2));
}
