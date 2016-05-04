// System Objects
// var cp = require('child_process');
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');
// var fsTemp = require('fs-temp');
// var glob = require('glob');
// var tar = require('tar');
var tags = require('common-tags');
var toml = require('toml');


// Internal
var commands = require('../commands');
var lists = require('./lists/rust');
// var logs = require('../../logs');
// Necessary to ensure that the next line has had the LOCAL_AUTH_PATH descriptor added.
// var provision = require('../provision'); // jshint ignore:line
var Tessel = require('../tessel');


var exportables = {
  meta: {
    name: 'rust',
    extname: 'rs',
    binary: 'rust_executable',
    entry: 'src/main.rs',
    configuration: 'Cargo.toml',
    checkConfiguration: (pushdir, basename, program) => {
      var cargoToml = toml.parse(fs.readFileSync(path.join(pushdir, 'Cargo.toml'), 'utf8'));

      if (cargoToml.package) {
        basename = path.basename(program);
        program = cargoToml.package.name;
      }

      return {
        basename,
        program
      };
    },
    shell: () => {
      return tags.stripIndent `
        #!/bin/sh
        exec /app/remote-script/rust_executable
      `;
    },
  },
  lists: lists,
};

exportables.preBundle = function() {
  return Promise.resolve();
};

exportables.tarBundle = function() {
  // This must implement a Promise that resolves with a Buffer
  // that represents a DIRECTORY containing the compiled Rust
  // executable.
  return Promise.resolve(new Buffer([0xFF]));
};

exportables.preRun = function(tessel) {
  return new Promise((resolve) => {
    return tessel.connection.exec(commands.chmod('+x', `${Tessel.REMOTE_RUN_PATH}rust_executable`), {}, () => resolve());
  });
};


module.exports = exportables;
