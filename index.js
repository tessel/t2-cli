var controller = require('./lib/controller');
var commands = require('./lib/tessel/commands');
var Tessel = require('./lib/tessel/tessel');

module.exports = controller;
module.exports.commands = commands;
module.exports.Tessel = Tessel;
