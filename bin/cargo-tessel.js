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
  log.error(err.stack);
  process.exit(1);
}

parser.command('build')
  .callback(function(opts) {
    rust.runBuild(opts.bin)
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
  .callback(function(opts) {
    switch (opts.subcommand) {
      case 'install':
        rust.installSdk(opts).catch(die);
        break;
      case 'uninstall':
        rust.uninstallSdk(opts).catch(die);
        break;
    }
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
