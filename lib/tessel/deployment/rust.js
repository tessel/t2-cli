// System Objects
var path = require('path');
var http = require('http');
var path = require('path');
var url = require('url');

// Third Party Dependencies
var fs = require('fs-extra');
var tags = require('common-tags');
var tar = require('tar');
var Reader = require('fstream').Reader;
var tags = require('common-tags');

// Internal
var commands = require('../commands');
var lists = require('./lists/rust');
var log = require('../../log');
var Tessel = require('../tessel');
var rust = require('../../install/rust');

var exportables = {
  meta: {
    name: 'rust',
    extname: 'rs',
    binary: '.',
    entry: 'src/main.rs',
    configuration: 'Cargo.toml',
    isFile: false,
    checkConfiguration: (pushdir, basename, program) => {
      var metadata = rust.cargoMetadata(pushdir);

      // Get first package.
      var pkg = metadata.packages.pop();
      var bins = pkg.targets.filter(target => target.kind.indexOf('bin') > -1);
      var match = bins.filter(bin => bin.name === program)[0];

      if (!match) {
        if (bins.length === 0) {
          throw new Error(`No Cargo binary targets exist. Please create a binary target named ${program}".`);
        } else {
          var err = [`No Cargo binary target "${program}" exists. Available options:`];
          err = err.concat(bins.map(x => ` $ t2 run ${x.name}`));
          throw new Error(err.join('\n'));
        }
      } else {
        basename = pushdir;
      }

      return {
        basename,
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

// The Rust prebundle step just updated the resolvedEntryPoint
// property with the Rust binary name
exportables.preBundle = function(opts) {
  return new Promise((resolve, reject) => {
    // Get details of the project
    var details = exportables.meta.checkConfiguration(opts.target, null, opts.entryPoint);

    // If it was unable to fetch the details
    if (typeof details !== 'object') {
      // Abort the deploy
      return reject('Unable to parse Cargo.toml');
    } else {
      // Update the resolved entry point to the program name
      opts.resolvedEntryPoint = details.program;
      // Continue with the deploy
      resolve();
    }
  });
};

// This must implement a Promise that resolves with a Buffer
// that represents a DIRECTORY containing the compiled Rust
// executable.
exportables.tarBundle = function(opts) {
  if (opts.rustcc === true) {
    opts.rustcc = 'http://rustcc.tessel.io:49160';
  }

  if (opts.rustcc) {
    return exportables.remoteRustCompilation(opts);
  } else {
    var config;
    return rust.getBuildConfig()
      .catch(e => {
        log.error('Encountered the following error:', e.message);
        log.error('The Rust SDK and a stable Rust version is required for cross-compilation.');
        log.error('Please run "t2 install rust-sdk" to install it.');
        log.error('(To use the remote Rust compiler, use `t2 run <target> --rustcc`)');
        process.exit(1);
      })
      .then(_config => {
        config = _config;

        var dest = path.join(opts.target, 'target/tessel2/release', opts.resolvedEntryPoint);

        config.name = opts.resolvedEntryPoint;
        config.path = dest;
      })
      .then(() => rust.buildTessel(config))
      .then(() => rust.bundleTessel(config))
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
      path: '/rust-compile',
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
            log.error('Invalid JSON response received from cross-compilation server:');
            log.error('    ', Buffer.concat(buffers).toString());
            process.exit(1);
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
