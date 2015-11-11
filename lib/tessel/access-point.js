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
  var securityOptions = ['none', 'wep', 'psk', 'psk2', 'wpa', 'wpa2'];

  if (!ssid) {
    return Promise.reject(new Error('Invalid credentials. Must set ssid'));
  }

  if (security && !password) {
    return Promise.reject(new Error('Invalid credentials. Must set a password with security option'));
  }

  if (security && securityOptions.indexOf(security) < 0) {
    return Promise.reject(new Error(security + ' is not a valid security option. Please choose on of the following: ' + securityOptions.join(', ')));
  }

  if (password && !security) {
    security = 'psk2';
  }

  if (password && security) {
    logs.info('Setting Access Point with SSID:', ssid, 'and password:', password, 'and security mode:', security);
  } else if (!password && !security) {
    security = 'none';
    logs.info('Setting Access Point with SSID:', ssid);
  }

  var setSSID = function() {
    return self.connection.exec(commands.setAccessPointSSID(ssid));
  };

  var setAccessPointPassword = function() {
    return self.connection.exec(commands.setAccessPointPassword(password));
  };

  var setAccessPointSecurity = function() {
    self.connection.exec(commands.setAccessPointSecurity(security));
  };

  var turnAccessPointOn = function() {
    return self.connection.exec(commands.turnAccessPointOn());
  };

  var commitAndClosePromise = function() {
    return new Promise(function(resolve) {
      commitAndClose(self, resolve);
    });
  };

  var setup = function() {
    if (password) {
      return setSSID(ssid)
        .then(setAccessPointPassword)
        .then(setAccessPointSecurity);
    } else {
      return setSSID(ssid)
        .then(setAccessPointSecurity);
    }
  };

  return setup()
    .then(turnAccessPointOn)
    .then(commitAndClosePromise);
};
