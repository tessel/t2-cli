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
  return 'node ' + filepath + '/' + relpath;
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