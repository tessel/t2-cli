var Tessel = require('./tessel')
  , charSpin = require('char-spinner')
  ;
// Gratuitously taken from npm
Tessel.spinner =
  {
    interval: null
  , started: false
  , start: function () {
      if (Tessel.spinner.interval) return;
      var cleanup = !Tessel.spinner.started;
      Tessel.spinner.interval = charSpin({stream: process.stdout});
      Tessel.spinner.started = true;
    }
  , stop: function () {
      clearInterval(Tessel.spinner.interval);
      Tessel.spinner.interval = null;
    }
  };
