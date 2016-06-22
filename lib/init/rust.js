// System Objects
var cp = require('child_process');
var path = require('path');
var util = require('util');

// Third Party Dependencies
var fs = require('fs-extra');

// Internal
var log = require('../log');

var options;
var exportables = {};

exportables.meta = {
  keywords: ['rust', 'rs']
};

exportables.generateProject = (opts) => {

  // Save the options so they are accessible from all functions
  options = opts;

  return exportables.verifyCargoInstalled()
    .then(exportables.createSampleProgram);
};

exportables.createSampleProgram = () => {
  return new Promise((resolve, reject) => {
    // Files, directories, and paths
    var cargoToml = 'Cargo.toml';
    var mainRs = 'main.rs';
    var srcDir = path.resolve(options.directory, 'src/');
    var cargoTomlDir = path.resolve(options.directory, cargoToml);
    var mainRsDir = path.resolve(srcDir, mainRs);

    // Generate the toml and the src file
    fs.exists(srcDir, (exists) => {
      if (exists) {
        return reject(new exportables.CargoExistsError(srcDir));
      }
      fs.exists(cargoTomlDir, (exists) => {
        if (exists) {
          return reject(new exportables.CargoExistsError(cargoTomlDir));
        }
        fs.mkdir(srcDir, (error) => {
          if (error) {
            return reject(new Error(`Could not create ${srcDir}; ${error.toString()}`));
          }
          // Copy over config file, the blinky main, and the toml file
          fs.createReadStream(path.resolve(__dirname, './../../resources/rust/', cargoToml)).pipe(fs.createWriteStream(cargoTomlDir));
          log.info('Initialized Cargo project...');
          fs.createReadStream(path.resolve(__dirname, './../../resources/rust/', mainRs)).pipe(fs.createWriteStream(mainRsDir));
          log.info(`Wrote "Hello World" to ${mainRsDir}`);
        });
      });
    });
  });
};

// Verify the user has Cargo, reject if they do not
exportables.verifyCargoInstalled = () => {
  return new Promise((resolve, reject) => {
    cp.exec('cargo', (err, stdout, stderr) => {
      if (err || stderr) {
        return reject(new Error('Rust or Cargo is not installed properly. You can re-install with: "curl -sf -L https://static.rust-lang.org/rustup.sh | sh"'));
      }
      return resolve();
    });
  });
};

exportables.CargoExistsError = function(filepath) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = `Cargo Project Exists at ${filepath}`;
};

util.inherits(exportables.CargoExistsError, Error);

module.exports = exportables;
