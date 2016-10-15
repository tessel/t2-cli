// System Objects
var http = require('http');
var querystring = require('querystring');
var url = require('url');

// Third Party Dependencies
var fs = require('fs-extra');
var fstream = require('fstream');
var path = require('path');
var tags = require('common-tags');
var tar = require('tar');

var Reader = fstream.Reader;

// Internal
var commands = require('../commands');
var lists = require('./lists/rust');
var log = require('../../log');
var rust = require('../../install/rust');
var Tessel = require('../tessel');

var exportables = {
  meta: {
    name: 'rust',
    extname: 'rs',
    binary: '.',
    isFile: false,
    entry: 'src/main.rs',
    configuration: 'Cargo.toml',
    checkConfiguration: (pushdir, basename, program) => {
      // Run a cursory check of the Cargo.toml file. The Rust target does
      // target name resolution directly.
      fs.readFileSync(path.join(pushdir, 'Cargo.toml'), 'utf8');

      return {
        basename: pushdir,
        program
      };
    },
    shell: (options) => {
      return tags.stripIndent `
        #!/bin/sh
        exec /app/remote-script/${options.resolvedEntryPoint} ${options.subargs.join(' ')}
      `;
    },
  },
  lists: lists,
};

// Check our requirements are met.
exportables.preBundle = function(opts) {
  if (opts.rustcc) {
    // When compiling with the remote server, we have nothing to check.
    return Promise.resolve();
  } else {
    // Check that rust, the sdk, and the binary name are valid.
    return rust.checkRust({
        isCli: true
      })
      .then(() => rust.checkSdk())
      .then(() => rust.checkBinaryName({
        isCli: true,
        binary: opts.resolvedEntryPoint,
        path: opts.target
      }));
  }
};

// This must implement a Promise that resolves with a Buffer
// that represents a DIRECTORY containing the compiled Rust
// executable.
exportables.tarBundle = function(opts) {
  if (opts.rustcc === true) {
    opts.rustcc = 'http://rustcc.tessel.io';
  }

  if (opts.rustcc) {
    return exportables.remoteRustCompilation(opts);
  } else {
    return rust.runBuild(true, opts.resolvedEntryPoint, opts.target)
      .then(tarball => fs.readFileSync(tarball));
  }
};

/*
exportables.postRun = function(tessel, options) {
  return Promise.resolve();
};
*/

// The following line will be ignored by JSHint because
// presently, `opts` is not in use, but it's valuable to
// include the parameter in the list.
exportables.preRun = function(tessel, opts) { // jshint ignore:line
  return tessel.simpleExec(commands.chmod('+x', `${Tessel.REMOTE_RUN_PATH}${opts.resolvedEntryPoint}`));
};

exportables.remoteRustCompilation = (opts) => {
  log.info('Compiling Rust code remotely (--rustcc)...');
  return new Promise(function(resolve, reject) {

    // Save our incoming compiled buffer to this array
    var buffers = [];

    // Parse out the components of the remote rust compilation server
    if (!opts.rustcc.startsWith('http')) {
      // Without an HTTP protocol definition, url.parse will fail;
      // assume http:// was implied
      opts.rustcc = 'http://' + opts.rustcc;
    }
    var destination = url.parse(opts.rustcc);

    // The location of our cross compilation server
    var options = {
      host: destination.hostname,
      port: destination.port,
      path: '/rust-compile?target=' + querystring.escape(opts.resolvedEntryPoint),
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      }
    };

    // Set up the request
    var req = http.request(options, (res) => {
      // When we get incoming binary data, save to our buffers
      res.on('data', function(chunk) {
          // Write this incoming data to our buffer collection
          buffers.push(chunk);
        })
        // Reject on failure
        .on('error', function(postReqError) {
          return reject(postReqError);
        })
        // When the post completes, resolve with the executable
        .on('end', function() {
          // Parse the incoming data as JSON
          var result;
          try {
            result = JSON.parse(Buffer.concat(buffers));
          } catch (e) {
            return reject(tags.stripIndent `
              Please file an issue on https://github.com/tessel/t2-cli with the following:
              You received an invalid JSON response from the cross-compilation server.
                  ${Buffer.concat(buffers).toString()}`);
          }

          // Check if there was an error message written
          if (result.error !== undefined && result.error !== '') {
            // If there was, abort with the provided message
            return reject(new Error(result.error));
          }

          // Print out any stderr output
          else if (result.stderr !== null && result.stderr !== '') {
            log.info(result.stderr);
          }

          // Print out any stdout output
          if (result.stdout !== null) {
            log.info(result.stdout);
          }

          // If the binary was not provided
          if (result.binary === null) {
            // Reject with an error
            return reject(new Error('Neither binary nor error returned by cross compilation server.'));
          }
          // If the binary was provided
          else {
            // All was successful and we can return
            return resolve(new Buffer(result.binary, 'base64'));
          }
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
      .pipe(req);
  });
};

module.exports = exportables;
