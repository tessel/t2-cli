// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var Tessel = require('./tessel');

/*
 Reboots Tessel
 */
Tessel.prototype.reboot = function() {
  return new Promise((resolve,reject) => {
    return this.simpleExec(commands.reboot()).then(resolve).catch(reject);
  });
};