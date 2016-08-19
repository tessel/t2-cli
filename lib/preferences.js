// System Objects
var os = require('os');
var path = require('path');

// Third Party Dependencies
var fs = require('fs-extra');

// Internal
var log = require('./log');

var preferencesJson = path.join(os.homedir(), '.tessel', 'preferences.json');
var Preferences = {};

Preferences.read = function(key, defaultValue) {
  return Preferences.load().then(contents => {
      if (contents) {
        return contents[key] || defaultValue;
      } else {
        return defaultValue;
      }
    })
    .catch(error => {
      log.error('Error reading preference', key, error);
      return defaultValue;
    });
};

Preferences.write = function(key, value) {
  return new Promise((resolve, reject) => {
    Preferences.load()
      .then(contents => {
        contents = contents || {};
        contents[key] = value;
        fs.ensureFile(preferencesJson, error => {
          if (error) {
            log.error('Error writing preference', key, value);
            reject(error);
          } else {
            fs.writeFile(preferencesJson, JSON.stringify(contents), error => {
              if (error) {
                log.error('Error writing preference', key, value);
                reject(error);
              } else {
                resolve();
              }
            });
          }
        });
      })
      .catch(error => {
        reject(error);
      });
  });
};

Preferences.load = function() {
  return new Promise((resolve, reject) => {
    fs.exists(preferencesJson, (exists) => {
      if (exists) {
        fs.readFile(preferencesJson, (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(JSON.parse(data));
          }
        });
      } else {
        // we don't have any local preferences
        // return falsy value
        resolve();
      }
    });
  });
};

module.exports = Preferences;
