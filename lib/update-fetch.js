var path = require('path');
var urljoin = require('url-join');
var request = require('request');
var gunzip = require('zlib').createGunzip();
var extract = require('tar-stream').extract();
var logs = require('./logs');
var streamToBuffer = require('stream-to-buffer');


var buildServerRoot = 'https://builds.tessel.io/t2';
var firmwareBuildURL = urljoin(buildServerRoot, 'firmware');
// THIS IS ONLY HERE FOR DEMONSTRATION, THE URL WILL CHANGE ONCE
// THE BUILD DATA FORMAT IS UPDATED.
var buildsListURL = 'https://dl.dropboxusercontent.com/u/3531958/builds.json';

var openWRTBuild = 'openwrt.bin';
var firmwareBuild = 'firmware.bin';

/*
  Requests a list of available builds from the
  build server. Returns list of build names in
  a Promise.
*/
function requestBuildList() {
  return new Promise(function(resolve, reject) {
    // Fetch the list of available builds
    request.get(buildsListURL, function(err, response, body) {
      if (err) {
        return reject(err);
      }

      var outcome = reviewResponse(response);

      // If there wasn't an issue with the request
      if (outcome.success) {
        // Resolve with the parsed data
        try {
          resolve(JSON.parse(body));
        }
        // If the parse failed, reject
        catch (err) {
          reject(err);
        }
      } else {
        reject(outcome.reason);
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

    var buffers = {
      firmware: undefined,
      openwrt: undefined,
    };

    // Fetch the list of available builds
    extract.on('entry', function(header, stream, callback) {
      // The buffer to save incoming data to
      // The filename of this entry
      var filename = path.basename(header.name);
      // This entry is the openwrt binary
      if (filename === openWRTBuild) {
        // Save incoming data to the openwrt buffer
        streamToBuffer(stream, function(err, buffer) {
          buffers.openwrt = buffer;
          callback();
        });
      }
      // This entry is the firmware binary
      else if (filename === firmwareBuild) {
        // Save incoming data to the firmware buffer
        streamToBuffer(stream, function(err, buffer) {
          buffers.firmware = buffer;
          callback();
        });
      } else {
        callback();
      }
    });

    extract.once('finish', function() {
      if (!buffers.firmware.length || !buffers.openwrt.length) {
        return reject(new Error('Fetched binary wasn\'t formatted properly.'));
      } else {
        logs.info('Download complete!');
        return resolve(buffers);
      }
    });

    // Make a request to our build server for this particular sha
    var req = request.get(urljoin(firmwareBuildURL, build.sha + '.tar.gz'));
    // unzip and extract the binary tarball
    req.pipe(gunzip).pipe(extract);
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
module.exports.openWRTFile = openWRTBuild;
module.exports.firmwareFile = firmwareBuild;
