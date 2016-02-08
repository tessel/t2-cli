// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var logs = require('../logs');
var Tessel = require('./tessel');


function commitAndClose(tessel, status, resolve) {

  var reconnectWifi = function() {
    return tessel.simpleExec(commands.reconnectWifi());
  };

  var reconnectDnsmasq = function() {
    return tessel.simpleExec(commands.reconnectDnsmasq());
  };

  var reconnectDhcp = function() {
    return tessel.simpleExec(commands.reconnectDhcp());
  };

  return tessel.simpleExec(commands.commitWirelessCredentials())
    .then(reconnectWifi)
    .then(reconnectDnsmasq)
    .then(reconnectDhcp)
    .then(logs.info.bind(this, status))
    .then(resolve);
}

Tessel.prototype.enableAccessPoint = function() {
  var status = 'Access Point successfully enabled.';

  return new Promise((resolve) => {
    return this.simpleExec(commands.turnAccessPointOn())
      .then(() => {
        return commitAndClose(this, status, resolve);
      });
  });
};

Tessel.prototype.disableAccessPoint = function() {
  var status = 'Access Point successfully disabled.';

  return new Promise((resolve) => {
    return this.simpleExec(commands.turnAccessPointOff())
      .then(() => {
        return commitAndClose(this, status, resolve);
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
      status += ' SSID: ' + ssid + ', password ' + password + ', security mode: ' + security;
    } else if (!password && !security) {
      security = 'none';
      status += ' SSID: ' + ssid;
    }

    var setSSID = function() {
      return self.simpleExec(commands.setAccessPointSSID(ssid));
    };

    var setAccessPointPassword = function() {
      return self.simpleExec(commands.setAccessPointPassword(password));
    };

    var setAccessPointSecurity = function() {
      self.simpleExec(commands.setAccessPointSecurity(security));
    };

    var turnAccessPointOn = function() {
      return self.simpleExec(commands.turnAccessPointOn());
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

  return self.simpleExec(commands.getAccessPointSSID())
    .then(function() {
      // When an AP exists, change the status to
      // reflect an "update" vs. "create":
      status = 'Updated Access Point successfully.';
      return setupAccessPoint();
    })
    .catch(function() {
      var setAccessPoint = function() {
        return self.simpleExec(commands.setAccessPoint())
          .then(self.simpleExec.bind(self, commands.setAccessPointDevice()))
          .then(self.simpleExec.bind(self, commands.setAccessPointNetwork()))
          .then(self.simpleExec.bind(self, commands.setAccessPointMode()));
      };

      var setLanNetwork = function() {
        return self.simpleExec(commands.setLanNetwork())
          .then(self.simpleExec.bind(self, commands.setLanNetworkIfname()))
          .then(self.simpleExec.bind(self, commands.setLanNetworkProto()))
          .then(self.simpleExec.bind(self, commands.setLanNetworkIP()))
          .then(self.simpleExec.bind(self, commands.setLanNetworkNetmask()));
      };

      var commitNetwork = function() {
        return self.simpleExec(commands.commitNetwork());
      };

      return setAccessPoint()
        .then(setLanNetwork)
        .then(commitNetwork)
        .then(setupAccessPoint);
    });
};
