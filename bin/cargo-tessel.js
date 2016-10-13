#!/usr/bin/env node

// cargo-tessel: helper tool for creating cross-compiled bundles for Tessel.
// See https://github.com/rust-lang/cargo/wiki/Third-party-cargo-subcommands

// System Objects
// ...

// Third Party Dependencies
var parser = require('nomnom');

// Internal
var log = require('../lib/log');
var rust = require('../lib/install/rust');

function closeCommand(error) {
  // TODO: refactor into closeSuccessfulCommand and closeFailedCommand,
  // similar to tessel-2.js
  log.error(typeof error === 'string' ? error : error.stack);
  process.exit(1);
}

parser.command('build')
  .callback(options => {
    rust.runBuild({
        isCli: false,
        binary: options.bin
      })
      .then(tarball => {
        // This is the direct invocation of "cargo tessel build ..." (not
        // through t2 run). As a command line tool, it only writes to stdout
        // the path of the cross-compiled tarball it generates. This allows This
        // to be integrated into CLI toolchains by mapping its stdout.
        log.info('Tessel bundle written out to:');
        console.log(tarball);
      })
      .catch(closeCommand);
  })
  .option('bin', {
    help: 'Name of the binary to cross-compile.'
  })
  .help('Cross-compile a binary for Tessel.');

parser.command('sdk')
  .callback(options => {
    rust.cargo[options.subcommand](options).catch(closeCommand);
  })
  .option('subcommand', {
    position: 1,
    required: true,
    choices: ['install', 'uninstall'],
    help: '"install" or "uninstall" the SDK.',
  })
  .help('Manage the SDK for cross-compiling Rust binaries.');


module.exports = function(args) {
  // Clear the spec from one call to the next. This is
  // only necessary for testing the CLI (each call must be "fresh")
  parser.specs = {};
  parser.parse(args);
};

if (require.main === module) {
  if (process.argv[2] === 'tessel') {
    /*
    The 'cargo' CLI tool will match "cargo SUBCOMMAND" with any tool on the
    path matching "cargo-SUBCOMMAND". When invoking this script via a
    command like "cargo tessel", we have an extra "tessel" argument in the
    process.argv array. We slice it out here explicitly.


    Example:

    $ cargo tessel foo

    [ '/usr/local/bin/node',
      '/usr/local/bin/cargo-tessel',
      'tessel',
      'foo' ]

    */
    module.exports(process.argv.slice(3));
  } else {
    /*
    When we directly invoke "cargo-tessel", we don't have an erroneous
    "tessel" argument and can parse arguments as "node cargo-tessel.js ..."

    Example:

    $ cargo-tessel foo

    [ '/usr/local/bin/node', '/usr/local/bin/cargo-tessel', 'foo' ]
    */
    module.exports(process.argv.slice(2));
  }
}

if (global.IS_TEST_ENV) {
  module.exports.nomnom = parser;
}
