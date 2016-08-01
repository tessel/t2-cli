// System Objects
var path = require('path');
var fs = require('fs');

// Third Party Dependencies
var gunzip = require('zlib').createGunzip();
var extract = require('tar-stream').extract();
var ProgressBar = require('progress');
var request = require('request');
var streamToBuffer = require('stream-to-buffer');
var urljoin = require('url-join');
var semver = require('semver');

// Internal
var log = require('./log');

const BUILD_SERVER_ROOT = 'https://builds.tessel.io/t2';
const FIRMWARE_PATH = urljoin(BUILD_SERVER_ROOT, 'firmware');
const BUILDS_JSON_FILE = urljoin(FIRMWARE_PATH, 'builds.json');
const OPENWRT_BINARY_FILE = 'openwrt.bin';
const FIRMWARE_BINARY_FILE = 'firmware.bin';

const RESTORE_TGZ_URL = 'https://s3.amazonaws.com/builds.tessel.io/custom/new_build_next.tar.gz';
const RESTORE_UBOOT_FILE = 'openwrt-ramips-mt7620-Default-u-boot.bin';
const RESTORE_SQASHFS_FILE = 'openwrt-ramips-mt7620-tessel-squashfs-sysupgrade.bin';

/*
  Requests a list of available builds from the
  build server. Returns list of build names in
  a Promise.
*/
function requestBuildList() {
  return new Promise(function(resolve, reject) {
    // Fetch the list of available builds
    request.get(BUILDS_JSON_FILE, function(err, response, body) {
      if (err) {
        return reject(err);
      }

      var outcome = reviewResponse(response);
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
  });
}

function loadLocalBinaries(opts) {
  var openwrtUpdateLoad = Promise.resolve(new Buffer(0));
  var firmwareUpdateLoad = Promise.resolve(new Buffer(0));

  if (opts['openwrt-path']) {
    openwrtUpdateLoad = module.exports.loadLocalBinary(opts['openwrt-path']);
  }

  if (opts['firmware-path']) {
    firmwareUpdateLoad = module.exports.loadLocalBinary(opts['firmware-path']);
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
}

// Reads a binary from a local path
function loadLocalBinary(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, binary) => {
      if (err) {
        return reject(err);
      } else {
        resolve(binary);
      }
    });
  });
}

function fetchRestoreFiles() {
  var fileMap = {
    uboot: RESTORE_UBOOT_FILE,
    squashfs: RESTORE_SQASHFS_FILE
  };
  return downloadTgz(RESTORE_TGZ_URL, fileMap);
}

/*
  Accepts a build name and attempts to fetch
  the build images from the server. Returns build contents
  in a Promise
*/
function fetchBuild(build) {
  var tgzUrl = urljoin(FIRMWARE_PATH, build.sha + '.tar.gz');
  var fileMap = {
    firmware: FIRMWARE_BINARY_FILE,
    openwrt: OPENWRT_BINARY_FILE
  };
  return downloadTgz(tgzUrl, fileMap);
}

function downloadTgz(tgzUrl, fileMap) {
  return new Promise(function(resolve, reject) {
    log.info('Beginning update download. This could take a couple minutes..');

    var files = {};

    // Fetch the list of available files
    extract.on('entry', function(header, stream, callback) {
      // The buffer to save incoming data to
      // The filename of this entry
      var tgzFilename = path.basename(header.name);

      for (var key in fileMap) {
        var expectedFilename = fileMap[key];
        if (tgzFilename === expectedFilename) {
          return streamToBuffer(stream, function(err, buffer) {
            files[key] = buffer;
            callback();
          });
        }
      }
      callback();
    });

    extract.once('finish', function() {
      for (var key in files) {
        var file = files[key];
        if (!file.length) {
          return reject(new Error('Fetched file wasn\'t formatted properly.'));
        }
      }
      log.info('Download complete!');
      return resolve(files);
    });

    var req = request.get(tgzUrl);

    // When we receive the response
    req.on('response', function(res) {

      // Parse out the length of the incoming bundle
      var len = parseInt(res.headers['content-length'], 10);

      // Create a new progress bar
      var bar = new ProgressBar('  Downloading [:bar] :percent :etas remaining', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len
      });

      // When we get incoming data, update the progress bar
      res.on('data', function(chunk) {
        bar.tick(chunk.length);
      });

      // unzip and extract the binary tarball
      res.pipe(gunzip).pipe(extract);
    });
  });
}

function reviewResponse(response) {
  var outcome = {
    success: true
  };

  // If there was an issue with the server endpoint, reject
  if (response.statusCode !== 200) {
    outcome.success = false;
    outcome.reason = 'Invalid status code on build server request: ' + response.statusCode;
  }

  return outcome;
}

function findBuild(builds, property, value) {
  return builds.filter(function(build) {
    return build[property] === value;
  })[0];
}

module.exports.requestBuildList = requestBuildList;
module.exports.fetchBuild = fetchBuild;
module.exports.findBuild = findBuild;
module.exports.loadLocalBinaries = loadLocalBinaries;
module.exports.loadLocalBinary = loadLocalBinary;
module.exports.fetchRestore = fetchRestoreFiles;
module.exports.OPENWRT_BINARY_FILE = OPENWRT_BINARY_FILE;
module.exports.FIRMWARE_BINARY_FILE = FIRMWARE_BINARY_FILE;
