var ProgressBar = require('progress');

// USB Process specific wrapper around the `progress` module
function USBProcessProgress(remoteProcess, barTitle, options) {
  this.remoteProcess = remoteProcess;
  this.bar = new ProgressBar(barTitle, options);

  this.remoteProcess.stdin.on('ackStdin', (length) => {
    this.bar.tick(length);
  });
}

module.exports = USBProcessProgress;
