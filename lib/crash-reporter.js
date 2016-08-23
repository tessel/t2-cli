// System Objects
var os = require('os');

// Third Party Dependencies
var request = require('request');
var tags = require('common-tags');

// Internal
var log = require('./log');
var Menu = require('./menu');
var packageJson = require('../package.json');
var Preferences = require('./preferences');

// the value of the crash reporter preference
// the value has to be one of 'on' or 'off'
var CRASH_REPORTER_PREFERENCE = 'crash.reporter.preference';
var CRASH_REPORTER_PROMPT = 'crash.reporter.prompt';
var CRASH_PROMPT_MESSAGE = `\nSubmit Crash Report to help Tessel Developers improve the CLI ?
    If yes(y), subsequent crashes will be submitted automatically.`;

var CRASH_REPORTER_BASE_URL = 'http://crash-reporter.tessel.io';

// override for testing
if (process.env.DEV_MODE === 'true') {
  CRASH_REPORTER_BASE_URL = 'http://localhost:8080';
}

var SUBMIT_CRASH_URL = `${CRASH_REPORTER_BASE_URL}/crashes/submit`;
var rPathEscape = /[|\\{}()[\]^$+*?.]/g;

function escape(p) {
  return p.replace(rPathEscape, '\\$&');
}

var CrashReporter = {};

CrashReporter.off = function() {
  return Preferences.write(CRASH_REPORTER_PREFERENCE, 'off')
    .catch(error => {
      // do nothing
      // do not crash the crash reporter :)
      log.error('Error turning off crash reporter preferences', error);
    });
};

CrashReporter.on = function() {
  return Preferences.write(CRASH_REPORTER_PREFERENCE, 'on')
    .catch(error => {
      // do nothing
      // do not crash the crash reporter :)
      log.error('Error turning on crash reporter preferences', error);
    });
};

CrashReporter.sanitize = function(input) {
  return CrashReporter.sanitize.redactions.reduce((stack, redaction) => redaction(stack), input);
};

CrashReporter.sanitize.redactions = [
  (stack) => {
    var index = __dirname.indexOf('t2-cli');

    if (index !== -1) {
      stack = stack.replace(new RegExp(escape(__dirname.slice(0, index)), 'g'), '');
    }

    return stack;
  },
  (stack) => stack.replace(new RegExp(escape(os.homedir()), 'g'), ''),
];

CrashReporter.prompt = function() {
  return new Promise((resolve) => {
    Preferences.read(CRASH_REPORTER_PROMPT, 'true')
      .then(value => {
        if (value === 'false') {
          // not a first time crash
          resolve(true);
        } else {
          // prompt for info
          var prompt = Menu.prompt({
            prompt: {
              name: 'selected',
              type: 'confirm',
              message: CRASH_PROMPT_MESSAGE
            }
          });
          prompt.then(selection => {
            var selected = selection['selected'];
            if (selected === false) {
              resolve(false);
            } else {
              return Preferences.write(CRASH_REPORTER_PROMPT, 'false')
                .then(() => {
                  resolve(true);
                });
            }
          });
        }
      });
  });
};

CrashReporter.submit = function(report, opts) {
  if (opts === undefined) {
    opts = {};
  }

  const silent = (opts.silent || false);
  // Removes:
  // - The path to node
  // - The path to t2
  const argv = process.argv.slice(2).join(', ');

  return CrashReporter.prompt()
    .then(success => {
      if (success) {
        return Preferences.read(CRASH_REPORTER_PREFERENCE, 'on')
          .then(value => {
            if (value === 'on') {
              var labels = tags.stripIndent `
                ${packageJson.name},
                CLI version: ${packageJson.version},
                Node version: ${process.version},
                OS platform: ${os.platform()},
                OS release: ${os.release()}
              `;

              var stack = CrashReporter.sanitize(report.stack || String(report));

              return CrashReporter.post(labels, stack, argv)
                .then(fingerprint => {
                  if (!silent) {
                    log.info(`Crash Reported: ${CRASH_REPORTER_BASE_URL}/crashes?fingerprint=${fingerprint}`);
                  }
                });
            }
          }).catch(error => {
            // do nothing
            // do not crash the crash reporter :)
            log.error('Error submitting crash report', error, error.stack);
          });
      } else {
        log.info('Did not submit crash report.');
      }
    });
};

CrashReporter.post = function(labels, crash, argv) {
  var f = 'json';
  var url = SUBMIT_CRASH_URL;

  return new Promise((resolve, reject) => {
    request.post({
      url,
      form: {
        argv,
        crash,
        labels,
        f
      }
    }, (error, httpResponse, body) => {
      try {
        if (error) {
          reject(error);
        } else {
          var json = JSON.parse(body);
          if (json.error) {
            reject(json.error);
          } else {
            resolve(json.crash_report.fingerprint);
          }
        }
      } catch (exception) {
        reject(exception);
      }
    });
  });
};

CrashReporter.status = () => {
  return Preferences.load().then(prefs => {
    log.info(`Crash Reporter is ${prefs[CRASH_REPORTER_PREFERENCE].toUpperCase()}`);
  });
};


CrashReporter.test = () => {
  return Promise.reject(new Error('Testing the crash reporter'));
};

var onError = error => {
  // log the error as sometimes we might be swallowing
  // unhandled remote node exceptions
  log.error('Detected CLI crash', error, error.stack);
  return CrashReporter.submit(error.stack);
};

onError.isCrashHandler = true;

if (!process.env.CI) {
  process.on('unhandledRejection', onError);
  process.on('uncaughtException', onError);
}

module.exports = CrashReporter;
