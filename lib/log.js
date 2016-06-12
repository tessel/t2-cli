// System Objects
const util = require('util');

// Third Party Dependencies
const charSpinner = require('char-spinner');
const npmlog = require('npmlog');

// < 1000
//
// "DEBUG ..."
//
// Default: OFF
//
// ALL THE THINGS.
// npmlog.addLevel('debug', 100, { fg: 'blue' }, 'DEBUG');

// "TRACE ..."
//
// Default: OFF
//
// Reserved for more noisy debugging logs/output.
// npmlog.addLevel('trace', 200, { fg: 'blue' }, 'TRACE');

// > 1000

// "    ..."
// No text prefix displayed.
// Use for lists of things.
npmlog.addLevel('basic', 1000, {
  fg: 'white'
}, '');

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
// Uses npmlog Defaults
//
// "ERR! ..."
// Indicates failure
//
// Uses npmlog Defaults
//

npmlog.level = 'basic';

// Internal
var disabled = false;
var logstream = process.stderr;

const flags = {
  spinner: true,
  basic: true,
  info: true,
  http: true,
  warn: true,
  error: true,
  trace: false,
};

const spinner = {
  interval: null,
  start() {
    // When there is an active spinner, or spinners are
    // disabled, return immediately.
    if (this.interval !== null || disabled || exports.isDisabled('spinner')) {
      return;
    }

    this.interval = exports.charSpinner({
      cleanup: true,
      stream: logstream,
      tty: false,
    });
  },
  stop() {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
};

exports.charSpinner = function(options) {
  return charSpinner(options);
};

// Spinner control interface
exports.spinner = spinner;


// Set the logging level
exports.level = function(level) {
  console.log('level?', level);
  if (level) {
    npmlog.level = level;
  } else {
    return npmlog.level;
  }
};


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
[
  'warn',
  'error',
  'http',
  'info',
  'basic',
  'trace',
].forEach(level => {
  exports[level] = function() {
    if (disabled || exports.isDisabled(level)) {
      return;
    }
    npmlog[level]('', util.format.apply(util, arguments));
  };
});
