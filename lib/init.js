// System Objects
var path = require('path');
var fs;

// Third Party Dependencies
var Promise = require('bluebird');
var PZ = require('promzard').PromZard;
var NPM = require('npm');

// Internal
// ...

fs = Promise.promisifyAll(require('fs'));

var packageJson = path.resolve('./package.json');
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
    dependencies.push(mod + '@' + pkg.dependencies[mod]);
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

  // If an index.js already exists
  fs.exists(filename, function(exists) {
    // just return
    if (exists) {
      return;
    }

    // If not and rust was requested
    if (options.rust) {
      // Place the rust example
      filename = 'index.rs';
    }
    // If python was requested
    if (options.python) {
      // Place the python example
      filename = 'index.py';
    }

    // Pipe the contents of the default file into a new file
    fs.createReadStream(path.resolve(__dirname + './../resources/' + filename))
      .pipe(fs.createWriteStream(filename));

    console.log('Wrote \'Hello World\' to index.');
  });
}


module.exports = function(opts) {
  // Set interactive boolean off of CLI flags
  options = opts;

  console.log('Initializing tessel repository...');

  fs.readFileAsync(packageJson, 'utf8')
    .then(function(data) {

      // Try to parse current package JSON
      try {
        ctx = pkg = JSON.parse(data);
      } catch (e) {
        // if it can't parse, then just make an object
        ctx = {};
      }

      ctx.dirname = path.dirname(packageJson);
      ctx.basename = path.basename(ctx.dirname);

      if (!ctx.version) {
        ctx.version = undefined;
      }
      return ctx;
    })
    .catch(function() {
      ctx = {};
      ctx.dirname = path.dirname(packageJson);
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
      return fs.writeFileAsync(packageJson, JSON.stringify(data, null, 2));
    })
    .then(function() {
      return fs.readFileAsync(packageJson);
    })
    .then(JSON.parse)
    .then(getDependencies)
    .then(npmInstall)
    .then(generateSample)
    .catch(function(error) {
      console.error(error);
    });
};
