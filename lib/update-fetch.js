// System Objects
var path = require('path');
var fs = require('fs');

// Third Party Dependencies
var gunzip = require('zlib').createGunzip();
var extract = require('tar-stream').extract();
var Progress = require('progress');
var request = require('request');
var streamToBuffer = require('stream-to-buffer');
var urljoin = require('url-join');
var semver = require('semver');

// Internal
var log = require('./log');
var remote = require('./remote');

const BUILD_SERVER_ROOT = `https://${remote.BUILDS_HOSTNAME}/t2`;
const FIRMWARE_PATH = urljoin(BUILD_SERVER_ROOT, 'firmware');
const BUILDS_JSON_FILE = urljoin(FIRMWARE_PATH, 'builds.json');
const OPENWRT_BINARY_FILE = 'openwrt.bin';
const FIRMWARE_BINARY_FILE = 'firmware.bin';

const RESTORE_TGZ_URL = 'https://s3.amazonaws.com/builds.tessel.io/custom/new_build_next.tar.gz';
const RESTORE_UBOOT_FILE = 'openwrt-ramips-mt7620-Default-u-boot.bin';
const RESTORE_SQASHFS_FILE = 'openwrt-ramips-mt7620-tessel-squashfs-sysupgrade.bin';

var exportables = {
  OPENWRT_BINARY_FILE,
  FIRMWARE_BINARY_FILE,
  RESTORE_UBOOT_FILE,
  RESTORE_SQASHFS_FILE,
};

/*
  Requests a list of available builds from the
  build server. Returns list of build names in
  a Promise.
*/
exportables.requestBuildList = function() {
  return new Promise((resolve, reject) => {
    return remote.ifReachable(remote.BUILDS_HOSTNAME).then(() => {
      // Fetch the list of available builds
      request.get(BUILDS_JSON_FILE, (err, response, body) => {
        if (err) {
          return reject(err);
        }

        var outcome = exportables.reviewResponse(response);
        var builds;
        // If there wasn't an issue with the request
        if (outcome.success) {
          // Resolve with the parsed data
          try {
            builds = JSON.parse(body);
          }
          // If the parse failed, reject
          catch (err) {
            reject(err);
          }

          // Sort the builds by semver version in chronological order
          builds.sort((a, b) => semver.compare(a.version, b.version));

          return resolve(builds);
        } else {
          reject(outcome.reason);
        }
      });
    }).catch(reject);
  });
};

exportables.loadLocalBinaries = function(options) {
  var openwrtUpdateLoad = Promise.resolve(new Buffer(0));
  var firmwareUpdateLoad = Promise.resolve(new Buffer(0));

  if (options['openwrt-path']) {
    openwrtUpdateLoad = exportables.loadLocalBinary(options['openwrt-path']);
  }

  if (options['firmware-path']) {
    firmwareUpdateLoad = exportables.loadLocalBinary(options['firmware-path']);
  }

  return Promise.all([openwrtUpdateLoad, firmwareUpdateLoad])
    .then((images) => {
      if (images.length !== 2) {
        return Promise.reject(new Error('Invalid number of binaries loaded.'));
      } else {
        return {
          openwrt: images[0],
          firmware: images[1]
        };
      }
    });
};

// Reads a binary from a local path
exportables.loadLocalBinary = function(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (error, binary) => {
      if (error) {
        return reject(error);
      } else {
        resolve(binary);
      }
    });
  });
};

exportables.fetchRestore = function() {
  return exportables.downloadTgz(RESTORE_TGZ_URL, {
    uboot: RESTORE_UBOOT_FILE,
    squashfs: RESTORE_SQASHFS_FILE
  });
};

/*
  Accepts a build name and attempts to fetch
  the build images from the server. Returns build contents
  in a Promise
*/
exportables.fetchBuild = function(build) {
  return exportables.downloadTgz(urljoin(FIRMWARE_PATH, `${build.sha}.tar.gz`), {
    firmware: FIRMWARE_BINARY_FILE,
    openwrt: OPENWRT_BINARY_FILE
  });
};

exportables.downloadTgz = function(tgzUrl, fileMap) {
  return new Promise((resolve, reject) => {
    log.info('Downloading files...');

    var files = {};

    // Fetch the list of available files
    extract.on('entry', (header, stream, callback) => {
      // The buffer to save incoming data to
      // The filename of this entry
      var tgzFilename = path.basename(header.name);

      for (var key in fileMap) {
        var expectedFilename = fileMap[key];
        if (tgzFilename === expectedFilename) {
          return streamToBuffer(stream, (error, buffer) => {
            files[key] = buffer;
            callback();
          });
        }
      }
      callback();
    });

    extract.once('finish', () => {
      for (var key in files) {
        var file = files[key];
        if (!file.length) {
          return reject(new Error('Fetched file was not formatted properly.'));
        }
      }
      log.info('Download complete!');
      return resolve(files);
    });


    remote.ifReachable(remote.BUILDS_HOSTNAME).then(() => {
      var req = request.get(tgzUrl);

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

        // unzip and extract the binary tarball
        res.pipe(gunzip).pipe(extract);
      });
    }).catch(reject);
  });
};

exportables.reviewResponse = function(response) {
  var outcome = {
    success: true
  };

  // If there was an issue with the server endpoint, reject
  if (response.statusCode !== 200) {
    outcome.success = false;
    outcome.reason = `Invalid status code on build server request: ${response.statusCode}`;
  }

  return outcome;
};

exportables.findBuild = function(builds, property, value) {
  return builds.find(build => build[property] === value);
};


module.exports = exportables;
