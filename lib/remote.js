var dns = require('dns');

const remote = {
  CRASH_REPORTER_HOSTNAME: 'crash-reporter.tessel.io',
  BUILDS_HOSTNAME: 'builds.tessel.io',
  PACKAGES_HOSTNAME: 'packages.tessel.io',
  RUSTCC_HOSTNAME: 'rustcc.tessel.io',

  ifReachable(url) {
    return new Promise((resolve, reject) => {
      dns.lookup(url, error => {
        if (error) {
          reject(new Error('This operation requires an internet connection'));
        } else {
          resolve();
        }
      });
    });
  },
};



module.exports = remote;
