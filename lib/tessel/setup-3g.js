var Tessel = require('./tessel');
var log = require('../log');

Tessel.prototype.setup3g = function(options) {

  var apn = options.apn;
  var dialnumber = options.dialnumber;
  var username = options.username;
  var password = options.password;
  var config = options.config;
  var on = options.on;
  var off = options.off;
  var status = options.status;

  if (config) {
	return this.simpleExec(['uci', 'get', 'network.wan']).then(() => {
		// If dongle already exists remove it and store new configuration
		return this.simpleExec(['uci', 'delete', 'network.wan']).then(() => {
			return this.configure3gDongle(apn, dialnumber, username, password);
		})
	}).catch(() => {
		return this.configure3gDongle(apn. dialnumber, username, password);
	});
  }

  if (on) {
  	return this.enable3gConnection();
  }

  if (off) {
  	return this.disable3gConnection();
  }

  if (status) {
  	return this.show3gConnectionStatus();
  }

};

Tessel.prototype.configure3gDongle = function(apn, dialnumber, username, password) {
	return this.add3gDongle()
	  .then(() => this.set3gDongleName())
      .then(() => this.set3gDongleIfname())
      .then(() => this.set3gDongleDevice())
      .then(() => this.set3gDongleApn(apn))
      .then(() => this.set3gDongleService())
      .then(() => this.set3gDongleProto())
      .then(() => this.set3gDongleDialnumber(dialnumber))
      .then(() => this.set3gDongleUsername(username))
      .then(() => this.set3gDonglePassword(password))
      .then(() => this.storeNew3gDongle())
      .then(() => this.enable3gConnection())
      .then(() => this.print3gSetupMessage());
}

Tessel.prototype.add3gDongle = function() {
    return this.simpleExec(['uci', 'add', 'network', 'interface']);
 }

Tessel.prototype.set3gDongleName = function() {
	return this.simpleExec(['uci', 'rename', 'network.@interface[-1]=wan']);
}

Tessel.prototype.set3gDongleIfname = function() {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].ifname=ppp0']);
}

Tessel.prototype.set3gDongleDevice = function() {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].device=/dev/ttyUSB0']);
}

Tessel.prototype.set3gDongleApn = function(apn) {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].apn=' + apn]);
}

Tessel.prototype.set3gDongleService = function() {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].service=umts']);
}

Tessel.prototype.set3gDongleProto = function() {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].proto=3g']);
}

Tessel.prototype.set3gDongleDialnumber = function(dialnumber) {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].dialnumber=' + dialnumber]);
}

Tessel.prototype.set3gDongleUsername = function(username) {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].username=' + username]);
}

Tessel.prototype.set3gDonglePassword = function(password) {
	return this.simpleExec(['uci', 'set', 'network.@interface[-1].password=' + password]);
}

Tessel.prototype.storeNew3gDongle = function() {
	return this.simpleExec(['uci', 'commit']);
}

Tessel.prototype.enable3gConnection = function() {
	return this.simpleExec(['ifup', 'wan']);
}

Tessel.prototype.disable3gConnection = function() {
	return this.simpleExec(['ifdown', 'wan']);
}

Tessel.prototype.show3gConnectionStatus = function() {
	return this.simpleExec(['ifstatus', 'wan']).then(data => {
		log.info(data);
	}).catch(() => {
		log.info('Connection data not available');
	});
}

Tessel.prototype.print3gSetupMessage = function() {
	log.info('3G USB dongle has been configured successfully.');
    log.info('It should connect automatically to the internet.');
}