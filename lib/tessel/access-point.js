var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

function commitAndClose(self, resolve) {
  var waitForClose = function(remoteProcess) {
    return new Promise(function(resolve) {
      remoteProcess.once('close', resolve);
    });
  };

  var reconnectWifi = function() {
    return self.connection.exec(commands.reconnectWifi());
  };

  var reconnectDnsmasq = function() {
    return self.connection.exec(commands.reconnectDnsmasq());
  };

  var reconnectDhcp = function() {
    return self.connection.exec(commands.reconnectDhcp());
  };

  var cleanup = function(remoteProcess) {
    return self.receive(remoteProcess).then(function() {
      logs.info('Access Point credentials set!');
      return self.connection.end();
    });
  };

  return self.connection.exec(commands.commitWirelessCredentials())
    .then(waitForClose)
    .then(reconnectWifi)
    .then(reconnectDnsmasq)
    .then(reconnectDhcp)
    .then(cleanup)
    .then(resolve);
}

Tessel.prototype.enableAccessPoint = function() {
  var self = this;

  return new Promise(function(resolve) {
    return self.connection.exec(commands.turnAccessPointOn())
      .then(function() {
        return commitAndClose(self, resolve);
      });
  });
};

Tessel.prototype.disableAccessPoint = function() {
  var self = this;

  return new Promise(function(resolve) {
    return self.connection.exec(commands.turnAccessPointOff())
      .then(function() {
        return commitAndClose(self, resolve);
      });
  });
};

Tessel.prototype.createAccessPoint = function(opts) {
  var self = this;
  var ssid = opts.ssid;
  var password = opts.pass;
  var security = opts.security;

  return new Promise(function(resolve, reject) {
    if (!ssid) {
      return reject(new Error('Invalid credentials. Must set ssid'));
    }

    if (security && !password) {
      return reject(new Error('Invalid credentials. Must set a password with security option'));
    }

    if (password && !security) {
      security = 'psk2';
    }

    if (password && security) {
      logs.info('Setting Access Point with SSID:', ssid, 'and password:', password, 'and security mode:', security);
    } else if (!password && !security) {
      logs.info('Setting Access Point with SSID:', ssid);
    }

    return self.connection.exec(commands.setAccessPointSSID(ssid))
      .then(function() {
        if (password) {
          return self.connection.exec(commands.setAccessPointPassword(password))
            .then(function() {
              if (security) {
                return self.connection.exec(commands.setAccessPointSecurity(security))
                  .then(function() {
                    return self.connection.exec(commands.turnAccessPointOn())
                      .then(commitAndClose.bind(null, self, resolve));
                  });
              } else {
                return self.connection.exec(commands.turnAccessPointOn())
                  .then(commitAndClose.bind(null, self, resolve));
              }
            });
        } else {
          return self.connection.exec(commands.turnAccessPointOn())
            .then(commitAndClose.bind(null, self, resolve));
        }
      });
  });
};
