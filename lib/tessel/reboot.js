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
  return this.simpleExec(commands.reboot());
};