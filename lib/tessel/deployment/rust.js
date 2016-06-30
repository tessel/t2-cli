// System Objects
var path = require('path');
var http = require('http');
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');
var tags = require('common-tags');
var toml = require('toml');
require('toml-require').install();
var Reader = require('fstream').Reader;
var tar = require('tar');
var tarStream = require('tar-stream');
var streamToArray = require('stream-to-array');

// Internal
var commands = require('../commands');
var lists = require('./lists/rust');
var Tessel = require('../tessel');
var log = require('../../log');

var exportables = {
  meta: {
    name: 'rust',
    extname: 'rs',
    // TODO: do not hardcode the binary name
    binary: '/tmp/remote-script/hello',
    // TODO: do not hardcode the entry
    entry: 'src/main.rs',
    configuration: 'Cargo.toml',
    checkConfiguration: (pushdir, basename, program) => {
      var cargoToml = toml.parse(fs.readFileSync(path.join(pushdir, 'Cargo.toml'), 'utf8'));

      if (cargoToml.package) {
        basename = path.basename(program);
        program = cargoToml.package.name;
      }

      return {
        basename,
        program
      };
    },
    shell: () => {
      return tags.stripIndent `
        #!/bin/sh
        exec /app/remote-script/${exportables.meta.binary}
      `;
    },
  },
  lists: lists,
};

exportables.preBundle = function() {
  return Promise.resolve();
};

// This must implement a Promise that resolves with a Buffer
// that represents a DIRECTORY containing the compiled Rust
// executable.
exportables.tarBundle = function(opts) {
  return exportables.remoteRustCompilation(opts);
};

exportables.preRun = function(tessel) {
  return new Promise((resolve) => {
    return tessel.connection.exec(commands.chmod('+x', `${Tessel.REMOTE_RUN_PATH}${exportables.meta.binary}`), {}, () => resolve());
  });
};

exportables.remoteRustCompilation = function(opts) {
  log.info('Compiling Rust code...');
  return new Promise(function(resolve, reject) {

    // Save our incoming compiled buffer to this array
    var buffers = [];

    var host = opts.rustCC;
    var port = '8080';

    // Check if the URI has a port like localhost:1234
    if (host.includes(':')) {
      var parts = opts.rustCC.split(':');
      host = parts[0];
      port = parts[1];
    }

    // The location of our cross compilation server
    var post_options = {
      host: host,
      port: port,
      path: '/rust-compile',
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        // TODO: How is this safely resolvable?
        // Perhaps parsing opts.resolvedEntryPoint?
        'X-BINARY-NAME': 'hello',
        'X-PROJECT-FOLDER': path.basename(opts.target),
      }
    };

    // Set up the request
    var post_req = http.request(post_options, function(res) {
      // When we get incoming binary data, save to our buffers
      res.on('data', function(chunk) {
          // Write this incoming data to our tar packer
          buffers.push(chunk);
        })
        // Reject on failure
        .on('error', function(e) {
          return reject(e);
        })
        // When the post completes, resolve with the executable
        .on('end', function() {
          // Resolve with concatenated buffers
          return resolve(Buffer.concat(buffers));
        });
    });

    // Create an outgoing tar packer for our project
    var outgoingPacker = tar.Pack({
        noProprietary: true
      })
      .on('error', reject);

    // Send the project directory through the tar packer and into the post request
    Reader({
        path: opts.target,
        type: 'Directory'
      })
      .on('error', reject)
      .pipe(outgoingPacker)
      .pipe(post_req);
  });
};

module.exports = exportables;
