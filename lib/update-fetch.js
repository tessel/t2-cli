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
var logs = require('./logs');

const BUILD_SERVER_ROOT = 'https://builds.tessel.io/t2';
const FIRMWARE_PATH = urljoin(BUILD_SERVER_ROOT, 'firmware');
const BUILDS_JSON_FILE = urljoin(FIRMWARE_PATH, 'builds.json');
const OPENWRT_BINARY_FILE = 'openwrt.bin';
const FIRMWARE_BINARY_FILE = 'firmware.bin';

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

/*
  Accepts a build name and attempts to fetch
  the build images from the server. Returns build contents
  in a Promise
*/
function fetchBuild(build) {
  return new Promise(function(resolve, reject) {
    logs.info('Beginning update download. This could take a couple minutes..');

    var binaries = {
      firmware: undefined,
      openwrt: undefined,
    };

    // Fetch the list of available builds
    extract.on('entry', function(header, stream, callback) {
      // The buffer to save incoming data to
      // The filename of this entry
      var filename = path.basename(header.name);
      // This entry is the openwrt binary
      if (filename === OPENWRT_BINARY_FILE) {
        // Save incoming data to the openwrt buffer
        streamToBuffer(stream, function(err, buffer) {
          binaries.openwrt = buffer;
          callback();
        });
      }
      // This entry is the firmware binary
      else if (filename === FIRMWARE_BINARY_FILE) {
        // Save incoming data to the firmware buffer
        streamToBuffer(stream, function(err, buffer) {
          binaries.firmware = buffer;
          callback();
        });
      } else {
        callback();
      }
    });

    extract.once('finish', function() {
      if (!binaries.firmware.length || !binaries.openwrt.length) {
        return reject(new Error('Fetched binary wasn\'t formatted properly.'));
      } else {
        logs.info('Download complete!');
        return resolve(binaries);
      }
    });

    // Make a request to our build server for this particular sha
    var req = request.get(urljoin(FIRMWARE_PATH, build.sha + '.tar.gz'));
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
    success: true,
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
module.exports.OPENWRT_BINARY_FILE = OPENWRT_BINARY_FILE;
module.exports.FIRMWARE_BINARY_FILE = FIRMWARE_BINARY_FILE;
