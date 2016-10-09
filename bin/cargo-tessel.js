#!/usr/bin/env node

// Helper tool for creating cross-compiled bundles for Tessel deployment.

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
  log.error(error.stack);
  process.exit(1);
}

parser.command('build')
  .callback(options => {
    rust.runBuild(false, options.bin)
      .then(tarball => {
        // This is the direct invocation of `cargo tessel build ...` (not
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
  .option('subcommand', {
    position: 1,
    required: true,
    options: ['install', 'uninstall'],
    help: '"install" or "uninstall" the SDK.',
  })
  .callback(options => {
    rust.cargo[options.subcommand](options).catch(closeCommand);
  })
  .help('Manage the SDK for cross-compiling Rust binaries.');

if (require.main === module) {
  if (process.argv[2] === 'tessel') {
    // The 'cargo' CLI tool will match `cargo SUBCOMMAND` with any tool on the
    // path matching `cargo-SUBCOMMAND`. When invoking this script via a
    // command like 'cargo tessel', we have an extra "tessel" argument in the
    // process.argv array. We slice it out here explicitly.
    parser.parse(process.argv.slice(3));
  } else {
    // When we directly invoke 'cargo-tessel', we don't have an erroneous
    // 'tessel' argument and can parse arguments as `node cargo-tessel.js ...`
    parser.parse(process.argv.slice(2));
  }
}
