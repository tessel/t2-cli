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

function loadNpm() {
  // You have to load npm in order to use it programatically
  return new Promise(function(resolve, reject) {
    NPM.load(function(error, npm) {
      if (error) {
        reject(error);
        return;
      }
      // It then returns a npm object with functions
      resolve(npm);
      return;
    });
  });
}

function getNpmConfig(npm) {
  return new Promise(function(resolve) {
    // Always resolve, we don't care if there isn't an npm config.
    var npmConfig = npm.config.list || {};
    resolve(npmConfig);
  });
}

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

    // Init promozard with appropriate config.
    var pz = new PZ(promzardConfig, ctx);

    // On data resolve the promise with data
    pz.on('data', function(data) {
      if (!pkg) {
        pkg = {};
      }
      Object.keys(data).forEach(function(k) {
        if (data[k] !== undefined && data[k] !== null) {
          pkg[k] = data[k];
        }
      });

      console.log('Created package.json.');
      resolve(data);
    });

    // On error, reject with error;
    pz.on('error', function(error) {
      reject(error);
    });
  });
}

function getDependencies(pkg) {
  if (!pkg.dependencies) {
    return [];
  }
  var dependencies = [];
  for (var mod in pkg.dependencies) {
    dependencies.push(mod + "@" + pkg.dependencies[mod]);
  }
  return dependencies;
}


function npmInstall(dependencies) {
  return new Promise(function(resolve, reject) {
    // Install the dependencies
    if (!dependencies.length) {
      return resolve();
    }

    // Load npm to get the npm object
    loadNpm()
      .then(function(npm) {
        npm.commands.install(dependencies, function(error) {
          if (error) {
            reject(error);
          }
          resolve();
        });

      });
  });
}

function generateSample() {
  var filename = 'index.js';
  // If not and rust was requested
  if (options.rust) { filename = 'main.rs'; }
  // If python was requested
  if (options.python) { filename = 'index.py'; }

  // If an index.js already exists
  fs.exists(filename, function(exists) {
    // just return
    if (exists) return;

    // Pipe the contents of the default file into a new file
    fs.createReadStream(path.resolve(__dirname + './../resources/' + filename))
      .pipe(fs.createWriteStream(filename));

    console.log('Wrote \"Blinky\" example to ' + filename);
  });
}


module.exports = function(opts) {
  // Set interactive boolean off of CLI flags
  options = opts;

  console.log('Initializing tessel repository...');

  if (opts.rust) {
    console.log("Initializing Cargo project...");
    exec("which cargo", function(err, stdout, stderr) {
      if (err) { console.error("You need to install rust: \"curl -sf -L https://static.rust-lang.org/rustup.sh | sh\""); }
      // Cargo is installed
      else if (stderr == '') {
        fs.exists(options.rust, function(exists) {
          if (exists) { console.error("Project named \""+options.rust+"\" already exists!"); }
          // Project does not already exist
          else {
            exec("cargo new "+options.rust+" --bin", function(err, stdout, stderr) {
              if (err) { console.error("Could not create Cargo project. Create manually: cargo new "+options.rust+" --bin"); }
              // Created a new Cargo project
              else {
                generateSample();
                exec("mv main.rs "+options.rust+"/src/", function(err, stdout, stderr) {
                  if (err) { console.error("Could not move main.rs into src"); }
                  // Blinky has been copied over
                  else {
                    //"printf \"\n[dependencies.tessel]\ngit=\"https://github.com/tessel/rust-tessel.git\"\n\" >> Cargo.toml"
                    fs.appendFile(
                      options.rust+"/Cargo.toml",
                      "\n[dependencies.rust_tessel]\ngit=\"https://github.com/tessel/rust-tessel.git\"\n",
                      function (err) {
                        if (err) { console.error("Could not append tessel dependency to Cargo.toml"); }
                        // Cargo.toml updated to include tessel dependency
                        fs.mkdir(
                          options.rust+"/.cargo",
                          function(err) {
                            if (err) { console.error("Could not make .cargo directory"); }
                            // Made .cargo directory
                            fs.createReadStream(path.resolve(__dirname + './../resources/config')).pipe(fs.createWriteStream("config"));
                            exec("mv config "+options.rust+"/.cargo/", function(err, stdout, stderr) {
                              if (err) { console.error("Could not move config file into .cargo"); }
                              // Configuration file moved to .cargo
                            });
                          }
                        );
                      }
                    );
                  }
                });
              }
            });
          }
        });
      }
    });
  }
  else {
    fs.readFileAsync(package, 'utf8')
      .then(function(data) {
        // Try to parse current package JSON
        try {
          ctx = JSON.parse(d);
          pkg = JSON.parse(d);
        } catch (e) {
          // if it can't parse, then just make an object
          ctx = {};
        }

        ctx.dirname = path.dirname(package);
        ctx.basename = path.basename(ctx.dirname);

        if (!ctx.version) ctx.version = undefined;
        return ctx;
      })
      .catch(function(error) {
        ctx = {};
        ctx.dirname = path.dirname(package);
        ctx.basename = path.basename(ctx.dirname);
        ctx.version = undefined;
        return ctx;
      })
      .then(loadNpm)
      .then(getNpmConfig)
      .then(buildJSON)
      .then(function(data) {
        // Stringify and write package.json data
        // 2 spaces for indents is standard.
        return fs.writeFileAsync(package, JSON.stringify(data, null, 2));
      })
      .then(function(data){
        return fs.readFileAsync(package);
      })
      .then(JSON.parse)
      .then(getDependencies)
      .then(npmInstall)
      .then(generateSample)
      .catch(function(error) {
        console.error(error);
      });
  }
};
