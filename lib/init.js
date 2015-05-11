var Promise = require('bluebird')
  , path = require('path')
  , fs = Promise.promisifyAll(require("fs"))
  , PZ = require('promzard').PromZard
  , NPM = require('npm')
  , sys = require('sys')
  , exec = require('child_process').exec
  ;


var package = path.resolve('./package.json');
var pkg, ctx, options;


// Populates the ctx information
function populateCTX() {
  return new Promise(function(resolve, reject) {
    fs.readFileAsync(package, 'utf8')
      .then(function(data) {
        try {
          ctx = JSON.parse(data);
          pkg = JSON.parse(data);
        } catch (e) {
          ctx = {};
        }
        ctx.dirname = path.dirname(package);
        ctx.basename = path.basename(ctx.dirname);
        if (!ctx.version) { ctx.version = undefined; }
        return resolve();
      })
      // If package.json does not exist already
      .catch(function(error) {
        ctx = {};
        ctx.dirname = path.dirname(package);
        ctx.basename = path.basename(ctx.dirname);
        ctx.version = undefined;
        return resolve();
      });
  });
}


// Load npm in order to use it programatically
function loadNpm() {
  return new Promise(function(resolve, reject) {
    NPM.load(function(error, npm) {
      return error ? reject(error) : resolve(npm);
    });
  });
}


// Resolve an npm cofig list, or nothing (existance is not needed)
function getNpmConfig(npm) {
  return new Promise(function(resolve, reject) {
    resolve(npm.config.list || {});
  });
}

// Builds the package.json file and writes it to the directory
function buildJSON(npmConfig) {
  return new Promise(function(resolve, reject) {

    // Path to promzard config file
    var promzardConfig;
    ctx.config = npmConfig;

    // Default to auto config
    promzardConfig = path.resolve(__dirname + '/../', 'resources/init-default.js');
    if (options.interactive) {
      promzardConfig = path.resolve(__dirname + '/../', 'resources/init-config.js');
    }

    // Init promozard with appropriate config
    var pz = new PZ(promzardConfig, ctx);

    // On data write the package.json file
    pz.on('data', function(data) {
      if (!pkg) {
        pkg = {};
      }
      Object.keys(data).forEach(function(k) {
        if (data[k] !== undefined && data[k] !== null) {
          pkg[k] = data[k];
        }
      });
      fs.writeFileAsync(package, JSON.stringify(data, null, 2));
      console.log('Created package.json...');
      return resolve();
    });

    // On error reject with error
    pz.on('error', function(err) {
      return reject(err);
    });

  });
}


// Returns the dependencies of the package.json file
function getDependencies() {
  return new Promise(function(resolve, reject) {
    var pkg = fs.readFileAsync(package);
    var dependencies = [];
    for (var mod in pkg.dependencies) {
      dependencies.push(mod + "@" + pkg.dependencies[mod]);
    }
    return resolve(dependencies);
  });
}


// Installs npm
function npmInstall(dependencies) {
  return new Promise(function(resolve, reject) {

    // If there are no depencencies resolve
    if (!dependencies.length) { return resolve(); }

    // Load npm to get the npm object
    loadNpm()
      .then(function(npm) {
        npm.commands.install(dependencies, function(error, data){
          return (error) ? reject(error) : resolve();
        });
      });
  });
}

// Generates blinky for the various supported languages
function generateSample() {
  return new Promise(function(resolve, reject) {

    // Javascript
    if (!options.lang || (options.lang && keywords_js.indexOf(options.lang.toLowerCase()) > -1)) {

      // File and path to js file
      var filename = 'index.js';
      var filepath = path.resolve(options.directory, filename);

      // Create blinky program in js file if file does not already exist
      fs.exists(filepath, function(exists) {
        if (exists) { return; }
        fs.createReadStream(path.resolve(__dirname, './../resources/',filename)).pipe(fs.createWriteStream(filepath));
        console.log('Wrote \"Blinky\" example to ' + filepath);
        return resolve();
      });

    }

    // Rust
    else if (options.lang && keywords_rs.indexOf(options.lang.toLowerCase()) > -1) {

      // Files, directories, and paths
      var file_toml = 'Cargo.toml';
      var file_config = 'config';
      var file_src = 'main.rs';
      var dir_config = path.resolve(options.directory,'.cargo/');
      var dir_src = path.resolve(options.directory,'src/');
      var path_toml = path.resolve(options.directory,file_toml);
      var path_config = path.resolve(dir_config,file_config);
      var path_src = path.resolve(dir_src,file_src);

      // Error functions (just to reduce copied text everywhere)
      function exists_err(filepath) {
        return new Error('Looks like this is already a Cargo project! ('+filepath+' already exists)');
      }
      function mkdir_err(dir) {
        return new Error('Could not create '+dir);
      }

      // Generate the config file, the toml, and the src file
      fs.exists(dir_config, function(exists) {
        if (exists) {
          return reject(exists_err(dir_config));
        }
        fs.exists(dir_src, function(exists) {
          if (exists) {
            return reject(exists_err(dir_src));
          }
          fs.exists(path_toml, function(exists) {
            if (exists) {
              return reject(exists_err(path_toml));
            }
            fs.mkdir(dir_config, function(err) {
              if (err) {
                return reject(new Error(mkdir_err(dir_config)));
              }
              fs.mkdir(dir_src, function(err) {
                if (err) {
                  return reject(new Error(mkdir_err(dir_src)));
                }
                // Copy over config file, the blinky main, and the toml file
                fs.createReadStream(path.resolve(__dirname, './../resources/', file_config)).pipe(fs.createWriteStream(path_config));
                fs.createReadStream(path.resolve(__dirname, './../resources/', file_toml)).pipe(fs.createWriteStream(path_toml));
                console.log('Initialized Cargo project...');
                fs.createReadStream(path.resolve(__dirname, './../resources/', file_src)).pipe(fs.createWriteStream(path_src));
                console.log('Wrote \"Blinky\" example to ' + path_src);
              });
            });
          });
        });
      });

    }

    // Python
    else if (options.lang && options.lang.toLowerCase() == 'python') {
      return reject(new Error('Python currently not supported... but soon!'));
    }

  });
}


// Verify the user has Cargo, reject if they do not
function verifyCargoInstalled() {
  return new Promise(function(resolve, reject) {
    exec("cargo", function(err, stdout, stderr) {
      if (err || stderr) {
        return reject(new Error("You need to install rust: \"curl -sf -L https://static.rust-lang.org/rustup.sh | sh\""));
      }
      return resolve();
    });
  });
}


// Initialize the directory given the various options
module.exports = function(opts) {
  return new Promise(function (resolve, reject) {

    // Inform the user initialization has begun
    options = opts;
    console.log('Initializing tessel repository...');

    // Validate the directory if the user provided one
    if (options.directory) {
      fs.exists(options.directory, function(exists) {
        // Reject if the provided directory does not exist
        if (!exists) {
          return reject(new Error('The provided directory does not exist'));
        }
        // Reject if the provided directory is not a directory
        if (!fs.lstatSync(options.directory).isDirectory()) {
          return reject(new Error('The provided path is not a directory'));
        }
        // Resolve the paths
        options.directory = path.resolve(options.directory);
        package = path.resolve(options.directory, './package.json');
      });
    }
    else { options.directory = path.resolve('.'); }

    // Rust
    if (options.lang && options.lang.toLowerCase() == 'rust') {
      console.log("Initializing new Cargo project...");
      verifyCargoInstalled()
        .then(generateSample)
        .then(resolve)
        .catch(function(err) {
          return reject(err);
        });
    }

    // Python
    else if (options.lang && options.lang.toLowerCase() == 'python') {
      return reject(new Error('Python currently not supported... but soon!'));
    }

    // Javascript
    else if (options.lang && options.lang.toLowerCase() == 'javascript' || !options.lang) {
      populateCTX()
        .then(loadNpm)
        .then(getNpmConfig)
        .then(buildJSON)
        .then(getDependencies)
        .then(npmInstall)
        .then(generateSample)
        .catch(function(error) {
          return reject(error);
        });
    }

  });
};
