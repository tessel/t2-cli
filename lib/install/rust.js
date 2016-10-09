// System Objects
var path = require('path');
var cp = require('child_process');
var stream = require('stream');
var zlib = require('zlib');

var Transform = stream.Transform;

// Third Party Dependencies
var blocks = require('block-stream2');
var bz2 = require('unbzip2-stream');
var createHash = require('sha.js');
var fs = require('fs-extra');
var fsTemp = require('fs-temp');
var osenv = require('osenv');
var Progress = require('progress');
var request = require('request');
var tags = require('common-tags');
var tar = require('tar-fs');

// Internal
var log = require('../log');

var SDK_PATHS = {
  sdk: path.join(osenv.home(), '.tessel/sdk'),
  rustlib: path.join(osenv.home(), '.tessel/rust'),
};

var SDK_URLS = {
  macos: 'https://builds.tessel.io/t2/sdk/t2-sdk-macos-x86_64.tar.bz2',
  linux: 'https://builds.tessel.io/t2/sdk/t2-sdk-linux-x86_64.tar.bz2',
};

var RUST_LIB_TGZ_URL = 'https://builds.tessel.io/t2/sdk/t2-rustlib-VERSION.tar.gz';

// Get the platform identifier. This actually conforms to the list of OSes
// Rust supports, not the value of process.platform, so we need to convert it.
// See: https://doc.rust-lang.org/std/env/consts/constant.OS.html
function getPlatform() {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      throw new Error('Your platform is not yet supported for cross-compilation.');
  }
}

function sha256stream() {
  var sha256 = createHash('sha256');
  var stream = new Transform();
  stream._transform = function(chunk, encoding, callback) {
    this.push(chunk);
    sha256.update(chunk);
    callback();
  };
  stream.on('finish', () => {
    stream.emit('sha256', sha256.digest('hex'));
  });
  return stream;
}

function sha256file(hash, name) {
  return `${hash}  ${name}\n`;
}

function download(url) {
  var req = request.get(url);

  // When we receive the response
  req.on('response', (res) => {

    // Parse out the length of the incoming bundle
    var contentLength = parseInt(res.headers['content-length'], 10);

    // Create a new progress bar
    var bar = new Progress('     [:bar] :percent :etas remaining', {
      clear: true,
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: contentLength
    });

    // When we get incoming data, update the progress bar
    res.on('data', (chunk) => {
      bar.tick(chunk.length);
    });
  });

  return req;
}

function downloadString(url) {
  return new Promise((resolve, reject) => {
    request({
      url,
      // We want to force Cloudfront to serve us the latest file.
      headers: {
        'Accept-Encoding': 'gzip, deflate',
      },
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        resolve(body);
      } else {
        reject(error || response.statusCode);
      }
    });
  });
}

function tmpdir() {
  return new Promise((resolve) => {
    var dir = fsTemp.template('t2-sdk-%s').mkdirSync();
    resolve({
      path: dir,
      cleanup: () => {
        try {
          fs.removeSync(dir);
        } catch (e) {
          // Swallow errors in removing temporary folder. If the folder was
          // successfully or unsuccessfully moved, it may not exist at its
          // location in the temporary directory, but this isn't fatal.
        }
      }
    });
  });
}

module.exports.toolchainPath = () => {
  return new Promise((resolve, reject) => {
    var sdkPlatformPath = path.join(SDK_PATHS.sdk, getPlatform());
    var values = fs.readdirSync(sdkPlatformPath);

    for (var i = 0; i < values.length; i++) {
      if (values[i].match(/^toolchain\-/)) {
        return resolve(path.join(sdkPlatformPath, values[i]));
      }
    }
    return reject(new Error('No toolchain found.'));
  });
};

// Checks if CHECKSUM file in our SDK equals our expected checksum.
// This will resolve with checking that the SDK exists and matches the checksum.
module.exports.checkTools = (checksumVerify) => {
  var dir = path.join(SDK_PATHS.sdk, getPlatform());
  return new Promise((resolve) => {
    var checksum = fs.readFileSync(path.join(dir, 'CHECKSUM'), 'utf-8');
    resolve({
      exists: true,
      checked: checksumVerify === checksum,
      path: dir,
    });
  }).catch(() => ({
    exists: false,
    checked: false,
    path: dir,
  }));
};

module.exports.checkRustlib = (rustv, checksumVerify) => {
  var dir = path.join(SDK_PATHS.rustlib, rustv);
  return new Promise((resolve) => {
    var checksum = fs.readFileSync(path.join(dir, 'CHECKSUM'), 'utf-8');
    resolve({
      exists: true,
      checked: checksumVerify === checksum,
      path: dir,
    });
  }).catch(() => ({
    exists: false,
    checked: false,
    path: dir,
  }));
};

module.exports.installTools = () => {
  var pkgname = 'Tessel build tools';
  var url = SDK_URLS[getPlatform()];
  var checksumVerify = null;

  return downloadString(`${url}.sha256`)
    .then((checksum) => {
      checksumVerify = checksum;
      return exports.checkTools(checksumVerify);
    })
    .then((check) => {
      if (check.exists && check.checked) {
        log.info(`Latest ${pkgname} already installed.`);
        return;
      } else if (!check.exists) {
        log.info(`Installing ${pkgname}...`);
      } else {
        log.info(`Updating ${pkgname}...`);
      }

      fs.mkdirpSync(path.join(osenv.home(), '.tessel/sdk'));
      return extractTools(checksumVerify, path.basename(url), download(url));
    });
};

module.exports.installRustlib = () => {
  return exports.rustVersion()
    .then((rustv) => {
      var pkgname = `MIPS libstd v${rustv}`;
      var url = RUST_LIB_TGZ_URL.replace('VERSION', rustv);
      var checksumVerify;

      return downloadString(url + '.sha256')
        .catch(() => Promise.reject(tags.stripIdent `
          Could not find a MIPS libstd matching your current Rust version (${rustv}).`))
        .then(checksum => {
          checksumVerify = checksum;
          return exports.checkRustlib(rustv, checksumVerify);
        })
        .then(check => {
          if (check.exists && check.checked) {
            log.info(`Latest ${pkgname} already installed.`);
            return;
          } else if (!check.exists) {
            log.info(`Installing ${pkgname}...`);
          } else {
            log.info(`Updating ${pkgname}...`);
          }

          fs.mkdirpSync(SDK_PATHS.rustlib);
          return extractRustlib(checksumVerify, path.basename(url), download(url), rustv);
        });
    });
};

function extract(checksumVerify, filename, sdkStream, root, strip, name, decompress) {
  log.info(`Downloading ${name}...`);

  return tmpdir()
    .then(destdir => {
      // Exract tarball to destination.
      var extract = tar.extract(destdir.path, {
        strip: strip,
        ignore: function(name) {
          // Ignore self-directory.
          return path.normalize(name + '/') === path.normalize(destdir.path + '/');
        }
      });

      return new Promise((resolve, reject) => {
        var checksum = '';
        sdkStream
          .pipe(sha256stream())
          .on('sha256', function(sha256) {
            checksum = sha256file(sha256, filename);
          })
          .pipe(decompress)
          // tar-stream has a recursion issue when input chunks are too big.
          // by splitting up the chunks, we never get too deeply nested in the
          // stack.
          .pipe(blocks({
            size: 64 * 1024,
            zeroPadding: false
          }))
          .pipe(extract)
          .on('finish', () => {
            // Check sum.
            if (checksum !== checksumVerify) {
              return reject(tags.stripIndent `
                Please file an issue on https://github.com/tessel/t2-cli with the following:
                The downloaded file ${name} is invalid (wrong checksum).
                  expected: ${checksumVerify}
                  got:      ${checksum}`);
            }

            // Write out CHECKSUM file.
            fs.writeFileSync(path.join(destdir.path, 'CHECKSUM'), checksum);

            try {
              // Remove the old SDK directory.
              fs.removeSync(root);
              // Move temporary directory to target destination.
              fs.move(destdir.path, root, error => {
                if (error) {
                  // Cleanup temp dir.
                  destdir.cleanup();
                  reject(error);
                } else {
                  resolve();
                }
              });
            } catch (error) {
              // Cleanup temp dir.
              destdir.cleanup();
              reject(error);
            }
          })
          .on('error', error => {
            destdir.cleanup();
            reject(error);
          });
      });
    });
}

function extractTools(checksumVerify, filename, sdkStream) {
  var root = path.join(SDK_PATHS.sdk, 'macos');
  return extract(checksumVerify, filename, sdkStream, root, 2, 'Tessel build tools', bz2());
}

function extractRustlib(checksumVerify, filename, sdkStream, rustVersion) {
  var root = path.join(SDK_PATHS.rustlib, rustVersion);
  return extract(checksumVerify, filename, sdkStream, root, 0, 'MIPS libstd', zlib.createGunzip());
}

module.exports.getBuildConfig = () => {
  var config = {
    rustv: null,
    toolchainPath: null,
    stagingDir: null,
    rustlibPath: null,
    name: null,
    path: null,
  };

  return exports.rustVersion()
    .then(rustv => {
      config.rustv = rustv;

      return exports.checkTools();
    })
    .then(check => {
      if (!check.exists) {
        throw new Error('Tessel cross-compilation tools are not installed.');
      }
      config.stagingDir = check.path;

      return exports.checkRustlib(config.rustv);
    })
    .then(check => {
      if (!check.exists) {
        throw new Error(`MIPS libstd v${config.rustv} not installed.`);
      }
      config.rustlibPath = check.path;

      return exports.toolchainPath();
    })
    .then(toolchainPath => {
      config.toolchainPath = toolchainPath;

      return config;
    });
};

// Confirms that the user has a version of rustc and cargo installed. Resolves
// with the current rustc version, rejects if either executable is not found
// on the system.
module.exports.rustVersion = () => {
  // Check that rustc exists and get its version.
  return new Promise((resolve, reject) => {
    var rustc = cp.spawn('rustc', ['-V']);
    var rustcOut = [];
    rustc.stdout.on('data', (data) => {
      rustcOut.push(data);
    });
    rustc.on('error', reject);
    rustc.on('close', (status) => {
      var out = Buffer.concat(rustcOut).toString();
      var matches = out.match(/^rustc\s+(\S+)/);
      if (status !== 0 || !matches) {
        return reject(new Error('Could not find a locally installed version of `rustc`.'));
      }

      var version = matches[1];

      // Check if cargo exists also.
      var cargo = cp.spawn('cargo', ['-V']);
      cargo.on('error', reject);
      cargo.on('close', (status) => {
        if (status !== 0) {
          return reject(new Error('Could not find a locally installed version of `cargo`'));
        }

        resolve(version);
      });
    });
  });
};

// Check the targets of a cargo crate.
module.exports.cargoMetadata = (destdir) => {
  return new Promise((resolve, reject) => {
    var cargo = cp.spawn('cargo', ['metadata', '--no-deps'], {
      stdio: ['ignore', 'pipe', 'inherit'],
      cwd: destdir || process.cwd(),
    });
    var stdout = [];
    cargo.stdout.on('data', (data) => {
      stdout.push(data);
    });
    cargo.on('close', (status) => {
      if (status !== 0) {
        reject(`Could not find a cargo project in ${destdir || 'this directory.'}.`);
      } else {
        resolve(JSON.parse(Buffer.concat(stdout).toString()));
      }
    });
  });
};

module.exports.buildTessel = (config) => {
  var env = Object.assign({}, process.env, {
    STAGING_DIR: config.stagingDir,
    RUST_TARGET_PATH: config.rustlibPath,
    PATH: `${path.join(config.toolchainPath, 'bin')}:${env.PATH}`,
    RUSTFLAGS: `-L ${config.rustlibPath}`,
  });

  return new Promise((resolve, reject) => {
    var cargo = cp.spawn('cargo', ['build', '--target=tessel2', '--bin', config.name, '--release'], {
      env: env,
      pwd: config.path || process.cwd(),
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    cargo.on('error', (error) => {
      reject(error);
    });

    cargo.on('close', (code) => {
      if (code !== 0) {
        reject(`"cargo build" exited with status code ${code}`);
      } else {
        resolve();
      }
    });
  });
};

module.exports.bundleTessel = (config) => {
  return new Promise((resolve) => {
    var tarball = path.join(path.dirname(config.path), 'tessel-bundle.tar');
    tar.pack(path.dirname(config.path), {
        entries: [path.basename(config.path)]
      })
      .pipe(fs.createWriteStream(tarball))
      .on('finish', function() {
        resolve(tarball);
      });
  });
};

module.exports.cargo = {
  install: () => {
    exports.checkRust(false);

    return exports.installTools()
      .then(() => {
        return exports.installRustlib()
          .then(() => {
            log.info('SDK installed.');
          }, e => {
            log.error(e.message);
            log.error('Please switch to using a stable Rust version >= 1.11.0 and try again.');
            log.warn('SDK toolchain is installed, but a libstd for your Rust version is not.');
          });
      });
  },
  uninstall: () => {
    return new Promise((resolve) => {
      fs.remove(path.join(osenv.home(), '.tessel/rust'), () => {
        fs.remove(path.join(osenv.home(), '.tessel/sdk'), () => {
          log.info('Tessel SDK uninstalled.');
          resolve();
        });
      });
    });
  },
};

// Logging function that checks if all rust components are installed.
module.exports.checkSdk = () => {
  return exports.getBuildConfig()
    .catch(error => Promise.reject(tags.stripIndent `
      Could not find all the components for cross-compiling Rust:
      ${error.message}
      Please run "cargo tessel sdk install" and try again.
      To instead use the remote Rust compiler, use "t2 run <target> --rustcc".`));
};

module.exports.checkRust = (isCli) => {
  return exports.rustVersion()
    .catch(() => Promise.reject(tags.stripIndent `
        "rustc" and "cargo" are required to cross-compile for Tessel.
        Please install Rust on your machine: https://rustup.rs/` +
      (isCli ? '\nTo instead use the remote Rust compiler, use "t2 run <target> --rustcc".' : '')
    ));
};

// Logging function that checks if rust is installed, then if the binary matches.
module.exports.checkBinaryName = (isCli, matchBin, destdir) => {
  return exports.cargoMetadata(destdir)
    .then(metadata => {
      return new Promise((resolve, reject) => {
        // Get first package.
        var pkg = metadata.packages.pop();
        var bins = pkg.targets.filter(target => target.kind.indexOf('bin') > -1);

        // Filter by --bin argument.
        var validBins = bins.filter(bin => bin.name === matchBin);

        // Throw if multiple bins exist.
        if (validBins.length === 0) {
          var message;
          if (matchBin === null) {
            message = 'Please specify a valid binary target with --bin.';
          } else {
            message = tags.stripIndent `
              No binary target "${matchBin}" exists for this Rust crate.
              Make sure you specify a valid binary using --bin.`;
          }
          if (bins.length > 0) {
            message += '\nAvailable targets:';
            bins.forEach(bin => {
              if (isCli) {
                message += `\n  t2 run ${bin.name}`;
              } else {
                message += `\n  cargo tessel build --bin ${bin.name}`;
              }
            });
          }
          return reject(message);
        }

        var name = validBins[0].name;
        var dest = path.join(path.dirname(pkg.manifest_path), 'target/tessel2/release', name);

        resolve({
          name,
          path: dest,
        });
      });
    });
};

module.exports.runBuild = (isCli, matchBin, destdir) => {
  return exports.checkRust(isCli)
    .then(() => exports.checkBinaryName(isCli, matchBin, destdir))
    .then(out => {
      return module.exports.checkSdk()
        .then(config => {
          config.name = out.name;
          config.path = out.path;

          return exports.buildTessel(config)
            .then(() => exports.bundleTessel(config));
        });
    });
};
