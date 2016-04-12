// System Objects
var util = require('util');

// Third Party Dependencies
var log = require('npmlog');

// "    ..."
// No text prefix displayed.
// Use for lists of things.
log.addLevel('basic', 1000, {
  fg: 'white'
}, '');
// log.disp.basic = '';

log.basic('?');

// "TRACE ..."
//
// Default: OFF
//
// Currently unused, but reserved for more noisy
// debugging logs/output.
// log.addLevel('trace', 2000, { fg: 'grey' }, 'TRACE');

// "INFO ..."
// use to display information that describes
// the process being executed or any useful output that
// the end developer may benefit from knowing.
log.addLevel('info', 2000, {
  fg: 'grey'
}, 'INFO');
// log.style.info = { fg: 'grey' };

// "HTTP ..."
// Currently unused, but should be used to indicate
// any HTTP requests being made on behalf of the CLI
// log.addLevel('http', 4000, { fg: 'grey' }, 'HTTP');
log.style.http = {
  fg: 'grey'
};
//
// "WARN ..."
// Indicates potentially harmful situations
//
// "ERR! ..."
// Indicates failure


log.level = 'basic';

// Internal
var disabled = false;
var flags = {
  basic: true,
  trace: false,
  info: true,
  http: false,
  warn: true,
  error: true,
};

function disable() {
  disabled = true;
}

function enable() {
  disabled = false;
}

function configure(uFlags) {
  if (typeof uFlags !== 'object' || uFlags === null) {
    throw new Error('Invalid log level configuration flags');
  }
  Object.assign(flags, uFlags);
}

function isEnabled(flag) {
  return flags[flag] === true;
}

function isDisabled(flag) {
  return flags[flag] === false;
}

function warn() {
  if (disabled || isDisabled('warn')) {
    return;
  }
  log.warn('', util.format.apply(util, arguments));
}

function error() {
  if (disabled || isDisabled('error')) {
    return;
  }
  log.error('', util.format.apply(util, arguments));
}

function info() {
  if (disabled || isDisabled('info')) {
    return;
  }
  log.info('', util.format.apply(util, arguments));
}

function basic() {
  if (disabled || isDisabled('basic')) {
    return;
  }
  log.basic('', util.format.apply(util, arguments));
}

// Enable or disable ALL logging
exports.disable = disable;
exports.enable = enable;

// Check if a log level is enabled or disabled
exports.isEnabled = isEnabled;
exports.isDisabled = isDisabled;

// Configure 1 or more log level flags
exports.configure = configure;

// Logging API
exports.basic = basic;
exports.info = info;
exports.warn = warn;
exports.error = error;
// exports.http = http;
