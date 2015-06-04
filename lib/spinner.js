var charSpin = require('char-spinner');

// Gratuitously taken from npm
module.exports.spinner = {
  interval: null,
  start: function() {
    if (this.interval) {
      return;
    }
    this.interval = charSpin({
      stream: process.stdout
    });
  },
  stop: function() {
    clearInterval(this.interval);
    this.interval = null;
  }
};
