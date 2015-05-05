var fs = require('fs-extra')
  , osenv = require('osenv')
  , tessel = require('tessel')
  ;

var configFile = osenv.home() + '/.tessel/remote_config.json';

module.exports = function(opts) {
  return new Promise( function (resolve, reject) {
    fs.ensureFile(configFile, function() {
      _arrayInitialized()
      .then(function callMethod() { 
        switch(opts.method) {
          case 'add':
            return addRemote(opts)
                   .then(function() {
                      tessel.logs.info("Remote device added:", opts.host);
                      resolve();
                   })
                   .catch(function(err) {
                      tessel.logs.warn("Unable to add device:", err);
                      resolve();
                   })
          case 'get':
            return getRemote(opts)
                   .then(function(remote) {
                      tessel.logs.info("Remote device:");
                      tessel.logs.info(remote);
                   })
                   .catch(function(err) {
                      tessel.logs.warn("Unable to fetch device:", err);
                   })
          case 'remove':
            return removeRemote(opts)
                   .then(function(success) {
                      tessel.logs.info("Remote device removed:", opts.host);
                      resolve();
                   })
                   .catch(function(err) {
                      tessel.logs.warn("Unable to remote device:", err);
                      resolve();
                   });
        }
      });
    });
  });
}

function addRemote(opts) {
  return new Promise(function(resolve, reject) { 
    // Check if this host has already been added
    __hostExists(opts.host)
    .then(function(exists) {
      // if it does
      if (exists) {
        // Delete it (to keep the config file tidy)
        removeRemote(opts)
        .then(function() {
          // Try adding it again
          addRemote(opts);
          // Finish up
          resolve();
        });
      }
      // There are no duplicate entries
      else {
        fs.readJSON(configFile, function(err, remotes) {

          // Create a new entry
          var entry = {
            host: opts.host,
            port: opts.port,
            keypath: opts.keypath,
            password: opts.password,
            passphrase : opts.passphrase 
          }

          // Add our new entry to the array
          remotes.push(entry);

          // Write it back to the file
          fs.writeJSON(configFile, remotes, resolve);
        });
      }
    });
  });
}

function getRemote(opts) {
  return new Promise(function(resolve, reject) { 
    _getRemoteWithHost(opts.host)
    .then(function(found) {
      if (found.host) {
        return resolve(found.host)
      }
      else {
        return reject(new Error("No remotes set with that hostname"));
      }
    })
  });
}

function removeRemote(opts) {
  return new Promise(function(resolve, reject) { 
    _getRemoteWithHost(opts.host)
    .then( function hostFetched(found) {
      if (!found.host) {
        return reject(new Error("This host has not already been set."));
      }

      fs.readJSON(configFile, function(err, config) {
        if (err) {
          return reject(err);
        }
        else {
          // Remove this element from the array
          config.splice(found.index, 1);

          // Write it to the file
          fs.writeJSON(configFile, config, resolve);
        }
      });
    });
  });
}

function _getRemoteWithHost(host) {
  return new Promise(function(resolve, reject) { 
    fs.readJson(configFile, function(err, remotes) {
      if (err) {
        return reject(err);
      }

      var found = {host: undefined, index: undefined};

      for (var i = 0; i < remotes.length; i++) {
        var remote = remotes[i];
        if (remote.host == host) {
          found.host = remote;
          found.index = i;
          return resolve(found);
        }
      }

      return resolve(found);
    });
  });
}

function _arrayInitialized(callback) {
  return new Promise(function(resolve, reject) {
    fs.readFile(configFile, function(err, buf) {
      if (err) {
        return reject(err);
      }

      if (buf.length == 0) {
        return fs.writeJSON(configFile, [], resolve);
      }

      return resolve();
    });
  });
}

function __hostExists(host, callback) {
  return new Promise(function(resolve, reject) { 
    _getRemoteWithHost(host)
    .then(function gatheredHost(hostFound) {
      if (!hostFound.host) {
        return resolve(false);
      }
      else {
        return resolve(true);
      }
    });
  });
}