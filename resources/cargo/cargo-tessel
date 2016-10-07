#!/usr/bin/env node

// Helper tool for creating cross-compiled bundles for Tessel deployment.

var rust = require('../../lib/install/rust');

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var tar = require('tar-fs');
var zlib = require('zlib');

var config = null;

rust.getBuildConfig()
.catch(e => {
  console.error('Could not find all the components for cross-compiling Rust.')
  console.error(e.message);
  console.error('Please run "t2 sdk install" and try again.')
  console.error('NOTE: Cross-compilation is only supported on Rust stable builds.')
  process.exit(1);
})
.then(_config => config = _config)
.then(() => rust.cargoMetadata())
.then(metadata => {
  // Get first package.
  var pkg = metadata.packages.pop();
  var bins = pkg.targets.filter(target => target.kind.indexOf('bin') > -1);

  // Filter by --bin argument.
  var idx = process.argv.indexOf('--bin');
  var name = idx > -1 ? process.argv[idx + 1] : null;
  var validbins = bins;
  if (name != null) {
    validbins = validbins.filter(bin => bin.name == process.argv[idx + 1]);
  }

  // Throw if multiple bins exist.
  if (validbins.length == 0) {
    if (name) {
      console.error(`No binary target "${name}" exists for this Rust crate.\nMake sure you specify a valid binary using --bin. e.g.:`)
      bins.forEach(bin => {
        console.error('    t2 run Cargo.toml --bin', bin.name);
      })
    } else {
      console.error('No binary targets exist for this Rust crate.\nPlease add a binary and try again.')
    }
    process.exit(1);
  }
  if (validbins.length > 1) {
    console.error('Multiple binary targets exist for this Rust crate.\nPlease specify one by name with --bin. e.g.:')
    bins.forEach(bin => {
      console.error('    t2 run Cargo.toml --bin', bin.name);
    })
    process.exit(1);
  }

  var out = validbins[0];
  var dest = path.join(path.dirname(pkg.manifest_path), 'target/tessel2/release', out.name);

  config.name = out.name;
  config.path = dest;
})
.then(() => rust.buildTessel(config))
.then(() => rust.bundleTessel(config))
.then(tarball => {
  console.error('Tessel bundle written out to:');
  console.log(tarball);
})
