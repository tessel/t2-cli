module.exports.scanWiFi = function() {
  return ['ubus', 'call', 'iwinfo', 'scan', '\'{"device":"wlan0"}\''];
}
module.exports.stopRunningScript = function() {
  return ['/etc/init.d/tessel-app', 'stop'];
}
module.exports.deleteFolder = function(filepath) {
  return ['rm', '-rf', filepath];
}
module.exports.createFolder = function(filepath) {
  return ['mkdir', '-p', filepath];
}
module.exports.untarStdin = function(filepath) {
  return ['tar', '-x', '-C', filepath];
}
module.exports.runScript = function(filepath, relpath) {
  return ['node', filepath + relpath];
}
module.exports.openStdinToFile = function(filepath) {
  return ['dd', 'of=' + filepath];
}
module.exports.setExecutablePermissions = function(filepath) {
  return ['chmod', 'x', filepath];
}
module.exports.startPushedScript = function() {
  return ['/etc/init.d/tessel-app', 'start'];
}
module.exports.connectedNetworkStatus = function() {
  return ['ubus', 'call', 'network.interface.lan', 'status'];
}
module.exports.setNetworkSSID = function(ssid) {
  return ['uci', 'set', 'wireless.@wifi-iface[0].ssid=' + ssid];
}
module.exports.setNetworkPassword = function(password) {
  return ['uci', 'set', 'wireless.@wifi-iface[0].key=' + password];
}
module.exports.commitWirelessCredentials = function() {
  return ['uci', 'commit', 'wireless'];
}
module.exports.reconnectWifi = function() {
  return ['wifi'];
}
module.exports.setHostname = function(hostname) {
  return ['uci', 'set', 'system.@system[0].hostname=' + hostname];
}
module.exports.commitHostname = function() {
  return ['uci', 'commit',
  'system'];
}
