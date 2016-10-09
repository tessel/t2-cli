// System Objects
// ...

// Third Party Dependencies
// ...

// Internal
var commands = require('./commands');
var log = require('../log');
var Tessel = require('./tessel');

var defaultIP = '192.168.1.101';

function commitAndClose(tessel, status, resolve, reject) {

  var reconnectWifi = () => tessel.simpleExec(commands.reconnectWifi());

  var reconnectDnsmasq = () => tessel.simpleExec(commands.reconnectDnsmasq());

  var reconnectDhcp = () => tessel.simpleExec(commands.reconnectDhcp());

  return tessel.simpleExec(commands.commitWirelessCredentials())
    .then(reconnectWifi)
    .then(reconnectDnsmasq)
    .then(reconnectDhcp)
    .then((str) => log.info(status, str))
    .then(resolve)
    .catch(reject);
}

Tessel.prototype.enableAccessPoint = function(opts) {
  var status = `${opts.mode === 'ap' ? 'Access Point' : 'Adhoc Network'} successfully enabled.`;

  return new Promise((resolve, reject) => {
    return this.getAccessPointInfo()
      .then((info) => {
        if (info.ssid) {
          return this.simpleExec(commands.turnAccessPointOn())
            .then(() => {
              var logInfo = [`SSID: ${info.ssid}`];

              if (info.key && info.encryption !== 'none') {
                logInfo.push(`Password: ${info.key}`);
              }

              logInfo.push(
                `Security: ${info.encryption}`,
                `IP Address: ${info.ip}`
              );

              status += `\n${logInfo.join('\n')}`;

              return commitAndClose(this, status, resolve, reject);
            });
        } else {
          reject(`${this.name} is not configured as an access point (run "t2 ap --help" to learn more)`);
        }
      })
      .catch(reject);
  });
};

Tessel.prototype.disableAccessPoint = function(opts) {
  var status = `${opts.mode === 'ap' ? 'Access Point' : 'Adhoc Network'} successfully disabled.`;

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
          key: values[2] !== 'none' ? values[1] : null, // the password for a previous configuration could still exist, so omit this info if the encryption is 'none'
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

Tessel.prototype.createAccessPoint = function(opts) {
  var ssid = opts.ssid;
  var password = opts.password;
  var security = opts.security;
  var mode = opts.mode;
  var ip = opts.ip;
  var status = `Created ${mode === 'ap' ? 'Access Point' : 'Adhoc Network'} successfully. `;


  var setupAccessPoint = () => {
    if (password && !security) {
      security = 'psk2';
    }

    if (!ip) {
      ip = defaultIP;
    }

    if (password && security) {
      status += `SSID:  ${ssid}, password ${password}, security mode: ${security}, IP address: ${ip}`;
    } else if (!password && !security) {
      security = 'none';
      status += `SSID: ${ssid}, IP address: ${ip}`;
    }

    var setSSID = () => this.simpleExec(commands.setAccessPointSSID(ssid));

    var setAccessPointPassword = () => this.simpleExec(commands.setAccessPointPassword(password));

    var setAccessPointSecurity = () => this.simpleExec(commands.setAccessPointSecurity(security));

    var setAccessPointMode = () => this.simpleExec(commands.setAccessPointMode(mode));

    var setAccessPointIP = () => this.simpleExec(commands.setLanNetworkIP(ip));

    var turnAccessPointOn = () => this.simpleExec(commands.turnAccessPointOn());

    var commitAndClosePromise = () => {
      return new Promise((resolve, reject) => commitAndClose(this, status, resolve, reject));
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
      .then(setAccessPointMode)
      .then(setAccessPointIP)
      .then(turnAccessPointOn)
      .then(commitAndClosePromise);
  };

  return this.simpleExec(commands.getWifiSettings())
    .then((settings) => {
      var regexDisabled = /disabled='(\d)'/;
      var disabledMatcher = settings.match(regexDisabled);

      // because an adhoc network both connects and emits,
      // wifi cannot be enabled to when creating an adhoc network
      if (mode === 'adhoc' && disabledMatcher[1] === '0') {
        throw new Error(`Tessel must have wifi disabled before creating an adhoc network. Please run 't2 wifi --off' and try again.`);
      }

      return true;
    })

    .then(this.simpleExec(commands.getAccessPoint()))
    .then(() => {

      // When an AP exists, change the status to
      // reflect an "update" vs. "create":
      status = `Updated ${mode === 'ap' ? 'Access Point' : 'Adhoc Network'} successfully. `;
      return setupAccessPoint();
    })
    .catch((error) => {
      // this error was thrown when checking on the wifi status above
      if (error && error.message.includes('adhoc')) {
        return Promise.reject(error);
      }

      var setAccessPoint = () => {
        return this.simpleExec(commands.setAccessPoint())
          .then(() => this.simpleExec(commands.setAccessPointDevice()))
          .then(() => this.simpleExec(commands.setAccessPointNetwork()));
      };

      var setLanNetwork = () => {
        return this.simpleExec(commands.setLanNetwork())
          .then(() => this.simpleExec(commands.setLanNetworkIfname()))
          .then(() => this.simpleExec(commands.setLanNetworkProto()))
          .then(() => this.simpleExec(commands.setLanNetworkNetmask()));
      };

      var commitNetwork = () => this.simpleExec(commands.commitNetwork());

      return setAccessPoint()
        .then(setLanNetwork)
        .then(commitNetwork)
        .then(setupAccessPoint);
    });
};
