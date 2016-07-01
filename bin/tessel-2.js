#!/usr/bin/env node

// System Objects
//...

// Third Party Dependencies
var parser = require('nomnom').script('t2');
const updateNotifier = require('update-notifier');
const isRoot = require('is-root');

// Internal
var CrashReporter = require('../lib/crash-reporter');
var controller = require('../lib/controller');
var log = require('../lib/log');
var Preferences = require('../lib/preferences');

const CLI_ENTRYPOINT = 'cli.entrypoint';

// Check for updates
const pkg = require('../package.json');

/*
 * If a command has been run with root,
 * do not try to read the update-notifier config file.
 * It will change the read permissions of the file and fail
 * for all subsequent command line calls.
 * Can be removed once https://github.com/npm/write-file-atomic/issues/11
 * has been resolved.
 */
if (!isRoot()) {
  try {
    updateNotifier({
      pkg
    }).notify();
  } catch (err) {
    CrashReporter.submit(err.stack, {
      silent: true
    });
  }
}

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
    })
    .option('loglevel', {
      default: 'basic',
      choices: ['trace', 'debug', 'basic', 'info', 'http', 'warn', 'error'],
      help: 'Set the loglevel.',
    });
}

function callControllerWith(methodName, options) {
  log.spinner.start();
  return controller[methodName](options)
    .then(module.exports.closeSuccessfulCommand, module.exports.closeFailedCommand);
}

parser.command('install-drivers')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('installDrivers', options);
  })
  .help('Install drivers');

parser.command('crash-reporter')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('crashReporter', options);
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
  })
  .help('Configure the Crash Reporter.');

parser.command('provision')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('provisionTessel', options);
  })
  .option('force', {
    abbr: 'f',
    flag: true,
    help: 'Delete existing .tessel authorization and reprovision.'
  })
  .help('Authorize your computer to control the USB-connected Tessel');

makeCommand('restart')
  .callback(options => {
    log.level(options.loglevel);


    // 1. Check that the type is a valid type
    if (options.type !== 'ram' && options.type !== 'flash') {
      return module.exports.closeFailedCommand('--type Invalid ');
    }

    // 2. If an entry point file wasn't specified, get the last
    //    known entry point file name and use that.
    if (options.entryPoint === undefined) {
      Preferences.read(CLI_ENTRYPOINT, undefined).then(entryPoint => {
        if (entryPoint) {
          options.entryPoint = entryPoint;
        } else {
          // 3. However, if that doesn't exist either,
          //    there is nothing further to do.
          return module.exports.closeFailedCommand('Cannot determine entry point file name');
        }
        callControllerWith('restart', options);
      });
    } else {
      callControllerWith('restart', options);
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
  .callback(options => {
    log.level(options.loglevel);

    options.lanPrefer = true;
    options.push = false;
    // Overridden in tarBundle if options.full is `true`
    options.slim = true;

    callControllerWith('deploy', options);
  })
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'The program entry point file to deploy to Tessel'
  })
  .option('single', {
    flag: true,
    abbr: 's',
    help: 'Deploy only the specified entry point file. Previously deployed files are preserved. Program is started from specified file.'
  })
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .option('slim', {
    flag: true,
    default: true,
    help: 'Deploy a project containing only the required files, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is started from specified file.',
  })
  .option('full', {
    flag: true,
    default: false,
    help: 'Deploy a project containing all files within, including those not used by the program, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is started from specified file.'
  })
  .option('rustcc', {
    // TODO: make this point to a long-lived server somewhere
    default: 'http://localhost:8080',
    help: 'Specify the location and port of the Rust cross-compilation server.'
  })
  .help(`
    Deploy an application to Tessel and run it.

    Assets that are not directly deployed as a dependency via require analysis,
    for example images or html files of an application (and their directories),
    must be listed in a .tesselinclude in the root of your project.
    This can be created manually or by typing 't2 init'.

    For more information, visit: https://tessel.io/docs/cli#starting-projects
  `);

makeCommand('push')
  .callback(options => {
    log.level(options.loglevel);

    options.lanPrefer = true;
    options.push = true;
    // Overridden in tarBundle if options.full is `true`
    options.slim = true;

    callControllerWith('deploy', options);
  })
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'The program entry point file to deploy to Tessel'
  })
  .option('single', {
    flag: true,
    abbr: 's',
    help: 'Deploy only the specified entry point file. Previously deployed files are preserved. Program is started from specified file.'
  })
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .option('slim', {
    flag: true,
    default: true,
    help: 'Deploy a project containing only the required files, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is started from specified file.',
  })
  .option('full', {
    flag: true,
    default: false,
    help: 'Deploy a project containing all files within, including those not used by the program, excluding any files matched by non-negated rules in .tesselignore and including any files matched by rules in .tesselinclude. Program is started from specified file.'
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
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('eraseScript', options);
  })
  .option('verbose', {
    flag: true,
    abbr: 'v',
    help: 'Choose to view more debugging information'
  })
  .help('Erases files pushed to Flash using the tessel push command');

makeCommand('list')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('listTessels', options);
  })
  .help('Lists all connected Tessels and their authorization status.');

parser.command('init')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('createNewProject', options);
  })
  .option('interactive', {
    flag: true,
    abbr: 'i',
    help: 'Run in interactive mode'
  })
  .option('lang', {
    metavar: 'LANG',
    abbr: 'l',
    default: 'js',
    help: 'The language to use <javascript|rust|js|rs>. JavaScript by default'
  })
  .help('Initialize repository for your Tessel project');

makeCommand('wifi')
  .callback(options => {
    log.level(options.loglevel);

    // TODO: Refactor switch case into controller.wifi
    if (options.list) {
      callControllerWith('printAvailableNetworks', options);
    } else if (options.off || options.on) {
      if (options.off) {
        options.on = false;
      }
      callControllerWith('setWiFiState', options);
    } else if (options.ssid) {
      callControllerWith('connectToNetwork', options);
    } else {
      callControllerWith('getWifiInfo', options);
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
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('setupLocal', options);
  })
  .option('generate', {
    position: 1,
    required: true,
    help: 'Generate a local SSH keypair for authenticating to a Tessel'
  })
  .help('Manage ssh keys for connecting to a Tessel');

makeCommand('rename')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('renameTessel', options);
  })
  .option('newName', {
    help: 'The new name for the selected Tessel',
    position: 1,
  })
  .option('reset', {
    abbr: 'r',
    flag: true
  })
  .help('Change the name of a Tessel to something new');

makeCommand('update')
  .callback(options => {
    log.level(options.loglevel);

    if (options.list) {
      callControllerWith('printAvailableUpdates', options);
    } else {
      callControllerWith('update', options);
    }
  })
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
  .help('Update the Tessel firmware and openWRT image');

makeCommand('version')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('tesselEnvVersions', options);
  })
  .help('Display a list of present Tessel 2 environment versions (CLI, Firmware, Node)');

makeCommand('ap')
  .callback(options => {
    log.level(options.loglevel);

    if (options.on || options.off) {
      if (options.on) {
        callControllerWith('enableAccessPoint', options);
      } else {
        callControllerWith('disableAccessPoint', options);
      }
    } else if (options.ssid) {
      callControllerWith('createAccessPoint', options);
    } else {
      callControllerWith('getAccessPointInfo', options);
    }
  })
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
  .help('Configure the Tessel as an access point');

makeCommand('root')
  .callback(options => {
    log.level(options.loglevel);

    callControllerWith('root', options);
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
  log.spinner.stop();
  process.exit(0);
};

// Allow options to be partially applied
module.exports.closeFailedCommand = function(status, options) {
  var code = 1;

  options = options || {};


  if (status instanceof Error) {
    log.error(status.toString());
  } else {
    if (status !== undefined) {
      // Print a stern warning by default
      options.type = options.type || 'warn';
      log[options.type](status);
    }
  }

  log.spinner.stop();
  process.exit(options.code || status.code || code);
};


if (require.main === module) {
  module.exports(process.argv.slice(2));
}

if (global.IS_TEST_ENV) {
  module.exports.makeCommand = makeCommand;
}
