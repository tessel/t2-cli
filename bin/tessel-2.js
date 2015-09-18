#!/usr/bin/env node

var path = require('path');
var parser = require('nomnom').script('t2');
var controller = require('../lib/controller');
var key = require('../lib/key');
var init = require('../lib/init');
var logs = require('../lib/logs');


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

function makeCommand(commandName) {
  return parser.command(commandName)
    .option('timeout', {
      abbr: 't',
      metavar: 'TIMEOUT',
      help: 'Set timeout in seconds for scanning for networked tessels',
      default: 5
    })
    .option('name', {
      metavar: 'NAME',
      help: 'The name of the tessel on which the command will be executed'
    })
    .option('lan', {
      flag: true,
      help: 'Use LAN connection'
    })
    .option('usb', {
      flag: true,
      help: 'Use USB connection'
    });
}

function callControllerWith(methodName, opts) {
  return controller[methodName](opts)
    .then(closeSuccessfulCommand, closeFailedCommand);
}

function callControllerCallback(methodName) {
  return function(opts) {
    return callControllerWith(methodName, opts);
  };
}

parser.command('provision')
  .callback(callControllerCallback('provisionTessel'))
  .option('force', {
    abbr: 'f',
    flag: true,
    help: 'Delete existing .tessel authorization and reprovision.'
  })
  .help('Authorize your computer to control the USB-connected Tessel');

parser.command('reboot')
  .callback(callControllerCallback('reboot'))
  .option('time', {
    abbr: 't',
    metavar: 'SEC',
    required: false,
    help: 'Delay interval until reboot (cannot be stopped!)'
  })
  .option('delay', {
    abbr: 'd',
    metavar: 'SEC',
    required: false,
    help: 'Same as --time'
  })
  .option('force', {
    abbr: 'f',
    required: false,
    help: 'don\'t go through init'
  })
  .option('nosync', {
    abbr: 'n',
    required: false,
    help: 'Do not sync'
  })
  .option('name',   {
    required: true,
    metavar: 'TESSEL',
    help: 'Tessels name or IP'
  })
  .option('key', {
    abbr: 'i',
    default: '~/.tessel/id_rsa', // TODO: replace this by global var
    required: false,
    metavar: 'PATH',
    help: 'SSH-Key to login into your Tessel. Default is:'
  })
  .help('Reboot your Tessel immediately or with delay');

makeCommand('restart')
  .callback(function(opts) {
    var packageJson;

    if (opts.type !== 'ram' && opts.type !== 'flash') {
      closeFailedCommand('--type Invalid ');
    }

    if (opts.entryPoint === undefined) {
      packageJson = require(path.resolve(process.cwd(), 'package.json'));

      if (packageJson && packageJson.main) {
        opts.entryPoint = packageJson.main;
      }
    }

    callControllerWith('restartScript', opts);
  })
  .option('entryPoint', {
    position: 1,
    help: 'The entry point file to deploy to Tessel'
  })
  .option('type', {
    default: 'ram',
    help: 'Specify where in memory the script is located: `--type=flash` (push) or `--type=ram` (run)'
  })
  .help('Restart a previously deployed script in RAM or Flash memory (does not rebundle)');

makeCommand('run')
  .callback(function(opts) {
    opts.push = false;
    callControllerWith('deployScript', opts);
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

makeCommand('push')
  .callback(function(opts) {
    opts.push = true;
    callControllerWith('deployScript', opts);
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
  .help('Pushes the file/dir to Flash memory to be run anytime the Tessel is powered, runs the file immediately once the file is copied over');

makeCommand('erase')
  .callback(callControllerCallback('eraseScript'))
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .help('Erases files pushed to Flash using the tessel push command');

makeCommand('list')
  .callback(callControllerCallback('listTessels'))
  .help('Lists all connected Tessels and their authorization status.');

parser.command('init')
  .callback(init)
  .option('interactive', {
    flag: true,
    abbr: 'i',
    help: 'Run in interactive mode'
  })
  .help('Initialize repository for your Tessel project');

makeCommand('wifi')
  .callback(function(opts) {
    //TODO: Refactor switch case into controller.wifi
    if (opts.list) {
      callControllerWith('printAvailableNetworks', opts);
    } else if (opts.ssid && opts.password) {
      callControllerWith('connectToNetwork', opts);
    }
  })
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
  })
  .help('Generate a local SSH keypair for authenticating a Tessel VM');

makeCommand('rename')
  .option('newName', {
    help: 'The new name for the selected Tessel',
    position: 1,
  })
  .option('reset', {
    abbr: 'r',
    flag: true
  })
  .callback(callControllerCallback('renameTessel'))
  .help('Change the name of a Tessel to something new');

makeCommand('update')
  .option('version', {
    abbr: 'v',
    required: false,
    help: 'Specify a build version.'
  })
  .option('list', {
    abbr: 'l',
    required: false,
    flag: true,
    help: 'List the available builds.'
  })
  .option('force', {
    abbr: 'f',
    required: false,
    flag: true,
    help: 'Update to the latest version regardless of current version.'
  })
  .callback(function(opts) {
    if (opts.list) {
      callControllerCallback('printAvailableUpdates');
    } else {
      callControllerCallback('update');
    }
  })
  .help('Update the Tessel firmware and openWRT image');

makeCommand('version')
  .callback(callControllerCallback('tesselFirmwareVerion'))
  .help('Display Tessel\'s current firmware version');


module.exports = function(args) {
  parser.parse(args);
};

if (require.main === module) {
  module.exports(process.argv.slice(2));
}

if (global.IS_TEST_ENV) {
  module.exports.makeCommand = makeCommand;
}
