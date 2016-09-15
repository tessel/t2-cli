// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var Tessel = require('./tessel');

/*
  Gathers node version.
*/
Tessel.prototype.fetchNodeProcessVersion = function() {
  return this.simpleExec(['node', '--version'])
    .then(version => {
      // strip the `v` preceding the version
      return version.trim().substring(1);
    });
};

Tessel.prototype.fetchNodeProcessVersions = function() {
  return this.simpleExec(['node', '-p', 'JSON.stringify(process.versions)'])
    .then(versions => JSON.parse(versions.trim()));
};
