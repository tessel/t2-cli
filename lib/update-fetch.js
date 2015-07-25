// TMP
var fs = require('fs');
/*
  Requests a list of available builds from the
  build server. Returns list of build names in
  a Promise.
*/
function fetchBuildList() {
  return new Promise(function(resolve) {
    // TODO
    resolve([{
      version: '1.0.0',
      released: new Date(),
      crc: new Buffer(0)
    }]);
  });
}

/* 
  Accepts a build name and attempts to fetch
  the build images from the server. Returns build contents
  in a Promise
*/
function fetchBuild(buildName) {
  return new Promise(function(resolve) {
    // TODO
    // To appease grunt
    buildName = buildName;
    resolve({
      version: '1.0.0',
      binaries: {
        firmware: fs.readFileSync('./tmp/firmware.bin'),
        openwrt: fs.readFileSync('./tmp/openwrt.bin')
      }
    });
  });
}

module.exports.fetchBuildList = fetchBuildList;
module.exports.fetchBuild = fetchBuild;
