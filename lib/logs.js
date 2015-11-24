// System Objects
var util = require('util');

// Third Party Dependencies
var colors = require('colors');

// Internal
// ...

function warn() {
  console.error(colors.yellow('WARN'), util.format.apply(util, arguments));
}

function err() {
  console.error(colors.red('ERR!'), util.format.apply(util, arguments));
}

function info() {
  console.error(colors.grey('INFO'), util.format.apply(util, arguments));
}

function basic() {
  console.log(util.format.apply(util, arguments));
}

exports.warn = warn;
exports.err = err;
exports.info = info;
exports.basic = basic;
