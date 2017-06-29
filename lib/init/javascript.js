'use strict';

// System Objects
const path = require('path');

// Third Party Dependencies
const fs = require('fs-extra');
const PZ = require('promzard').PromZard;
const NPM = require('npm');

// Internal
const log = require('../log');
const glob = require('../tessel/deployment/glob');

let pkg, ctx, options;
let packageJson = path.resolve('./package.json');
let resources = path.resolve(__dirname, './../../', 'resources/javascript');
let exportables = {};

exportables.meta = {
  keywords: ['javascript', 'js']
};

exportables.loadNpm = () => {
  // You have to load npm in order to use it programatically
  return new Promise((resolve, reject) => {
    NPM.load((error, npm) => {
      if (error) {
        return reject(error);
      }
      // It then returns a npm object with functions
      resolve(npm);
    });
  });
};

// Resolve an npm cofig list, or nothing (existance is not needed)
exportables.resolveNpmConfig = (npm) => {
  // Always resolve, we don't care if there isn't an npm config.
  return Promise.resolve(npm.config.list || {});
};

// Builds the package.json file and writes it to the directory
// This is ignored for now because it includes global state vars
// that can't be stubbed. Until we can fix that, we'll ignore it.
/* istanbul ignore next */
exportables.buildJSON = (npmConfig) => {

  return new Promise((resolve, reject) => {
    // Path to promzard config file
    var promzardConfig;
    ctx.config = npmConfig;
    // Default to auto config
    promzardConfig = path.join(resources, 'init-default.js');
    if (options.interactive) {
      promzardConfig = path.join(resources, 'init-config.js');
    }

    // Init promozard with appropriate config.
    var pz = new PZ(promzardConfig, ctx);

    // On data resolve the promise with data
    pz.on('data', (data) => {
      if (!pkg) {
        pkg = {};
      }
      Object.keys(data).forEach(function(k) {
        if (data[k] !== undefined && data[k] !== null) {
          pkg[k] = data[k];
        }
      });

      log.info('Created "package.json".');
      resolve(data);
    });

    // On error, reject with error;
    pz.on('error', (error) => {
      reject(error);
    });
  });
};

// Returns the dependencies of the package.json file
exportables.getDependencies = (pkg) => {
  // Let's find the dependencies that were installed
  // by the author...
  const dependencies = new Set();
  const packageFiles = glob.sync('node_modules/*/package.json');
  const authorInstalledDependencies = packageFiles.reduce((accum, file) => {
    const content = require(path.join(process.cwd(), file));

    if (content._requiredBy &&
      content._requiredBy.includes('#USER')) {
      accum[content.name] = content.version;
    }
    return accum;
  }, {});

  if (typeof pkg.dependencies === 'undefined') {
    pkg.dependencies = [];
  }
  // pkg.dependencies will contain saved deps
  // authorInstalledDependencies will contain author installed
  // dependencies that were not necessarily saved.
  //
  Object.assign(pkg.dependencies, authorInstalledDependencies);

  for (const mod in pkg.dependencies) {
    dependencies.add(`${mod}@${pkg.dependencies[mod]}`);
  }

  return Array.from(dependencies);
};

// Installs npm and dependencies
exportables.npmInstall = (dependencies) => {
  return new Promise((resolve, reject) => {

    // If there are no dependencies resolve
    if (!dependencies.length) {
      return resolve();
    }

    // load npm to get the npm object
    exportables.loadNpm()
      .then((npm) => {
        npm.registry.log.level = 'silent';
        npm.commands.install(dependencies, (error) => {
          if (error) {
            reject(error);
          }
          resolve();
        });
      });
  });
};

// Generates blinky for JavaScript
exportables.createSampleProgram = () => {
  return new Promise((resolve) => {
    var filename = 'index.js';

    // If an index.js already exists
    fs.exists(filename, (exists) => {
      // just return
      if (exists) {
        return resolve();
      }

      fs.copy(path.join(resources, filename), filename, () => {
        log.info('Wrote "Hello World" to index.js');
        resolve();
      });
    });
  });
};

exportables.createNpmrc = () => {
  const npmrc = '.npmrc';
  return new Promise((resolve) => {
    fs.exists(npmrc, (exists) => {
      if (exists) {
        return resolve();
      }
      fs.copy(path.join(resources, npmrc), npmrc, () => {
        log.info('Created ".npmrc".');
        resolve();
      });
    });
  });
};

exportables.createTesselinclude = () => {
  var tesselinclude = '.tesselinclude';
  return new Promise((resolve) => {
    fs.exists(tesselinclude, (exists) => {
      if (exists) {
        return resolve();
      }
      fs.copy(path.join(resources, tesselinclude), tesselinclude, () => {
        log.info('Created ".tesselinclude".');
        resolve();

      });
    });
  });
};

exportables.readPackageJson = () => {
  return new Promise((resolve, reject) => {
    fs.readFile(packageJson, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }

      resolve(data);
    });
  });
};

exportables.writePackageJson = (data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(packageJson, data, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};

exportables.prettyPrintJson = (data) => {
  return JSON.stringify(data, null, 2);
};

// This is ignored for now because it includes global state vars
// that can't be stubbed. Until we can fix that, we'll ignore it.
/* istanbul ignore next */
exportables.generateProject = (opts) => {

  // Make the options global
  options = opts;

  log.info('Initializing new Tessel project for JavaScript...');
  return exportables.readPackageJson()
    .then((data) => {

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
    .catch(() => {
      ctx = {};
      ctx.dirname = path.dirname(packageJson);
      ctx.basename = path.basename(ctx.dirname);
      ctx.version = undefined;
      return ctx;
    })
    .then(exportables.createNpmrc)
    .then(exportables.loadNpm)
    .then(exportables.resolveNpmConfig)
    .then(exportables.buildJSON)
    .then(exportables.prettyPrintJson)
    .then(exportables.writePackageJson)
    .then(exportables.readPackageJson)
    .then(JSON.parse)
    .then(exportables.getDependencies)
    .then(exportables.npmInstall)
    .then(exportables.createTesselinclude)
    .then(exportables.createSampleProgram)
    .catch(error => {
      log.error(error);
    });
};

module.exports = exportables;
