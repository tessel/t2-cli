'use strict';

// System Objects
const util = require('util');

// Third Party Dependencies
const npmlog = require('npmlog');

// "DEBUG ..."
//
// Default: OFF
//
// ALL THE THINGS.
npmlog.addLevel('debug', 1000, {
  fg: 'blue'
}, 'DEBUG');

// "TRACE ..."
//
// Default: OFF
//
// Reserved for more noisy debugging logs/output.
npmlog.addLevel('trace', 2000, {
  fg: 'blue'
}, 'TRACE');

// "    ..."
// No text prefix displayed.
// Use for lists of things.
npmlog.addLevel('basic', 3000, {
  fg: 'white'
}, '');

// "INFO ..."
// use to display information that describes
// the process being executed or any useful output that
// the end developer may benefit from knowing.
npmlog.addLevel('info', 3000, {
  fg: 'grey'
}, 'INFO');

// "HTTP ..."
// Currently unused, but should be used to indicate
// any HTTP requests being made on behalf of the CLI
npmlog.addLevel('http', 4000, {
  fg: 'grey'
}, 'HTTP');

// "WARN ..."
// Indicates potentially harmful situations
//
npmlog.addLevel('warn', 5000, {
  fg: 'black',
  bg: 'yellow'
}, 'WARN');

//
// "ERR! ..."
// Indicates failure
//
npmlog.addLevel('error', 6000, {
  fg: 'red',
  bg: 'black'
}, 'ERR!');

npmlog.level = 'basic';

// Internal
let disabled = false;

const flags = {
  spinner: true,
  debug: true,
  trace: true,
  basic: true,
  info: true,
  http: true,
  warn: true,
  error: true,
};

Object.assign(exports, {
  //
  // Adapted from char-spinner
  //
  charSpinner(options) {
    options = options || {};
    const cleanup = typeof options.cleanup !== 'undefined' ? options.cleanup : true;
    const ms = typeof options.ms !== 'undefined' ? options.ms : 50;
    // '▏▎▍▌▋▊▉█'?
    const sprite = (typeof options.sprite !== 'undefined' ? options.sprite : '-\\|/').split('');
    const stream = typeof options.stream !== 'undefined' ? options.stream : process.stderr;

    const CARRIAGE_RETURN = stream.isTTY ? '\x1B[0G' : '\r';
    const CLEAR = stream.isTTY ? '\x1B[2K' : '\r \r';

    let index = 0;
    let wrote = false;
    let delay = typeof options.delay !== 'undefined' ? options.delay : 2;
    let interval = setInterval(() => {
      if (--delay >= 0) {
        return;
      }
      index = ++index % sprite.length;
      stream.write(`${sprite[index]}${CARRIAGE_RETURN}`);
      wrote = true;
    }, ms);

    /* istanbul ignore else */
    if (cleanup) {
      process.on('exit', () => {
        /* istanbul ignore else */
        if (wrote) {
          stream.write(CLEAR);
        }
      });
    }

    exports.charSpinner.clear = () => {
      stream.write(CLEAR);
      exports.charSpinner.clear = null;
    };

    return interval;
  },
  spinner: {
    interval: null,
    start() {
      // When there is an active spinner, or spinners are
      // disabled, return immediately.
      if (exports.spinner.interval !== null ||
        disabled || exports.isDisabled('spinner')) {
        return;
      }
      exports.spinner.interval = exports.charSpinner();
    },
    stop() {
      if (exports.spinner.interval !== null) {
        clearInterval(exports.spinner.interval);
        exports.spinner.interval = null;
      }

      if (exports.charSpinner.clear) {
        exports.charSpinner.clear();
      }
    },
  },
  // Set a logging level
  level(level) {
    if (level) {
      npmlog.level = level;
    } else {
      return npmlog.level;
    }
  },
  // Enable or disable ALL logging.
  disable() {
    disabled = true;
  },
  enable() {
    disabled = false;
  },
  // Configure logging flags
  configure(uFlags) {
    if (typeof uFlags !== 'object' || uFlags === null) {
      throw new Error('Invalid log level configuration flags');
    }
    Object.assign(flags, uFlags);
  },
  isEnabled(flag) {
    return flags[flag] === true;
  },
  isDisabled(flag) {
    return flags[flag] === false;
  },
});
// Logging
[
  'debug',
  'trace',
  // Default
  'basic',
  'info',
  'http',
  'warn',
  'error',
].forEach(level => {
  // Needs to be a function expression to ensure access
  // to `arguments` object. Once we leave Node.js 4.x.x
  // behind, we can migrate to an arrow with explicit
  // rest `...args`.
  exports[level] = function() {
    if (disabled || exports.isDisabled(level)) {
      return;
    }
    npmlog[level]('', util.format.apply(util, arguments));
  };
});
