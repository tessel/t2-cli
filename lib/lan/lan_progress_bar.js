var ProgressBar = require('progress');
var hookWritableStream = require('hook-writable-stream');

// LAN Process specific wrapper around the `progress` module
function LANProcessProgress(remoteProcess, barTitle, options) {
  this.remoteProcess = remoteProcess;
  this.bar = new ProgressBar(barTitle, options);

  hookWritableStream(remoteProcess.stdin, true, (chunk) => {
    this.bar.tick(chunk.length);
  });
}

module.exports = LANProcessProgress;
