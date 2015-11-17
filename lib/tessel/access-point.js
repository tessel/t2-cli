var Tessel = require('./tessel'),
  commands = require('./commands'),
  logs = require('../logs');

function commitAndClose(tessel, status, resolve) {
  var waitForClose = function(remoteProcess) {
    return new Promise(function(resolve) {
      remoteProcess.once('close', resolve);
    });
  };

  var reconnectWifi = function() {
    return tessel.connection.exec(commands.reconnectWifi());
  };

  var reconnectDnsmasq = function() {
    return tessel.connection.exec(commands.reconnectDnsmasq());
  };

  var reconnectDhcp = function() {
    return tessel.connection.exec(commands.reconnectDhcp());
  };

  var cleanup = function(remoteProcess) {
    return tessel.receive(remoteProcess).then(function() {
      logs.info(status);
      return tessel.connection.end();
    });
  };

  return tessel.connection.exec(commands.commitWirelessCredentials())
    .then(waitForClose)
    .then(reconnectWifi)
    .then(reconnectDnsmasq)
    .then(reconnectDhcp)
    .then(cleanup)
    .then(resolve);
}

Tessel.prototype.enableAccessPoint = function() {
  var self = this;
  var status = 'Access Point successfully enabled.';

  return new Promise(function(resolve) {
    return self.connection.exec(commands.turnAccessPointOn())
      .then(function() {
        return commitAndClose(self, status, resolve);
      });
  });
};

Tessel.prototype.disableAccessPoint = function() {
  var self = this;
  var status = 'Access Point successfully disabled.';

  return new Promise(function(resolve) {
    return self.connection.exec(commands.turnAccessPointOff())
      .then(function() {
        return commitAndClose(self, status, resolve);
      });
  });
};

Tessel.prototype.createAccessPoint = function(opts) {
  var self = this;
  var ssid = opts.ssid;
  var password = opts.pass;
  var security = opts.security;
  var status = 'Created Access Point successfully.';

  var setupAccessPoint = function() {
    if (password && !security) {
      security = 'psk2';
    }

    if (password && security) {
      status += ` SSID: ${ssid}, password ${password}, security mode: ${security}`;
    } else if (!password && !security) {
      security = 'none';
      status += ` SSID: ${ssid}`;
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
        commitAndClose(self, status, resolve);
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
        // When an AP exists, change the status to
        // reflect an "update" vs. "create":
        status = 'Updated Access Point successfully.';
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
