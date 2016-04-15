// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var Tessel = require('./tessel');

/*
  Gathers node version.
*/
Tessel.prototype.fetchCurrentNodeVersion = function() {
  return this.simpleExec(['node', '--version'])
    .then(version => {
      // strip the `v` preceding the version
      return version.trim().substring(1);
    });
};
