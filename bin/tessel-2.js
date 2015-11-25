#!/usr/bin/env node

// System Objects
var path = require('path');

// Third Party Dependencies
var parser = require('nomnom').script('t2');

// Internal
var controller = require('../lib/controller');
var init = require('../lib/init');
var key = require('../lib/key');
var logs = require('../lib/logs');
var Tessel = require('../lib/tessel/tessel');
var drivers = require('./tessel-install-drivers');

function makeCommand(commandName) {
  return parser.command(commandName)
    .option('timeout', {
      abbr: 't',
      metavar: 'TIMEOUT',
      help: 'Set timeout in seconds for scanning for networked tessels',
      default: 5
    })
    .option('key', {
      required: false,
      metavar: 'PRIVATEKEY',
      abbr: 'i',
      default: Tessel.LOCAL_AUTH_KEY,
      help: 'SSH key for authorization with your Tessel'
    })
    .option('name', {
      metavar: 'NAME',
      help: 'The name of the tessel on which the command will be executed'
    })
    .option('lan', {
      flag: true,
      help: 'Use only a LAN connection'
    })
    .option('usb', {
      flag: true,
      help: 'Use only a USB connection'
    })
    .option('lanPrefer', {
      flag: true,
      default: false,
      help: 'Prefer a LAN connection when available, otherwise use USB.'
    });
}

function callControllerWith(methodName, opts) {
  return controller[methodName](opts)
    .then(module.exports.closeSuccessfulCommand, module.exports.closeFailedCommand);
}

function callControllerCallback(methodName) {
  return function(opts) {
    return callControllerWith(methodName, opts);
  };
}

parser.command('install-drivers')
  .callback(function() {
    require('./tessel-install-drivers');
    drivers.install()
      .then(module.exports.closeSuccessfulCommand, module.exports.closeFailedCommand);
  });

parser.command('provision')
  .callback(callControllerCallback('provisionTessel'))
  .option('force', {
    abbr: 'f',
    flag: true,
    help: 'Delete existing .tessel authorization and reprovision.'
  })
  .help('Authorize your computer to control the USB-connected Tessel');

makeCommand('restart')
  .callback(function(opts) {
    var packageJson;

    if (opts.type !== 'ram' && opts.type !== 'flash') {
      return module.exports.closeFailedCommand('--type Invalid ');
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
    opts.lanPrefer = true;
    opts.push = false;
    // Overridden in tarBundle if opts.full is `true`
    opts.slim = true;
    callControllerWith('deployScript', opts);
  })
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'The program entry point file to deploy to Tessel'
  })
  .option('single', {
    flag: true,
    abbr: 's',
    help: 'Run only the specified entry point file'
  })
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .option('slim', {
    flag: true,
    default: true,
    help: 'Deploy a single "bundle" file that contains that contains only the required files, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is run from "slimPath" file (if not provided, a default name is given).',
  })
  .option('slimPath', {
    default: '__tessel_program__.js',
    help: 'Specify the name of the --slim bundle file.',
  })
  .option('full', {
    flag: true,
    default: false,
    help: 'Deploy all files in project including those not used by the program, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is run from specified "entryPoint" file.'
  })
  .help('Deploy a script to Tessel and run it with Node');

makeCommand('push')
  .callback(function(opts) {
    opts.lanPrefer = true;
    opts.push = true;
    // Overridden in tarBundle if opts.full is `true`
    opts.slim = true;
    callControllerWith('deployScript', opts);
  })
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'The program entry point file to deploy to Tessel'
  })
  .option('single', {
    flag: true,
    abbr: 's',
    help: 'Push only the specified entry point file'
  })
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .option('slim', {
    flag: true,
    default: true,
    help: 'Push a single "bundle" file that contains that contains only the required files, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is run from "slimPath" file (if not provided, a default name is given).'
  })
  .option('slimPath', {
    default: '__tessel_program__.js',
    help: 'Specify the name of the --slim bundle file.'
  })
  .option('full', {
    flag: true,
    default: false,
    help: 'Push all files in project including those not used by the program, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is run from specified "entryPoint" file.'
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
    // TODO: Refactor switch case into controller.wifi
    if (opts.list) {
      callControllerWith('printAvailableNetworks', opts);
    } else if (opts.off || opts.on) {
      if (opts.off) {
        opts.on = false;
      }
      callControllerWith('setWiFiState', opts);
    } else if (opts.ssid && opts.password) {
      callControllerWith('connectToNetwork', opts);
    } else {
      callControllerWith('getWifiInfo', opts);
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
  .option('off', {
    flag: true,
    help: 'Disable the wireless network'
  })
  .option('on', {
    flag: true,
    help: 'Enable the wireless network'
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
      .then(module.exports.closeSuccessfulCommand, module.exports.closeFailedCommand);
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
      callControllerWith('printAvailableUpdates');
    } else {
      callControllerWith('update', opts);
    }
  })
  .help('Update the Tessel firmware and openWRT image');

makeCommand('version')
  .callback(callControllerCallback('tesselFirmwareVerion'))
  .help('Display Tessel\'s current firmware version');

makeCommand('ap')
  .option('ssid', {
    abbr: 'n',
    help: 'Name of the network.'
  })
  .option('pass', {
    abbr: 'p',
    help: 'Password to access network.'
  })
  .option('security', {
    abbr: 's',
    help: 'Encryption to use on network (i.e. wep, psk, psk2, wpa, wpa2).'
  })
  .option('trigger', {
    position: 1,
    help: 'Trigger, i.e. on OR off, the access point'
  })
  .help('Configure the Tessel as an access point')
  .callback(function(opts) {
    if (opts.trigger) {
      if (opts.trigger === 'on') {
        callControllerWith('enableAccessPoint', opts);
      } else {
        callControllerWith('disableAccessPoint', opts);
      }
    } else {
      callControllerWith('createAccessPoint', opts);
    }
  });

makeCommand('root')
  .callback(function(opts) {
    callControllerWith('root', opts);
  })
  .help('Gain SSH root access to one of your authorized tessels');


module.exports = function(args) {
  parser.parse(args);
};

module.exports.closeSuccessfulCommand = function() {
  process.exit(0);
};

// Allow options to be partially applied
module.exports.closeFailedCommand = function(status, options) {
  var code = 1;

  options = options || {};

  if (status instanceof Error) {
    logs.err(status.toString());
  } else {
    if (status !== undefined) {
      // Print a stern warning by default
      options.type = options.type || 'warn';
      logs[options.type](status);
    }
  }

  process.exit(options.code || status.code || code);
};


if (require.main === module) {
  module.exports(process.argv.slice(2));
}

if (global.IS_TEST_ENV) {
  module.exports.makeCommand = makeCommand;
}
