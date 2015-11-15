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

  var setupAccessPoint = function() {
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


  return self.connection.exec(commands.getAccessPointSSID())
    .then(function(remoteProcess) {


      return self.receive(remoteProcess).then(function() {
        return setupAccessPoint();
      }).catch(function() {

        var setAccessPoint = function() {
          return self.connection.exec(commands.setAccessPoint())
            .then(self.connection.exec.bind(self.connection, commands.setAccessPointDevice()))
            .then(self.connection.exec.bind(self.connection, commands.setAccessPointNetwork()))
            .then(self.connection.exec.bind(self.connection, commands.setAccessPointMode()));
        };

        var setLanNetwork = function() {
          return self.connection.exec(commands.setLanNetwork())
            .then(self.connection.exec.bind(self.connection, commands.setLanNetworkIfname()))
            .then(self.connection.exec.bind(self.connection, commands.setLanNetworkProto()))
            .then(self.connection.exec.bind(self.connection, commands.setLanNetworkIP()))
            .then(self.connection.exec.bind(self.connection, commands.setLanNetworkNetmask()));
        };

        var commitNetwork = function() {
          return self.connection.exec(commands.commitNetwork());
        };

        return setAccessPoint()
          .then(setLanNetwork)
          .then(commitNetwork)
          .then(setupAccessPoint);
      });
    });
};
