'use strict';

// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['commands.app'] = {

  stop(test) {
    test.expect(1);
    test.deepEqual(commands.app.stop(), ['/etc/init.d/tessel-app', 'stop']);
    test.done();
  },
  start(test) {
    test.expect(1);
    test.deepEqual(commands.app.start(), ['/etc/init.d/tessel-app', 'start']);
    test.done();
  },
  disable(test) {
    test.expect(1);
    test.deepEqual(commands.app.disable(), ['/etc/init.d/tessel-app', 'disable']);
    test.done();
  },
  enable(test) {
    test.expect(1);
    test.deepEqual(commands.app.enable(), ['/etc/init.d/tessel-app', 'enable']);
    test.done();
  },
};

exports['commands.*.execute(...) (* = lang)'] = {

  js(test) {
    test.expect(6);

    let noOptions = commands.js.execute('/rootpath/', 'relpath');
    let noExtraArgs = commands.js.execute('/rootpath/', 'relpath', {});
    let noBinArgs = commands.js.execute('/rootpath/', 'relpath', {
      subargs: []
    });
    let noSubArgs = commands.js.execute('/rootpath/', 'relpath', {
      binopts: []
    });
    let emptyExtraArgs = commands.js.execute('/rootpath/', 'relpath', {
      binopts: [],
      subargs: []
    });
    let extraArgs = commands.js.execute('/rootpath/', 'relpath', {
      binopts: ['--harmony'],
      subargs: ['--foo']
    });

    test.deepEqual(noOptions, ['node', '/rootpath/relpath']);
    test.deepEqual(noExtraArgs, ['node', '/rootpath/relpath']);
    test.deepEqual(noBinArgs, ['node', '/rootpath/relpath']);
    test.deepEqual(noSubArgs, ['node', '/rootpath/relpath']);
    test.deepEqual(emptyExtraArgs, ['node', '/rootpath/relpath']);
    test.deepEqual(extraArgs, ['node', '--harmony', '/rootpath/relpath', '--foo']);
    test.done();
  },
  rs(test) {
    test.expect(4);

    let noOptions = commands.rs.execute('/rootpath/', 'relpath');
    let noExtraArgs = commands.rs.execute('/rootpath/', 'relpath', {});
    let emptyExtraArgs = commands.rs.execute('/rootpath/', 'relpath', {
      subargs: []
    });
    let extraArgs = commands.rs.execute('/rootpath/', 'relpath', {
      subargs: ['--foo']
    });

    test.deepEqual(noOptions, ['/rootpath/relpath']);
    test.deepEqual(noExtraArgs, ['/rootpath/relpath']);
    test.deepEqual(emptyExtraArgs, ['/rootpath/relpath']);
    test.deepEqual(extraArgs, ['/rootpath/relpath', '--foo']);
    test.done();
  },
  py(test) {
    test.expect(6);

    let noOptions = commands.py.execute('/rootpath/', 'relpath');
    let noExtraArgs = commands.py.execute('/rootpath/', 'relpath', {});
    let noBinArgs = commands.py.execute('/rootpath/', 'relpath', {
      subargs: []
    });
    let noSubArgs = commands.py.execute('/rootpath/', 'relpath', {
      binopts: []
    });
    let emptyExtraArgs = commands.py.execute('/rootpath/', 'relpath', {
      binopts: [],
      subargs: []
    });
    let extraArgs = commands.py.execute('/rootpath/', 'relpath', {
      binopts: ['-R'],
      subargs: ['--foo']
    });

    test.deepEqual(noOptions, ['python', '/rootpath/relpath']);
    test.deepEqual(noExtraArgs, ['python', '/rootpath/relpath']);
    test.deepEqual(noBinArgs, ['python', '/rootpath/relpath']);
    test.deepEqual(noSubArgs, ['python', '/rootpath/relpath']);
    test.deepEqual(emptyExtraArgs, ['python', '/rootpath/relpath']);
    test.deepEqual(extraArgs, ['python', '-R', '/rootpath/relpath', '--foo']);
    test.done();
  },
};


exports['commands.*'] = {

  scanWiFi(test) {
    test.expect(1);
    test.deepEqual(commands.scanWiFi(), ['iwinfo', 'wlan0', 'scan']);
    test.done();
  },
  getWifiInfo(test) {
    test.expect(1);
    test.deepEqual(commands.getWifiInfo(), ['ubus', 'call', 'iwinfo', 'info', '{"device":"wlan0"}']);
    test.done();
  },
  getIPAddress(test) {
    test.expect(1);
    test.deepEqual(commands.getIPAddress(), ['ifconfig', 'wlan0']);
    test.done();
  },
  connectedNetworkStatus(test) {
    test.expect(1);
    test.deepEqual(commands.connectedNetworkStatus(), ['ubus', 'call', 'network.interface.lan', 'status']);
    test.done();
  },
  commitWirelessCredentials(test) {
    test.expect(1);
    test.deepEqual(commands.commitWirelessCredentials(), ['uci', 'commit', 'wireless']);
    test.done();
  },
  reconnectWifi(test) {
    test.expect(1);
    test.deepEqual(commands.reconnectWifi(), ['wifi']);
    test.done();
  },
  getHostname(test) {
    test.expect(1);
    test.deepEqual(commands.getHostname(), ['uci', 'get', 'system.@system[0].hostname']);
    test.done();
  },
  commitHostname(test) {
    test.expect(1);
    test.deepEqual(commands.commitHostname(), ['uci', 'commit', 'system']);
    test.done();
  },
  getMemoryInfo(test) {
    test.expect(1);
    test.deepEqual(commands.getMemoryInfo(), ['cat', '/proc/meminfo']);
    test.done();
  },
  ubusListen(test) {
    test.expect(1);
    test.deepEqual(commands.ubusListen(), ['ubus', 'listen']);
    test.done();
  },
  setLanNetwork(test) {
    test.expect(1);
    test.deepEqual(commands.setLanNetwork(), ['uci', 'set', 'network.lan=interface']);
    test.done();
  },
  setLanNetworkIfname(test) {
    test.expect(1);
    test.deepEqual(commands.setLanNetworkIfname(), ['uci', 'set', 'network.lan.ifname=wlan0']);
    test.done();
  },
  setLanNetworkProto(test) {
    test.expect(1);
    test.deepEqual(commands.setLanNetworkProto(), ['uci', 'set', 'network.lan.proto=static']);
    test.done();
  },
  setLanNetworkIP(test) {
    test.expect(1);
    test.deepEqual(commands.setLanNetworkIP(), ['uci', 'set', 'network.lan.ipaddr=192.168.1.101']);
    test.done();
  },
  setLanNetworkNetmask(test) {
    test.expect(1);
    test.deepEqual(commands.setLanNetworkNetmask(), ['uci', 'set', 'network.lan.netmask=255.255.255.0']);
    test.done();
  },
  commitNetwork(test) {
    test.expect(1);
    test.deepEqual(commands.commitNetwork(), ['uci', 'commit', 'network']);
    test.done();
  },
  getAccessPoint(test) {
    test.expect(1);
    test.deepEqual(commands.getAccessPoint(), ['uci', 'get', 'wireless.@wifi-iface[1]']);
    test.done();
  },
  getAccessPointSSID(test) {
    test.expect(1);
    test.deepEqual(commands.getAccessPointSSID(), ['uci', 'get', 'wireless.@wifi-iface[1].ssid']);
    test.done();
  },
  setAccessPoint(test) {
    test.expect(1);
    test.deepEqual(commands.setAccessPoint(), ['uci', 'add', 'wireless', 'wifi-iface']);
    test.done();
  },
  setAccessPointDevice(test) {
    test.expect(1);
    test.deepEqual(commands.setAccessPointDevice(), ['uci', 'set', 'wireless.@wifi-iface[1].device=radio0']);
    test.done();
  },
  setAccessPointNetwork(test) {
    test.expect(1);
    test.deepEqual(commands.setAccessPointNetwork(), ['uci', 'set', 'wireless.@wifi-iface[1].network=lan']);
    test.done();
  },
  setAccessPointMode(test) {
    test.expect(1);
    test.deepEqual(commands.setAccessPointMode(), ['uci', 'set', 'wireless.@wifi-iface[1].mode=ap']);
    test.done();
  },
  turnAccessPointOn(test) {
    test.expect(1);
    test.deepEqual(commands.turnAccessPointOn(), ['uci', 'set', 'wireless.@wifi-iface[1].disabled=0']);
    test.done();
  },
  turnAccessPointOff(test) {
    test.expect(1);
    test.deepEqual(commands.turnAccessPointOff(), ['uci', 'set', 'wireless.@wifi-iface[1].disabled=1']);
    test.done();
  },
  turnRadioOn(test) {
    test.expect(1);
    test.deepEqual(commands.turnRadioOn(), ['uci', 'set', 'wireless.radio0.disabled=0']);
    test.done();
  },
  getAccessPointConfig(test) {
    test.expect(1);
    test.deepEqual(commands.getAccessPointConfig(), ['uci', 'show', 'wireless.@wifi-iface[1]']);
    test.done();
  },
  getAccessPointIP(test) {
    test.expect(1);
    test.deepEqual(commands.getAccessPointIP(), ['uci', 'get', 'network.lan.ipaddr']);
    test.done();
  },
  reconnectDnsmasq(test) {
    test.expect(1);
    test.deepEqual(commands.reconnectDnsmasq(), ['/etc/init.d/dnsmasq', 'restart']);
    test.done();
  },
  reconnectDhcp(test) {
    test.expect(1);
    test.deepEqual(commands.reconnectDhcp(), ['/etc/init.d/odhcpd', 'restart']);
    test.done();
  },
  reboot(test) {
    test.expect(1);
    test.deepEqual(commands.reboot(), ['sh', '-c', 'echo 39 > /sys/class/gpio/export && echo out > /sys/class/gpio/gpio39/direction && echo 0 > /sys/class/gpio/gpio39/value && reboot']);
    test.done();
  },
  readFile(test) {
    test.expect(1);
    test.deepEqual(commands.readFile('filepath'), ['cat', 'filepath']);
    test.done();
  },
  deleteFolder(test) {
    test.expect(1);
    test.deepEqual(commands.deleteFolder('filepath'), ['rm', '-rf', 'filepath']);
    test.done();
  },
  createFolder(test) {
    test.expect(1);
    test.deepEqual(commands.createFolder('filepath'), ['mkdir', '-p', 'filepath']);
    test.done();
  },
  moveFolder(test) {
    test.expect(1);
    test.deepEqual(commands.moveFolder('source', 'destination'), ['mv', 'source', 'destination']);
    test.done();
  },
  untarStdin(test) {
    test.expect(1);
    test.deepEqual(commands.untarStdin('filepath'), ['tar', '-x', '-C', 'filepath']);
    test.done();
  },
  openStdinToFile(test) {
    test.expect(1);
    test.deepEqual(commands.openStdinToFile('filepath'), ['dd', 'of=filepath']);
    test.done();
  },
  appendStdinToFile(test) {
    test.expect(1);
    test.deepEqual(commands.appendStdinToFile('filepath'), ['tee', '-a', 'filepath']);
    test.done();
  },
  chmod(test) {
    test.expect(1);
    test.deepEqual(commands.chmod('+x', 'filepath'), ['chmod', '+x', 'filepath']);
    test.done();
  },
  setNetworkSSID(test) {
    test.expect(1);
    test.deepEqual(commands.setNetworkSSID('ssid'), ['uci', 'set', 'wireless.@wifi-iface[0].ssid=ssid']);
    test.done();
  },
  setNetworkPassword(test) {
    test.expect(1);
    test.deepEqual(commands.setNetworkPassword('key'), ['uci', 'set', 'wireless.@wifi-iface[0].key=key']);
    test.done();
  },
  setNetworkEncryption(test) {
    test.expect(1);
    test.deepEqual(commands.setNetworkEncryption('encryption'), ['uci', 'set', 'wireless.@wifi-iface[0].encryption=encryption']);
    test.done();
  },
  turnOnWifi(test) {
    test.expect(2);
    test.deepEqual(commands.turnOnWifi(0), ['uci', 'set', 'wireless.@wifi-iface[0].disabled=1']);
    test.deepEqual(commands.turnOnWifi(1), ['uci', 'set', 'wireless.@wifi-iface[0].disabled=0']);
    test.done();
  },
  ensureFileExists(test) {
    test.expect(1);
    test.deepEqual(commands.ensureFileExists('filepath'), ['touch', 'filepath']);
    test.done();
  },
  setHostname(test) {
    test.expect(1);
    test.deepEqual(commands.setHostname('hostname'), ['uci', 'set', 'system.@system[0].hostname=hostname']);
    test.done();
  },
  getInterface(test) {
    test.expect(1);
    test.deepEqual(commands.getInterface('interfaceName'), ['ifconfig', 'interfaceName']);
    test.done();
  },
  callMDNSDaemon(test) {
    test.expect(1);
    test.deepEqual(commands.callMDNSDaemon('action'), ['/etc/init.d/mdnsd', 'action']);
    test.done();
  },
  callTesselMDNS(test) {
    test.expect(1);
    test.deepEqual(commands.callTesselMDNS('action'), ['/etc/init.d/tessel-mdns', 'action']);
    test.done();
  },
  sysupgrade(test) {
    test.expect(1);
    test.deepEqual(commands.sysupgrade('path'), ['sysupgrade', 'path']);
    test.done();
  },
  sysupgradeNoSaveConfig(test) {
    test.deepEqual(commands.sysupgradeNoSaveConfig('path'), ['sysupgrade', '-n', 'path']);
    test.done();
  },
  setAccessPointSSID(test) {
    test.expect(1);
    test.deepEqual(commands.setAccessPointSSID('ssid'), ['uci', 'set', 'wireless.@wifi-iface[1].ssid=ssid']);
    test.done();
  },
  setAccessPointPassword(test) {
    test.expect(1);
    test.deepEqual(commands.setAccessPointPassword('password'), ['uci', 'set', 'wireless.@wifi-iface[1].key=password']);
    test.done();
  },
  setAccessPointSecurity(test) {
    test.expect(1);
    test.deepEqual(commands.setAccessPointSecurity('security'), ['uci', 'set', 'wireless.@wifi-iface[1].encryption=security']);
    test.done();
  },
};
