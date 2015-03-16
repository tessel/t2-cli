var Promise = require('bluebird');
// Promise.longStackTraces();

var PZ = require('promzard').PromZard,
  path = require('path'),
  fs = Promise.promisifyAll(require("fs")),
  readFile = Promise.promisify(fs.writeFile),
  NPM = require('npm');

var package = path.resolve(__dirname, 'package.json');
var pkg, ctx, interactive;

function loadNpm() {
  return new Promise(function(resolve, reject) {
    NPM.load(function(error, npm) {
      if (error) {
        reject(error);
        return;
      }
      resolve(npm);
      return;
    });
  });
}

function getNpmConfig(npm) {
  return new Promise(function(resolve, reject) {
    // Always resolve, we don't care if there isn't an npm config.
    var npmConfig = npm.config.list || {};
    resolve(npmConfig);
  });
}

function buildJSON() {
  return new Promise(function(resolve, reject) {
    var promzardFile;
    // Default to auto config
    promzardFile = path.resolve(__dirname, 'init-default.js');
    if (interactive) {
      promzardFile = path.resolve(__dirname, 'init-config.js');
    }
    // Init promozard with appropriate config.
    var pz = new PZ(promzardFile, ctx);
    // On data
    pz.on('data', function(data) {
      if (!pkg) pkg = {};
      Object.keys(data).forEach(function(k) {
        if (data[k] !== undefined && data[k] !== null) pkg[k] = data[k];
      });
      console.log('created: package.json \n \n %s', JSON.stringify(data, null, 2));
      resolve(JSON.stringify(pkg, null, 2));
    });

    pz.on('error', function(error) {
      reject(error);
    })
  });
}


function npmInstall() {
  return new Promise(function(resolve, reject) {
    fs.writeFile(package, JSON.stringify(pkg), function(error) {
      if (error) reject(error);
      loadNpm()
        .then(function(npm) {
          npm.commands
            .install(getDependancies(), resolve);
        })
    })
  });
}

function generateSample() {
  try {
    f = fs.readdirSync(dirname).filter(function(f) {
      return f.match(/\.js$/)
    })
    if (f.indexOf('index.js') !== -1)
      f = 'index.js'
    else if (f.indexOf('main.js') !== -1)
      f = 'main.js'
    else if (f.indexOf(ctx.basename + '.js') !== -1)
      f = ctx.basename + '.js'
    else
      f = f[0]
  } catch (e) {}
  // TODO: pull sample from out of a hat
}

function getDependancies() {
  var p = require(package);
  if (!p.dependencies) return [];

  var dependencies = [];
  for (var mod in p.dependencies) {
    dependencies.push(mod + "@" + p.dependencies[mod]);
  }
  return dependencies;
}

module.exports = function(opts) {
  // Set interactive boolean off of CLI flags
  interactive = opts.interactive;

  fs.readFileAsync(package, 'utf8')
    .then(function(data) {
      try {
        ctx = JSON.parse(d);
        pkg = JSON.parse(d)
      } catch (e) {
        ctx = {}
      }
      ctx.dirname = path.dirname(package);
      ctx.basename = path.basename(ctx.dirname);

      if (!ctx.version) ctx.version = undefined;
      return;
    })
    .catch(function(error) {
      ctx = {};
      ctx.dirname = path.dirname(package);
      ctx.basename = path.basename(ctx.dirname);
      ctx.version = undefined;
    })
    .then(loadNpm)
    .then(getNpmConfig)
    .then(function(npmConfig) {
      ctx.config = npmConfig;
      return ctx;

    })
    .then(buildJSON)
    .then(function() {
      return fs.writeFileAsync(package)
    })
    .then(npmInstall)
    .then(generateSample)
    .catch(function(error) {
      console.error(error);
    });
};
