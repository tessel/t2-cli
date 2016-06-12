// System Objects
var util = require('util');

// Third Party Dependencies
var charSpinner = require('char-spinner');
var npmlog = require('npmlog');

// "    ..."
// No text prefix displayed.
// Use for lists of things.
npmlog.addLevel('basic', 1000, {
  fg: 'white'
}, '');

// "TRACE ..."
//
// Default: OFF
//
// Currently unused, but reserved for more noisy
// debugging logs/output.
// npmlog.addLevel('trace', 2000, { fg: 'grey' }, 'TRACE');

// "INFO ..."
// use to display information that describes
// the process being executed or any useful output that
// the end developer may benefit from knowing.
npmlog.addLevel('info', 2000, {
  fg: 'grey'
}, 'INFO');
// npmlog.style.info = { fg: 'grey' };

// "HTTP ..."
// Currently unused, but should be used to indicate
// any HTTP requests being made on behalf of the CLI
npmlog.addLevel('http', 4000, {
  fg: 'grey'
}, 'HTTP');
//
// "WARN ..."
// Indicates potentially harmful situations
//
// Uses Defaults
//
// "ERR! ..."
// Indicates failure
//
// Uses Defaults
//


npmlog.level = 'basic';

// Internal
var disabled = false;
var flags = {
  spinner: true,
  basic: true,
  info: true,
  http: true,
  warn: true,
  error: true,
  trace: false,
};

var logstream = process.stderr;

var spinner = {
  interval: null,
  start() {
    // When there is an active spinner, or spinners are
    // disabled, return immediately.
    if (this.interval || disabled || exports.isDisabled('spinner')) {
      return;
    }

    this.interval = charSpinner({
      cleanup: true,
      stream: logstream,
      tty: false,
    });
  },
  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }
};
// Spinner control interface
exports.spinner = spinner;

// Enable or disable ALL logging.
exports.disable = function() {
  disabled = true;
};
exports.enable = function() {
  disabled = false;
};

// Configure 1 or more log level flags
exports.configure = function(uFlags) {
  if (typeof uFlags !== 'object' || uFlags === null) {
    throw new Error('Invalid log level configuration flags');
  }
  Object.assign(flags, uFlags);
};

// Check if a log level is enabled or disabled
exports.isEnabled = function(flag) {
  return flags[flag] === true;
};
exports.isDisabled = function(flag) {
  return flags[flag] === false;
};

// Logging
exports.warn = function() {
  if (disabled || exports.isDisabled('warn')) {
    return;
  }
  npmlog.warn('', util.format.apply(util, arguments));
};

exports.error = function() {
  if (disabled || exports.isDisabled('error')) {
    return;
  }
  npmlog.error('', util.format.apply(util, arguments));
};

exports.http = function() {
  if (disabled || exports.isDisabled('http')) {
    return;
  }
  npmlog.http('', util.format.apply(util, arguments));
};

exports.info = function() {
  if (disabled || exports.isDisabled('info')) {
    return;
  }
  npmlog.info('', util.format.apply(util, arguments));
};

exports.basic = function() {
  if (disabled || exports.isDisabled('basic')) {
    return;
  }
  npmlog.basic('', util.format.apply(util, arguments));
};


// Currently unused, but will be implemented.
// exports.trace = ...;
