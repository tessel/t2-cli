global.IS_TEST_ENV = true;

// System Objects
global.cp = require('child_process');
global.dns = require('dns');
global.events = require('events');
global.http = require('http');
global.os = require('os');
global.path = require('path');
global.stream = require('stream');
global.url = require('url');
global.util = require('util');
global.zlib = require('zlib');

global.Emitter = events.EventEmitter;
global.Duplex = stream.Duplex;
global.Stream = stream.Stream;
global.Transform = stream.Transform;


// Third Party Dependencies
global.async = require('async');
global.bindings = require('bindings');
global.charSpinner = require('char-spinner');
global.colors = require('colors');
global.concat = require('concat-stream');
global.fs = require('fs-extra');
global.fsTemp = require('fs-temp');
global.fstream = require('fstream');
global.Ignore = require('fstream-ignore');
global.inquirer = require('inquirer');
global.mdns = require('mdns-js');
global.minimatch = require('minimatch');
global.mkdirp = require('mkdirp');
global.npm = require('npm');
global.npmlog = require('npmlog');
global.osenv = require('osenv');
global.Project = require('t2-project');
global.Progress = require('t2-progress');
global.request = require('request');
global.sinon = require('sinon');
global.sshpk = require('sshpk');
global.ssh = require('ssh2');
global.tags = require('common-tags');
global.tar = require('tar');
global.uglify = require('uglify-es');

// Internal
// ./lib/tessel/*
global.Tessel = require('../../lib/tessel/tessel');
global.commands = require('../../lib/tessel/commands');
global.deploy = require('../../lib/tessel/deploy');
global.deployment = require('../../lib/tessel/deployment/index');
global.glob = require('../../lib/tessel/deployment/glob');
global.provision = require('../../lib/tessel/provision');
global.restore = require('../../lib/tessel/restore');
global.RSA = require('../../lib/tessel/rsa-delegation');

// ./lib/*
global.CrashReporter = require('../../lib/crash-reporter');
global.Menu = require('../../lib/menu');
global.Preferences = require('../../lib/preferences');
global.controller = require('../../lib/controller');
global.discover = require('../../lib/discover');
global.init = require('../../lib/init');
global.installer = require('../../lib/installer');
global.log = require('../../lib/log');
global.lan = require('../../lib/lan-connection');
global.remote = require('../../lib/remote');
global.updates = require('../../lib/update-fetch');
global.usb = require('../../lib/usb-connection');

// ./lib/install/*
global.rust = require('../../lib/install/rust');

// ./lib/usb/*
global.Daemon = require('../../lib/usb/usb-daemon');
global.USBProcess = require('../../lib/usb/usb-process');

// ./test/common/*
global.TesselSimulator = require('../common/tessel-simulator');
global.RemoteProcessSimulator = require('../common/remote-process-simulator');

// ./bin/*
global.t2 = require('../../bin/tessel-2');
global.cargo = require('../../bin/cargo-tessel');

// ./package.json
global.cliPackageJson = require('../../package.json');

// Shorthands
global.LAN = lan.LAN;
global.TesselSeeker = discover.TesselSeeker;
global.USB = usb.USB;

global.Request = function Request() {};
util.inherits(global.Request, global.Stream);



// Deployment Utilities, shared across
//
// - test/unit/deploy.js
// - test/unit/deployment/javascript.js
// - test/unit/deployment/python.js
// - test/unit/deployment/rust.js
//

global.DEPLOY_DIR_JS = path.join(process.cwd(), 'test/unit/', 'tmp');
global.DEPLOY_FILE_JS = path.join(global.DEPLOY_DIR_JS, 'app.js');
global.jsCodeContents = 'console.log("testing deploy");';
global.jsCodeReference = new Buffer(global.jsCodeContents);

global.DEPLOY_DIR_RS = path.join(process.cwd(), 'test/unit/fixtures', 'rust-deploy-template');


global.deployTestCode = function(tessel, opts, callback) {
  // Create the temporary folder with example code
  createTemporaryDeployCode()
    .then(() => {

      function closeAdvance(event) {
        if (event === 'close') {
          setImmediate(() => {
            // Emit the close event to keep it going
            tessel._rps.emit('close');
          });
        }
      }

      // When we get a listener that the Tessel process needs to close before advancing
      tessel._rps.on('newListener', closeAdvance);

      // Actually deploy the script
      tessel.deploy({
          entryPoint: path.relative(process.cwd(), global.DEPLOY_FILE_JS),
          push: opts.push,
          single: opts.single
        })
        // If it finishes, it was successful
        .then(() => {
          tessel._rps.removeListener('newListener', closeAdvance);
          callback();
        })
        // If not, there was an issue
        .catch(callback);
    });
};

global.createTemporaryDeployCode = function() {
  return new Promise((resolve, reject) => {
    mkdirp(global.DEPLOY_DIR_JS, (err) => {
      if (err) {
        return reject(err);
      } else {
        fs.writeFile(global.DEPLOY_FILE_JS, jsCodeContents, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  });
};

global.deleteTemporaryDeployCode = function() {
  return new Promise(function(resolve, reject) {
    fs.remove(global.DEPLOY_DIR_JS, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

global.extract = function(bundle, callback) {
  var parser = tar.Parse();
  var entries = [];

  parser.on('entry', (entry) => {
    if (entry.type === 'File') {
      entries.push(entry.path);
    }
  });

  parser.on('end', () => {
    callback(null, entries);
  });

  parser.on('error', (error) => {
    callback(error, null);
  });

  parser.end(bundle);
};

global.processVersions = {
  http_parser: '2.5.2',
  node: '4.4.3',
  v8: '4.5.103.35',
  uv: '1.8.0',
  zlib: '1.2.8',
  ares: '1.10.1-DEV',
  modules: '46',
  openssl: '1.0.2d',
};

global.tesselBuilds = [{
  released: '2016-09-21T19:40:32.992Z',
  sha: '40b2b46a62a34b5a26170c75f7e717cea673d1eb',
  version: '0.0.16'
}, {
  sha: '9a85c84f5a03c715908921baaaa9e7397985bc7f',
  released: '2017-05-12T03:01:57.856Z',
  version: '0.0.17'
}];
