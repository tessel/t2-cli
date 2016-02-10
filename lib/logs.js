// System Objects
var util = require('util');

// Third Party Dependencies
var colors = require('colors');

// Internal
var disabled = false;

function disable() {
  disabled = true;
}

function enable() {
  disabled = false;
}

function warn() {
  if (!disabled) {
    console.error(colors.yellow('WARN'), util.format.apply(util, arguments));
  }
}

function err() {
  if (!disabled) {
    console.error(colors.red('ERR!'), util.format.apply(util, arguments));
  }
}

function info() {
  if (!disabled) {
    console.error(colors.grey('INFO'), util.format.apply(util, arguments));
  }
}

function basic() {
  if (!disabled) {
    console.log(util.format.apply(util, arguments));
  }
}

exports.warn = warn;
exports.err = err;
exports.info = info;
exports.basic = basic;
exports.disable = disable;
exports.enable = enable;
