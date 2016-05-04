// System Objects
// var cp = require('child_process');
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');
// var fsTemp = require('fs-temp');
// var glob = require('glob');
// var tar = require('tar');
var toml = require('toml');


// Internal
// var lists = require('./lists/javascript');
// var logs = require('../../logs');
// Necessary to ensure that the next line has had the LOCAL_AUTH_PATH descriptor added.
// var provision = require('../provision'); // jshint ignore:line
// var Tessel = require('../tessel');


var exportables = {
  meta: {
    name: 'rust',
    extname: 'rs',
    binary: '',
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
    }
  },
};

exportables.preBundle = function() {
  return Promise.resolve();
};

exportables.tarBundle = function() {

};



module.exports = exportables;
