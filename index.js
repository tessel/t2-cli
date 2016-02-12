// The controller is used for standard Tessel commands
// like Tessel.get, Tessel.list, Tessel.deploy, etc.
module.exports = require('./lib/controller');
// Commands give deeper access to all the standard shell commands
// that we run to execute larger sequences
module.exports.commands = require('./lib/tessel/commands');
// Exporting Tessel allows consumers to compose their own
// functions onto the prototype
module.exports.Tessel = require('./lib/tessel/tessel');
// The seeker allows consumers to have a long running discovery
// process and take action as Tessels are connected/disconnected
module.exports.discovery = require('./lib/discover').TesselSeeker;
// The USBConnection libray lets consumers turn arbitrary USB devices
// into USBConnection objects to be used in Tessel creation.
module.exports.USBConnection = require('./lib/usb_connection').USB.Connection;
// The LANConnection libray lets consumers turn arbitrary LAN devices
// into LANConnection objects to be used in Tessel creation.
module.exports.LANConnection = require('./lib/lan_connection');
