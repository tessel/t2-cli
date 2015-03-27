module.exports.scanWiFi = function() {
  return 'ubus call iwinfo scan \'{ "device": "wlan0" }\'';
}
module.exports.stopRunningScript = function(filepath) {
  return '/etc/init.d/tessel-app stop; rm -rf ' + filepath;
}
module.exports.prepareScriptPath = function(filepath) {
  return 'mkdir ' + filepath + '/; tar -x -C ' + filepath;
}
module.exports.runScript = function(filepath, relpath) {
  return 'node ' + filepath + relpath;
}
module.exports.runOnBoot = function(filepath) {
  return 'echo "#!/bin/sh\ncd /app\nexec node ." > ' + filepath + '/start && chmod +x "' + filepath + '/start"';
}
module.exports.startPushedScript = function() {
  return '/etc/init.d/tessel-app start';
}
module.exports.getIdentification = function() {
  return 'cat /etc/deviceInfo.json';
}
module.exports.setHostname = function (name) {
  return 'uci set system.@system[0].hostname=' + name + '; uci commit system; echo $(uci get system.@system[0].hostname) > /proc/sys/kernel/hostname';
}
module.exports.appendFile = function (sourceFile, destFile) {
  return 'dd if=' + sourceFile + ' of=' + destFile + ' conv=notrunc oflag=append';
}
