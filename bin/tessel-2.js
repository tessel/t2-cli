#!/usr/bin/env node

// System Objects
//...

// Third Party Dependencies
var parser = require('nomnom').script('t2');
const updateNotifier = require('update-notifier');

// Internal
var controller = require('../lib/controller');
var CrashReporter = require('../lib/crash-reporter');
var init = require('../lib/init');
var logs = require('../lib/logs');
var drivers = require('./tessel-install-drivers');
var Preferences = require('../lib/preferences');

const CLI_ENTRYPOINT = 'cli.entrypoint';

// Check for updates
const pkg = require('../package.json');
updateNotifier({
  pkg
}).notify();

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
    })
    .option('output', {
      default: true,
      choices: [true, false],
      abbr: 'o',
      help: 'Enable or disable writing command output to stdout/stderr. Useful for CLI API consumers.'
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
  })
  .help('Install drivers');

parser.command('crash-reporter')
  .callback(opts => {
    // t2 crash-reporter --on
    if (opts.on) {
      return CrashReporter.on().then(() => {
        // t2 crash-reporter --on --test
        if (opts.test) {
          CrashReporter.test().then(module.exports.closeSuccessfulCommand);
        }
      }).then(module.exports.closeSuccessfulCommand, module.exports.closeFailedCommand);
    } else if (opts.off) {
      // t2 crash-reporter --on
      return CrashReporter.off()
        .then(module.exports.closeSuccessfulCommand, module.exports.closeFailedCommand);
    }

    // t2 crash-reporter --test
    if (opts.test) {
      // not handling failures, as we want to trigger a crash
      CrashReporter.test()
        .then(module.exports.closeSuccessfulCommand);
    }
  })
  .option('off', {
    flag: true,
    help: 'Disable the Crash Reporter.'
  })
  .option('on', {
    flag: true,
    help: 'Enable the Crash Reporter.'
  })
  .option('test', {
    flag: true,
    help: 'Test the Crash Reporter.'
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
    // 1. Check that the type is a valid type
    if (opts.type !== 'ram' && opts.type !== 'flash') {
      return module.exports.closeFailedCommand('--type Invalid ');
    }

    // 2. If an entry point file wasn't specified, get the last
    //    known entry point file name and use that.
    if (opts.entryPoint === undefined) {
      Preferences.read(CLI_ENTRYPOINT, undefined).then(entryPoint => {
        if (entryPoint) {
          opts.entryPoint = entryPoint;
        } else {
          // 3. However, if that doesn't exist either,
          //    there is nothing further to do.
          return module.exports.closeFailedCommand('Cannot determine entry point file name');
        }
        callControllerWith('restartScript', opts);
      });
    } else {
      callControllerWith('restartScript', opts);
    }
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
  .option('full', {
    flag: true,
    default: false,
    help: 'Deploy all files in project including those not used by the program, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is run from specified "entryPoint" file.'
  })
  .help(`
    Deploy a script to Tessel and run it with Node.

    Assets that are not directly deployed as a dependency via require analysis,
    for example images or html files of an application (and their directories),
    must be listed in a .tesselinclude in the root of your project.
    This can be created manually or by typing 't2 init'.

    For more information, visit: https://tessel.io/docs/cli#starting-projects
  `);

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
  .option('full', {
    flag: true,
    default: false,
    help: 'Push all files in project including those not used by the program, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is run from specified "entryPoint" file.'
  })
  .help(`
    Pushes the file/dir to Flash memory to be run anytime the Tessel is powered,
    runs the file immediately once the file is copied over.

    Assets that are not directly deployed as a dependency via require analysis,
    for example images or html files of an application (and their directories),
    must be listed in a .tesselinclude in the root of your project.
    This can be created manually or by typing 't2 init'.

    For more information, visit: https://tessel.io/docs/cli#starting-projects
  `);

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
    } else if (opts.ssid) {
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
    type: 'string',
    help: 'Set the password of the network to connect to'
  })
  .option('security', {
    abbr: 's',
    help: 'Set the encryption of the network to connect to (i.e. wep, psk, psk2, wpa, wpa2).'
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
  .callback(function(opts) {
    controller.setupLocal(opts)
      .then(function() {
        logs.info('Key successfully generated.');
      })
      .then(module.exports.closeSuccessfulCommand, module.exports.closeFailedCommand);
  })
  .option('generate', {
    position: 1,
    required: true,
    help: 'Generate a local SSH keypair for authenticating to a Tessel'
  })
  .help('Manage ssh keys for connecting to a Tessel');

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
  .option('n', {
    abbr: 'n',
    required: false,
    flag: true,
    help: 'Do not save configuration during update.'
  })
  .option('openwrt-path', {
    abbr: 'op',
    required: false,
    flag: false,
    help: 'Update with the OpenWRT image at the indicated local path.'
  })
  .option('firmware-path', {
    abbr: 'fp',
    required: false,
    help: 'Update with the firmware image at the indicated local path.'
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
  .callback(callControllerCallback('tesselEnvVersions'))
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
  .option('off', {
    flag: true,
    help: 'Disable the access point'
  })
  .option('on', {
    flag: true,
    help: 'Enable the access point'
  })
  .help('Configure the Tessel as an access point')
  .callback(function(opts) {
    if (opts.on || opts.off) {
      if (opts.on) {
        callControllerWith('enableAccessPoint', opts);
      } else {
        callControllerWith('disableAccessPoint', opts);
      }
    } else if (opts.ssid) {
      callControllerWith('createAccessPoint', opts);
    } else {
      callControllerWith('getAccessPointInfo', opts);
    }
  });

makeCommand('root')
  .callback(function(opts) {
    callControllerWith('root', opts);
  })
  .option('lan', {
    flag: true,
    hidden: true
  })
  .option('lanPrefer', {
    flag: true,
    hidden: true
  })
  .option('usb', {
    flag: true,
    hidden: true
  })
  .help('Gain SSH root access to one of your authorized tessels');


module.exports = function(args) {
  // Clear the spec from one call to the next. This is
  // only necessary for testing the CLI (each call must be "fresh")
  parser.specs = {};
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
