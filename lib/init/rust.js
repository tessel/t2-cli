// System Objects
var path = require('path');
var fs = require('fs-extra');
var cp = require('child_process');

// Third Party Dependencies

// Internal
var log = require('../log');

var exportables = {};

var options;

exportables.meta = {
  keywords: ['rust', 'rs']
};

exportables.generateProject = (opts) => {

  // Save the options so they are accessible from all functions
  options = opts;

  return exportables.verifyCargoInstalled()
    .then(exportables.generateRustSample);
};

exportables.generateRustSample = () => {
  return new Promise((resolve, reject) => {
    // Files, directories, and paths
    var file_toml = 'Cargo.toml';
    var file_src = 'main.rs';
    var dir_src = path.resolve(options.directory, 'src/');
    var path_toml = path.resolve(options.directory, file_toml);
    var path_src = path.resolve(dir_src, file_src);

    // Error functions (just to reduce copied text everywhere)
    function exists_err(filepath) {
      return new Error(`Looks like this is already a Cargo project! (${filepath} already exists)`);
    }

    function mkdir_err(dir) {
      return new Error('Could not create ' + dir);
    }

    // Generate the toml and the src file
    fs.exists(dir_src, (exists) => {
      if (exists) {
        return reject(exists_err(dir_src));
      }
      fs.exists(path_toml, (exists) => {
        if (exists) {
          return reject(exists_err(path_toml));
        }
        fs.mkdir(dir_src, (err) => {
          if (err) {
            return reject(new Error(mkdir_err(dir_src)));
          }
          // Copy over config file, the blinky main, and the toml file
          fs.createReadStream(path.resolve(__dirname, './../../resources/rust/', file_toml)).pipe(fs.createWriteStream(path_toml));
          log.info('Initialized Cargo project...');
          fs.createReadStream(path.resolve(__dirname, './../../resources/rust/', file_src)).pipe(fs.createWriteStream(path_src));
          log.info(`Wrote "Hello World" to ${path_src}`);
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

module.exports = exportables;
