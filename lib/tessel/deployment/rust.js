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


var exportables = {
  meta: {
    name: 'rust',
    extname: 'rs',
    binary: 'rust_executable',
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
        exec /app/remote-script/rust_executable
      `;
    },
  },
  lists: lists,
};

exportables.preBundle = function() {
  return Promise.resolve();
};

exportables.tarBundle = function() {
  // This must implement a Promise that resolves with a Buffer
  // that represents a DIRECTORY containing the compiled Rust
  // executable.

  return exportables.remoteRustCompilation(opts);
};

exportables.preRun = function(tessel) {
  return new Promise((resolve) => {
    return tessel.connection.exec(commands.chmod('+x', `${Tessel.REMOTE_RUN_PATH}rust_executable`), {}, () => resolve());
  });
};

exportables.remoteRustCompilation = function(project) {
  log.info("Compiling Rust code...");
  return new Promise(function(resolve, reject) {

    // Save our incoming compiled buffer to this array
    var buffers = [];

    // The location of our cross compilation server
    // TODO: don't harcode this
    var post_options = {
      host: '127.0.0.1',
      port: '8080',
      path: '/rust-compile',
      method: 'POST',
      headers: {
          'Content-Type': 'application/octet-stream',
          'X-BINARY-NAME': project.program,
          'X-PROJECT-FOLDER': path.basename(project.pushdir),
      }
    };

    // Create a new tar pack for incoming executable data
    var pack = tarStream.pack();
    // Create the entry file name
    pack.entry( { name : 'rust_executable' });

    // Set up the request
    var post_req = http.request(post_options, function(res) {
      // When we get incoming binary data, save to our buffers
      res.on('data', function(chunk) {
        // Write this incoming data to our tar packer
        pack.write(chunk);
      })
      // Reject on failure
      .on('error', function(e) {
        return reject(e);
      })
      // When the post completes, resolve with the executable
      .on('end', function() {
        // Indicate that all data has been received
        pack.finalize();

        // Turn the stream into an array of buffers
        return streamToArray(pack)
        .then((arr) => {
          // For each buffer in the array
           for (var i = 0, l = arr.length; i < l ; ++i) {
             // Grab the part
             var part = parts[i]
             // Push it into our buffer array
             buffers.push((part instanceof Buffer) ? part : new Buffer(part))
           }
           // Resolve with concatenated buffers
           return resolve(Buffer.concat(buffers));
        })
      })
    });

    // Create an outgoing tar packer for our project
    var outgoingPacker = tar.Pack({ noProprietary: true })
      .on('error', reject)

    // Send the project directory through the tar packer and into the post request
    Reader({ path: project.pushdir, type: "Directory" })
      .on('error', reject)
      .pipe(outgoingPacker)
      .pipe(post_req)
  });
}

module.exports = exportables;
