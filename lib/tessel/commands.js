'use strict';

function normalizeOptions(options) {
  options = options || {};
  options.binopts = options.binopts || [];
  options.subargs = options.subargs || [];
  return options;
}

function flatten() {
  let args = Array.from(arguments);
  let result = [];
  for (let arg of args) {
    if (Array.isArray(arg)) {
      result = result.concat(flatten.apply(null, arg));
    } else {
      result.push(arg);
    }
  }
  return result;
}

module.exports = {
  /**
   * Application specific deployment commands
   *
   * Language: *
   *
   */
  app: {
    stop() {
      return ['/etc/init.d/tessel-app', 'stop'];
    },
    start() {
      return ['/etc/init.d/tessel-app', 'start'];
    },
    disable() {
      return ['/etc/init.d/tessel-app', 'disable'];
    },
    enable() {
      return ['/etc/init.d/tessel-app', 'enable'];
    },
  },
  /**
   * Language specific deployment commands
   *
   */
  js: {
    execute(rootpath, relpath, options) {
      options = normalizeOptions(options);
      return flatten(['node', options.binopts, rootpath + relpath, options.subargs]);
    },
  },
  rs: {
    execute(rootpath, relpath, options) {
      options = normalizeOptions(options);
      return flatten([rootpath + relpath, options.subargs]);
    },
  },
  py: {
    execute(rootpath, relpath, options) {
      options = normalizeOptions(options);
      return flatten(['python', options.binopts, rootpath + relpath, options.subargs]);
    },
  },
  readFile(filepath) {
    return ['cat', filepath];
  },
  scanWiFi() {
    return ['iwinfo', 'wlan0', 'scan'];
  },
  getWifiInfo() {
    return ['ubus', 'call', 'iwinfo', 'info', '{"device":"wlan0"}'];
  },
  getIPAddress() {
    return ['ifconfig', 'wlan0'];
  },
  deleteFolder(filepath) {
    return ['rm', '-rf', filepath];
  },
  createFolder(filepath) {
    return ['mkdir', '-p', filepath];
  },
  moveFolder(source, destination) {
    return ['mv', source, destination];
  },
  untarStdin(filepath) {
    return ['tar', '-x', '-C', filepath];
  },
  openStdinToFile(filepath) {
    return ['dd', 'of=' + filepath];
  },
  appendStdinToFile(filepath) {
    return ['tee', '-a', filepath];
  },
  chmod(permission, filepath) {
    return ['chmod', permission, filepath];
  },
  connectedNetworkStatus() {
    return ['ubus', 'call', 'network.interface.lan', 'status'];
  },
  setNetworkSSID(ssid) {
    return ['uci', 'set', 'wireless.@wifi-iface[0].ssid=' + ssid];
  },
  setNetworkPassword(password) {
    return ['uci', 'set', 'wireless.@wifi-iface[0].key=' + password];
  },
  setNetworkEncryption(encryption) {
    return ['uci', 'set', 'wireless.@wifi-iface[0].encryption=' + encryption];
  },
  turnOnWifi(enabled) {
    return ['uci', 'set', 'wireless.@wifi-iface[0].disabled=' + Number(enabled ? 0 : 1).toString()];
  },
  commitWirelessCredentials() {
    return ['uci', 'commit', 'wireless'];
  },
  reconnectWifi() {
    return ['wifi'];
  },
  ensureFileExists(filepath) {
    return ['touch', filepath];
  },
  getHostname() {
    return ['uci', 'get', 'system.@system[0].hostname'];
  },
  setHostname(hostname) {
    return ['uci', 'set', 'system.@system[0].hostname=' + hostname];
  },
  commitHostname() {
    return ['uci', 'commit', 'system'];
  },
  getInterface(interfaceName) {
    return ['ifconfig', interfaceName];
  },
  callMDNSDaemon(action) {
    return ['/etc/init.d/mdnsd', action];
  },
  callTesselMDNS(action) {
    return ['/etc/init.d/tessel-mdns', action];
  },
  sysupgrade(path) {
    return ['sysupgrade', path];
  },
  sysupgradeNoSaveConfig(path) {
    return ['sysupgrade', '-n', path];
  },
  getMemoryInfo() {
    return ['cat', '/proc/meminfo'];
  },
  ubusListen() {
    return ['ubus', 'listen'];
  },
  setLanNetwork() {
    return ['uci', 'set', 'network.lan=interface'];
  },
  setLanNetworkIfname() {
    return ['uci', 'set', 'network.lan.ifname=wlan0'];
  },
  setLanNetworkProto() {
    return ['uci', 'set', 'network.lan.proto=static'];
  },
  setLanNetworkIP() {
    return ['uci', 'set', 'network.lan.ipaddr=192.168.1.101'];
  },
  setLanNetworkNetmask() {
    return ['uci', 'set', 'network.lan.netmask=255.255.255.0'];
  },
  commitNetwork() {
    return ['uci', 'commit', 'network'];
  },
  getAccessPoint() {
    return ['uci', 'get', 'wireless.@wifi-iface[1]'];
  },
  getAccessPointSSID() {
    return ['uci', 'get', 'wireless.@wifi-iface[1].ssid'];
  },
  setAccessPoint() {
    return ['uci', 'add', 'wireless', 'wifi-iface'];
  },
  setAccessPointDevice() {
    return ['uci', 'set', 'wireless.@wifi-iface[1].device=radio0'];
  },
  setAccessPointNetwork() {
    return ['uci', 'set', 'wireless.@wifi-iface[1].network=lan'];
  },
  setAccessPointMode() {
    return ['uci', 'set', 'wireless.@wifi-iface[1].mode=ap'];
  },
  setAccessPointSSID(ssid) {
    return ['uci', 'set', 'wireless.@wifi-iface[1].ssid=' + ssid];
  },
  setAccessPointPassword(password) {
    return ['uci', 'set', 'wireless.@wifi-iface[1].key=' + password];
  },
  setAccessPointSecurity(security) {
    return ['uci', 'set', 'wireless.@wifi-iface[1].encryption=' + security];
  },
  turnAccessPointOn() {
    return ['uci', 'set', 'wireless.@wifi-iface[1].disabled=0'];
  },
  turnAccessPointOff() {
    return ['uci', 'set', 'wireless.@wifi-iface[1].disabled=1'];
  },
  turnRadioOn() {
    return ['uci', 'set', 'wireless.radio0.disabled=0'];
  },
  getAccessPointConfig() {
    return ['uci', 'show', 'wireless.@wifi-iface[1]'];
  },
  getAccessPointIP() {
    return ['uci', 'get', 'network.lan.ipaddr'];
  },
  reconnectDnsmasq() {
    return ['/etc/init.d/dnsmasq', 'restart'];
  },
  reconnectDhcp() {
    return ['/etc/init.d/odhcpd', 'restart'];
  },
  /*
   1. Create a GPIO entry for the SAMD21 RESET pin
   2. Make that GPIO an output
   3. Pull the output low to reset the SAMD21 (see NOTE below)
   4. Reboot the MediaTek

   NOTE: To reset the SAMD21, the SAMD21 RESET pin must be toggled low then high. By rebooting the MediaTek,
   SAMD21 RESET pin is set back to a high state thus completing the SAMD21 reset sequence.
   */
  reboot() {
    return ['sh', '-c', 'echo 39 > /sys/class/gpio/export && echo out > /sys/class/gpio/gpio39/direction && echo 0 > /sys/class/gpio/gpio39/value && reboot'];
  },
};
