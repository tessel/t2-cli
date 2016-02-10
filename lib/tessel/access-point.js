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
    .then((str) => logs.info(status, str))
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
  var ssid = opts.ssid;
  var password = opts.pass;
  var security = opts.security;
  var status = 'Created Access Point successfully.';

  var setupAccessPoint = () => {
    if (password && !security) {
      security = 'psk2';
    }

    if (password && security) {
      status += ' SSID: ' + ssid + ', password ' + password + ', security mode: ' + security;
    } else if (!password && !security) {
      security = 'none';
      status += ' SSID: ' + ssid;
    }

    var setSSID = () => {
      return this.simpleExec(commands.setAccessPointSSID(ssid));
    };

    var setAccessPointPassword = () => {
      return this.simpleExec(commands.setAccessPointPassword(password));
    };

    var setAccessPointSecurity = () => {
      this.simpleExec(commands.setAccessPointSecurity(security));
    };

    var turnAccessPointOn = () => {
      return this.simpleExec(commands.turnAccessPointOn());
    };

    var commitAndClosePromise = () => {
      return new Promise((resolve) => {
        commitAndClose(this, status, resolve);
      });
    };

    var setup = () => {
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

  return this.simpleExec(commands.getAccessPointSSID())
    .then(() => {
      // When an AP exists, change the status to
      // reflect an "update" vs. "create":
      status = 'Updated Access Point successfully.';
      return setupAccessPoint();
    })
    .catch(() => {
      var setAccessPoint = () => {
        return this.simpleExec(commands.setAccessPoint())
          .then(() => this.simpleExec(commands.setAccessPointDevice()))
          .then(() => this.simpleExec(commands.setAccessPointNetwork()))
          .then(() => this.simpleExec(commands.setAccessPointMode()));
      };

      var setLanNetwork = () => {
        return this.simpleExec(commands.setLanNetwork())
          .then(() => this.simpleExec(commands.setLanNetworkIfname()))
          .then(() => this.simpleExec(commands.setLanNetworkProto()))
          .then(() => this.simpleExec(commands.setLanNetworkIP()))
          .then(() => this.simpleExec(commands.setLanNetworkNetmask()));
      };

      var commitNetwork = () => {
        return this.simpleExec(commands.commitNetwork());
      };

      return setAccessPoint()
        .then(setLanNetwork)
        .then(commitNetwork)
        .then(setupAccessPoint);
    });
};
