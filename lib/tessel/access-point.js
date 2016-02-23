// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var logs = require('../logs');
var Tessel = require('./tessel');


function commitAndClose(tessel, status, resolve, reject) {

  var reconnectWifi = () => tessel.simpleExec(commands.reconnectWifi());

  var reconnectDnsmasq = () => tessel.simpleExec(commands.reconnectDnsmasq());

  var reconnectDhcp = () => tessel.simpleExec(commands.reconnectDhcp());

  return tessel.simpleExec(commands.commitWirelessCredentials())
    .then(reconnectWifi)
    .then(reconnectDnsmasq)
    .then(reconnectDhcp)
    .then((str) => logs.info(status, str))
    .then(resolve)
    .catch(reject);
}

Tessel.prototype.enableAccessPoint = function() {
  var status = 'Access Point successfully enabled.';

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.turnAccessPointOn())
      .then(() => commitAndClose(this, status, resolve, reject));
  });
};

Tessel.prototype.disableAccessPoint = function() {
  var status = 'Access Point successfully disabled.';

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.turnAccessPointOff())
      .then(() => commitAndClose(this, status, resolve, reject));
  });
};

Tessel.prototype.getAccessPointInfo = function() {
  var info;

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.getAccessPointConfig())
      .then((config) => {
        const props = ['ssid', 'key', 'encryption', 'disabled'];
        const values = props.map((prop) => {
          const regex = new RegExp(`${prop}='(.+)'`);
          const value = regex.exec(config);

          return value ? value[1] : null;
        });

        info = {
          ssid: values[0],
          key: values[1],
          encryption: values[2],
          disabled: values[3]
        };

        return this.simpleExec(commands.getAccessPointIP());
      })
      .then((ip) => {
        info.ip = ip.replace('\n', '').trim();

        resolve(info);
      })
      .catch(reject);
  });
};

Tessel.prototype.getAccessPointInfo = function() {
  var info;

  return new Promise((resolve, reject) => {
    return this.simpleExec(commands.getAccessPointConfig())
      .then((config) => {
        const props = ['ssid', 'key', 'encryption', 'disabled'];
        const values = props.map((prop) => {
          const regex = new RegExp(`${prop}='(.+)'`);
          const value = regex.exec(config);

          return value ? value[1] : null;
        });

        info = {
          ssid: values[0],
          password: values[1],
          security: values[2],
          disabled: values[3]
        };

        return this.simpleExec(commands.getAccessPointIP());
      })
      .then((ip) => {
        info.ip = ip.replace('\n', '');

        resolve(info);
      })
      .catch(reject);
  });
};

Tessel.prototype.createAccessPoint = function(opts) {
  var ssid = opts.ssid;
  var password = opts.pass;
  var security = opts.security;
  var status = 'Created Access Point successfully. ';

  var setupAccessPoint = () => {
    if (password && !security) {
      security = 'psk2';
    }

    if (password && security) {
      status += `SSID:  ${ssid}, password ${password}, security mode: ${security}`;
    } else if (!password && !security) {
      security = 'none';
      status += `SSID: ${ssid}`;
    }

    var setSSID = () => this.simpleExec(commands.setAccessPointSSID(ssid));

    var setAccessPointPassword = () => this.simpleExec(commands.setAccessPointPassword(password));

    var setAccessPointSecurity = () => this.simpleExec(commands.setAccessPointSecurity(security));

    var turnAccessPointOn = () => this.simpleExec(commands.turnAccessPointOn());

    var commitAndClosePromise = () => new Promise((resolve, reject) => commitAndClose(this, status, resolve, reject));

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
      status = 'Updated Access Point successfully. ';
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

      var commitNetwork = () => this.simpleExec(commands.commitNetwork());

      return setAccessPoint()
        .then(setLanNetwork)
        .then(commitNetwork)
        .then(setupAccessPoint);
    });
};
