/**
 * Application specific deployment commands
 *
 * Language: *
 *
 */
module.exports.app = {
  // Note: These should be converted to method shorthand
  // once t2-cli moves to Node 6
  stop: () => ['/etc/init.d/tessel-app', 'stop'],
  start: () => ['/etc/init.d/tessel-app', 'start'],
  disable: () => ['/etc/init.d/tessel-app', 'disable'],
  enable: () => ['/etc/init.d/tessel-app', 'enable'],
};

/**
 * Language specific deployment commands
 *
 */
module.exports.js = {
  execute: (filepath, relpath) => ['node', filepath + relpath],
};

module.exports.rs = {
  execute: (filepath, relpath) => [filepath + relpath],
};

module.exports.py = {
  execute: (filepath, relpath) => ['python', filepath + relpath],
};

module.exports.readFile = function(filepath) {
  return ['cat', filepath];
};
module.exports.scanWiFi = function() {
  return ['iwinfo', 'wlan0', 'scan'];
};
module.exports.getWifiInfo = function() {
  return ['ubus', 'call', 'iwinfo', 'info', '{"device":"wlan0"}'];
};
module.exports.getIPAddress = function() {
  return ['ifconfig', 'wlan0'];
};
module.exports.deleteFolder = function(filepath) {
  return ['rm', '-rf', filepath];
};
module.exports.createFolder = function(filepath) {
  return ['mkdir', '-p', filepath];
};
module.exports.moveFolder = function(source, destination) {
  return ['mv', source, destination];
};
module.exports.untarStdin = function(filepath) {
  return ['tar', '-x', '-C', filepath];
};
module.exports.openStdinToFile = function(filepath) {
  return ['dd', 'of=' + filepath];
};
module.exports.appendStdinToFile = function(filepath) {
  return ['tee', '-a', filepath];
};
module.exports.chmod = function(permission, filepath) {
  return ['chmod', permission, filepath];
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
  return ['uci', 'set', 'wireless.@wifi-iface[0].disabled=' + Number(enabled ? 0 : 1).toString()];
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
module.exports.sysupgradeNoSaveConfig = function(path) {
  return ['sysupgrade', '-n', path];
};
module.exports.getMemoryInfo = function() {
  return ['cat', '/proc/meminfo'];
};
module.exports.ubusListen = function() {
  return ['ubus', 'listen'];
};
module.exports.setLanNetwork = function() {
  return ['uci', 'set', 'network.lan=interface'];
};
module.exports.setLanNetworkIfname = function() {
  return ['uci', 'set', 'network.lan.ifname=wlan0'];
};
module.exports.setLanNetworkProto = function() {
  return ['uci', 'set', 'network.lan.proto=static'];
};
module.exports.setLanNetworkIP = function() {
  return ['uci', 'set', 'network.lan.ipaddr=192.168.1.101'];
};
module.exports.setLanNetworkNetmask = function() {
  return ['uci', 'set', 'network.lan.netmask=255.255.255.0'];
};
module.exports.commitNetwork = function() {
  return ['uci', 'commit', 'network'];
};
module.exports.getAccessPoint = function() {
  return ['uci', 'get', 'wireless.@wifi-iface[1]'];
};
module.exports.getAccessPointSSID = function() {
  return ['uci', 'get', 'wireless.@wifi-iface[1].ssid'];
};
module.exports.setAccessPoint = function() {
  return ['uci', 'add', 'wireless', 'wifi-iface'];
};
module.exports.setAccessPointDevice = function() {
  return ['uci', 'set', 'wireless.@wifi-iface[1].device=radio0'];
};
module.exports.setAccessPointNetwork = function() {
  return ['uci', 'set', 'wireless.@wifi-iface[1].network=lan'];
};
module.exports.setAccessPointMode = function() {
  return ['uci', 'set', 'wireless.@wifi-iface[1].mode=ap'];
};
module.exports.setAccessPointSSID = function(ssid) {
  return ['uci', 'set', 'wireless.@wifi-iface[1].ssid=' + ssid];
};
module.exports.setAccessPointPassword = function(password) {
  return ['uci', 'set', 'wireless.@wifi-iface[1].key=' + password];
};
module.exports.setAccessPointSecurity = function(security) {
  return ['uci', 'set', 'wireless.@wifi-iface[1].encryption=' + security];
};
module.exports.turnAccessPointOn = function() {
  return ['uci', 'set', 'wireless.@wifi-iface[1].disabled=0'];
};
module.exports.turnAccessPointOff = function() {
  return ['uci', 'set', 'wireless.@wifi-iface[1].disabled=1'];
};
module.exports.getAccessPointConfig = function() {
  return ['uci', 'show', 'wireless.@wifi-iface[1]'];
};
module.exports.getAccessPointIP = function() {
  return ['uci', 'get', 'network.lan.ipaddr'];
};
module.exports.reconnectDnsmasq = function() {
  return ['/etc/init.d/dnsmasq', 'restart'];
};
module.exports.reconnectDhcp = function() {
  return ['/etc/init.d/odhcpd', 'restart'];
};
