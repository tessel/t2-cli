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
      if (!pkg) pkg = {};
      Object.keys(data).forEach(function(k) {
        if (data[k] !== undefined && data[k] !== null) pkg[k] = data[k];
      });
      fs.writeFileAsync(package, JSON.stringify(data, null, 2))
      console.log('Created package.json');
      return resolve();
    });

    // On error, reject with error;
    pz.on('error', function(error) {
      return reject(error);
    });
  });
}

function getDependencies(pkg) {
  if (!pkg.dependencies) return [];
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
        npm.commands.install(dependencies, function(error, data){
          if(error){
            reject(error);
          }
          resolve();
        });

      });
  });
}


function generateSample() {

  // update the base directory
  var base_dir = '';
  if (options.directory) { base_dir = options.directory; }

  // Rust
  if (options.lang && options.lang.toLowerCase() == 'rust') {


    var dir_cargo = base_dir+'.cargo/';
    var dir_src = base_dir+'src/';
    var file_main = 'main.rs';
    var file_toml = 'Cargo.toml';
    var file_config = 'config';

    function exists_err(file_path) {
      console.error('Looks like this is already a Cargo project! ('+file_path+' already exists)');
    }

    fs.exists(dir_cargo, function(exists) {
      if (exists) { exists_err(dir_cargo); return; }
      fs.exists(dir_src, function(exists) {
        if (exists) { exists_err(dir_src); return; }
        fs.exists(file_toml, function(exists) {
          if (exists) { exists_err(file_toml); return; }
          fs.mkdir(dir_cargo, function(err) {
            if (err) { console.error("Could not make .cargo directory"); }
            fs.mkdir(dir_src, function(err) {
              if (err) { console.error("Could not make .cargo directory"); }
              // copy over config file, the blinky main, and the toml file
              fs.createReadStream(path.resolve(__dirname + './../resources/'+file_config)).pipe(fs.createWriteStream(dir_cargo+file_config));
              fs.createReadStream(path.resolve(__dirname + './../resources/'+file_main)).pipe(fs.createWriteStream(dir_src+file_main));
              fs.createReadStream(path.resolve(__dirname + './../resources/'+file_toml)).pipe(fs.createWriteStream(base_dir+file_toml));
              console.log('Initialized Cargo repo and wrote \"Blinky\" example to ' + dir_src+file_main);
            });
          });
        });
      });
    });

  }

  // Python
  else if (options.lang && options.lang.toLowerCase() == 'python') {
    console.error('Python currently not supported... but soon!');
  }

  // Javascript
  else {
    var filename = 'index.js';
    var filepath = path.resolve(base_dir, filename);
    fs.exists(filepath, function(exists) {
      if (exists) { return };
      fs.createReadStream(path.resolve(__dirname + './../resources/' + filename)).pipe(fs.createWriteStream(filepath));
      console.log('Wrote \"Blinky\" example to ' + filepath);
    });
  }

}

module.exports = function(opts) {
  // Set interactive boolean off of CLI flags
  options = opts;

  console.log('Initializing tessel repository...');

  if (options.directory) {
    fs.exists(options.directory, function(exists) {
      // If the provided directory does not exist
      if (!exists) {
        console.error('The provided directory does not exist');
        return;
      }
      // If the provided directory is not a directory
      if (!fs.lstatSync(options.directory).isDirectory()) {
        console.error('The provided path is not a directory');
        return;
      }
      // Make sure the dir ends in a /
      if (options.directory[options.directory.length-1] != '/') {
        options.directory += '/';
      }
      package = path.resolve(options.directory, './package.json');
    });
  }

  // Rust
  if (options.lang && options.lang.toLowerCase() == 'rust') {
    console.log("Initializing new Cargo project...");
    exec("cargo", function(err, stdout, stderr) {
      if (err) { console.error("You need to install rust: \"curl -sf -L https://static.rust-lang.org/rustup.sh | sh\""); }
      else if (stderr == '') {
        generateSample();
      }
    });
  }

  // Python
  else if (options.lang && options.lang.toLowerCase() == 'python') {
    console.error('Python currently not supported... but soon!');
  }

  // Javascript TODO - get remote repo working `tessel init test_repo`
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
