#!/usr/bin/env node

// Helper tool for creating cross-compiled bundles for Tessel deployment.

// System Objects
// ...

// Third Party Dependencies
var parser = require('nomnom');

// Internal
var log = require('../lib/log');
var rust = require('../lib/install/rust');

function die(err) {
  // TODO: refactor into closeSuccessfulCommand and closeFailedCommand,
  // similar to tessel-2.js
  log.error(err.stack);
  process.exit(1);
}

parser.command('build')
  .callback(options => {
    rust.runBuild(options.bin)
      .then(tarball => {
        log.info('Tessel bundle written out to:');
        console.log(tarball);
      })
      .catch(die);
  })
  .option('bin', {
    help: 'Name of the binary to cross-compile.'
  })
  .help('Cross-compile binary for target.');

parser.command('sdk')
  .option('subcommand', {
    position: 1,
    required: true,
    options: ['install', 'uninstall'],
    help: '"install" or "uninstall" the SDK.',
  })
  .callback(options => {
    rust.cli[options.subcommand](options).catch(die);
  })
  .help('Manage the SDK for cross-compiling Rust binaries.');

if (require.main === module) {
  if (process.argv[2] === 'tessel') {
    // 'cargo tessel' invocation
    parser.parse(process.argv.slice(3));
  } else {
    // 'cargo-tessel' invocation
    parser.parse(process.argv.slice(2));
  }
}
