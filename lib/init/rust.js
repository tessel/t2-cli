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
    var dirAndCargoToml = path.resolve(options.directory, cargoToml);
    var dirAndMainRs = path.resolve(srcDir, mainRs);

    // Generate the toml and the src file
    fs.exists(srcDir, (exists) => {
      if (exists) {
        return reject(new CargoExistsError(srcDir));
      }
      fs.exists(dirAndCargoToml, (exists) => {
        if (exists) {
          return reject(new CargoExistsError(dirAndCargoToml));
        }
        fs.mkdir(srcDir, (error) => {
          if (error) {
            return reject(new CreateError(srcDir, error));
          }

          fs.copy(path.resolve(__dirname, './../../', 'resources/rust', cargoToml), dirAndCargoToml, (error) => {
            if (error) {
              return reject(new CreateError(dirAndCargoToml, error));
            }
            log.info('Initialized Cargo project...');

            fs.copy(path.resolve(__dirname, './../../', 'resources/rust', mainRs), dirAndMainRs, (error) => {
              if (error) {
                return reject(new CreateError(dirAndMainRs, error));
              }

              log.info(`Wrote "Hello World" to ${dirAndMainRs}`);
              resolve();
            });
          });
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

function CargoExistsError(filepath) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = `Cargo Project Exists at ${filepath}`;
}

function CreateError(filepath, error) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = `Could not create ${filepath}; ${error.toString()}`;
}

util.inherits(CargoExistsError, Error);
util.inherits(CreateError, Error);

module.exports = exportables;
