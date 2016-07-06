// System Objects
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');
var tags = require('common-tags');
var toml = require('toml');


// Internal
var commands = require('../commands');
var lists = require('./lists/rust');
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

// The following line will be ignored by JSHint because
// presently, `options` is not in use, but it's valuable to
// include the parameter in the list.
exportables.preRun = function(tessel, options) { // jshint ignore:line
  return new Promise((resolve) => {
    return tessel.connection.exec(commands.chmod('+x', `${Tessel.REMOTE_RUN_PATH}rust_executable`), {}, () => resolve());
  });
};

/*
exportables.postRun = function(tessel, options) {
  return Promise.resolve();
};
*/

module.exports = exportables;
