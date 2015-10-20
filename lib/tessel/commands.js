module.exports.readFile = function(filepath) {
  return ['cat', filepath];
};
module.exports.scanWiFi = function() {
  return ['ubus', 'call', 'iwinfo', 'scan', '{"device":"wlan0"}'];
};
module.exports.getWifiInfo = function() {
  return ['ubus', 'call', 'iwinfo', 'info', '{"device":"wlan0"}'];
};
module.exports.getIPAddress = function() {
  return ['ifconfig', 'wlan0'];
};
module.exports.stopRunningScript = function() {
  return ['/etc/init.d/tessel-app', 'stop'];
};
module.exports.disablePushedScript = function() {
  return ['/etc/init.d/tessel-app', 'disable'];
};
module.exports.deleteFolder = function(filepath) {
  return ['rm', '-rf', filepath];
};
module.exports.createFolder = function(filepath) {
  return ['mkdir', '-p', filepath];
};
module.exports.untarStdin = function(filepath) {
  return ['tar', '-x', '-C', filepath];
};
module.exports.runScript = function(filepath, relpath) {
  return ['node', filepath + relpath];
};
module.exports.openStdinToFile = function(filepath) {
  return ['dd', 'of=' + filepath];
};
module.exports.appendStdinToFile = function(filepath) {
  return ['tee', '-a', filepath];
};
module.exports.setExecutablePermissions = function(filepath) {
  return ['chmod', '+x', filepath];
};
module.exports.startPushedScript = function() {
  return ['/etc/init.d/tessel-app', 'start'];
};
module.exports.connectedNetworkStatus = function() {
  return ['ubus', 'call', 'network.interface.lan', 'status'];
};
module.exports.setNetworkSSID = function(ssid) {
  return ['uci', 'set', 'wireless.@wifi-iface[0].ssid=' + ssid];
};
module.exports.setNetworkPassword = function(password) {
  return ['uci', 'set', 'wireless.@wifi-iface[0].key=' + password];
};
module.exports.setNetworkEncryption = function(encryption) {
  return ['uci', 'set', 'wireless.@wifi-iface[0].encryption=' + encryption];
};
module.exports.turnOnWifi = function(enabled) {
  return ['uci', 'set', 'wireless.@wifi-device[0].disabled=' + Number(enabled ? 0 : 1).toString()];
};
module.exports.commitWirelessCredentials = function() {
  return ['uci', 'commit', 'wireless'];
};
module.exports.reconnectWifi = function() {
  return ['wifi'];
};
module.exports.ensureFileExists = function(filepath) {
  return ['touch', filepath];
};
module.exports.getHostname = function() {
  return ['uci', 'get', 'system.@system[0].hostname'];
};
module.exports.setHostname = function(hostname) {
  return ['uci', 'set', 'system.@system[0].hostname=' + hostname];
};
module.exports.commitHostname = function() {
  return ['uci', 'commit', 'system'];
};
module.exports.getInterface = function(interfaceName) {
  return ['ifconfig', interfaceName];
};
module.exports.callMDNSDaemon = function(action) {
  return ['/etc/init.d/mdnsd', action];
};
module.exports.callTesselMDNS = function(action) {
  return ['/etc/init.d/tessel-mdns', action];
};
module.exports.sysupgrade = function(path) {
  return ['sysupgrade', path];
};
module.exports.getMemoryInfo = function() {
  return ['cat', '/proc/meminfo'];
};
