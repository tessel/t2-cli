var path = require('path');
var urljoin = require('url-join');
var request = require('request');
var buildServerRoot = 'https://builds.tessel.io/t2';
var firmwareBuildURL = urljoin(buildServerRoot, 'firmware');
var buildsListURL = urljoin(firmwareBuildURL, 'builds.json');
var openWRTBuild = 'openwrt.bin';
var firmwareBuild = 'firmware.bin';
var gunzip = require('zlib').createGunzip();
var extract = require('tar-stream').extract();
var logs = require('./logs');
var streamToBuffer = require('stream-to-buffer');
/*
  Requests a list of available builds from the
  build server. Returns list of build names in
  a Promise.
*/
function fetchBuildList() {
  return new Promise(function(resolve, reject) {
    // Fetch the list of available builds
    request.get(buildsListURL, function(err, response, body) {

       // If there wasn't an issue with the request
      if (requestRespHelper(resolve, reject, err, response)) {
        // Resolve with the parsed data
        try {
          resolve(JSON.parse(body));
        }
        // If the parse failed, reject
        catch(err) {
          reject(err);
        }
      }
    });
  });
}

/* 
  Accepts a build name and attempts to fetch
  the build images from the server. Returns build contents
  in a Promise
*/
function fetchBuild(version) {
  return new Promise(function(resolve, reject) {
    logs.info("Beginning update download. This could take a couple minutes..");
    return fetchSHAForBuildVersion(version)
    .then(function startDownload(sha) {

      var build = {
        firmware : undefined,
        openwrt : undefined,
      };

      // Fetch the list of available builds
      extract.on('entry', function(header, stream, callback) {
        // The buffer to save incoming data to
        // The filename of this entry
        var filename = path.basename(header.name);
        // This entry is the openwrt binary
        if (filename === openWRTBuild) {
          // Save incoming data to the openwrt buffer 
          streamToBuffer(stream, function (err, buffer) {
            build.openwrt = buffer;
            callback();
          });
        }
        // This entry is the firmware binary
        else if (filename === firmwareBuild) {
          // Save incoming data to the firmware buffer
          streamToBuffer(stream, function (err, buffer) {
            build.firmware = buffer;
            callback();
          });
        }
        else {
          callback();  
        }
      });

      extract.once('finish', function() {
        if (!build.firmware.length || !build.openwrt.length) {
          return reject(new Error("Fetched binary wasn't formatted properly."));
        }
        else {
          logs.info("Download complete!");
          return resolve(build);
        }
      });
      // Make a request to our build server for this particular sha
      var req = request.get(urljoin(firmwareBuildURL, sha + '.tar.gz'));
      // unzip and extract the binary tarball
      req.pipe(gunzip).pipe(extract);
    });
  });
}

function requestRespHelper(resolve, reject, err, response) {
  // If there was an error making the request, reject
  if (err) {
    reject(err);
    return false;
  }

  // If there was an issue with the server endpoint, reject
  else if (response.statusCode !== 200) {
    reject(new Error('Invalid status code on build server request: ' + response.statusCode));
    return false;
  }
  // Otherwise
  else {
    return true;
  }
}

function fetchSHAForBuildVersion(version) {
  return new Promise(function(resolve, reject) {
    return fetchBuildList()
    .then(function(builds) {
      // If we are searching for the latest build
      if (version === 'latest') {

        var buildArray = buildDictToSortedArray(builds);

        if (buildArray.length === 0) {
          return reject("No builds were found.");
        }
        
        // The most up to date build should be at the top of the deck
        var current = buildArray[0];

        // Resolve with the sha of that build
        resolve(current.sha);

        return; 
      }

      // We are fetching a specific version
      else {
        // Iterate through all the builds
        for (var build in builds) {
          // If the version on the build matches the provided version
          if (builds[build].version === version) {
            // Return this build sha
            resolve(build);

            return;
          }
        }

        reject(new Error("No build found with that version number. Run `t2 update -l` to see available builds."));
      }
    });
  });
}

function fetchBuildVersionforSHA(sha) {
  return new Promise(function(resolve, reject) {
    // Get the build list
    return fetchBuildList()
    .then(function(builds) {
        // Access the build information for this sha
        var versionInfo = builds[sha];
        // If it doesn't exist, it's an invalid sha
        if (!versionInfo) {
          reject(new Error("No build found matching commit SHA on Tessel 2..."));
        }
        else {
          // Otherwise return the provided info
          resolve(versionInfo.version);
        }
    });
  });
}

function buildDictToSortedArray(builds) {
  var buildArray = [];
  var i = 0;
  // Turn the dict of builds into an array so we can sort it
  for (var build in builds) {
    // Save the SHA in the dict so we can easily find it later
    builds[build].sha = build;
    // Save this object to the array
    buildArray[i++] = builds[build];
  }

  // Sort the builds by version (newest first)
  buildArray.sort(function(a, b) {
    if (a.version < b.version) {
        return 1;
      }
      if (a.version > b.version) {
        return -1;
      }
      return 0;
  });

  return buildArray;
}

module.exports.fetchBuildList = fetchBuildList;
module.exports.fetchBuild = fetchBuild;
module.exports.fetchSHAForBuildVersion = fetchSHAForBuildVersion;
module.exports.fetchBuildVersionforSHA = fetchBuildVersionforSHA;
module.exports.buildDictToSortedArray = buildDictToSortedArray;
