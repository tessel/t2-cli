var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

function commitAndClose(self, resolve) {
  return self.connection.exec(commands.commitWirelessCredentials())
    .then(function(remoteProcess) {
      remoteProcess.once('close', function() {
        return self.connection.exec(commands.reconnectWifi())
          .then(function(remoteProcess) {
            return self.receive(remoteProcess).then(function() {
              logs.info('Access Point credentials set!');

              return self.connection.end()
                .then(resolve);
            });
          });
      });
    });
}

Tessel.prototype.createAccessPoint = function(opts) {
  var self = this;
  var ssid = opts.ssid;
  var password = opts.pass;
  var security = opts.security;

  return new Promise(function(resolve, reject) {
    if (!ssid) {
      return reject(new Error('Invalid credentials. Must set ssid'));
    }

    if (!password || !security) {
      if (!security) {
        logs.info('Setting Access Point with SSID:', ssid, 'and password:', password, 'and security mode:', security);
      } else {
        logs.info('Setting Access Point with SSID:', ssid, 'and password:', password);
      }
    } else {
      logs.info('Setting Access Point with SSID:', ssid);
    }

    return self.connection.exec(commands.setAccessPointSSID(ssid))
      .then(function() {
        if (password) {
          return self.connection.exec(commands.setAccessPointPassword(password));
        } else {
          return commitAndClose(self, resolve);
        }
      })
      .then(function() {
        if (security) {
          return self.connection.exec(commands.setAccessPointSecurity(security));
        } else {
          return commitAndClose(self, resolve);
        }
      })
      .then(function() {
        return self.connection.exec(commands.turnAccessPointOn(true))
          .then(commitAndClose.bind(null, self, resolve));
      });
  });
};
