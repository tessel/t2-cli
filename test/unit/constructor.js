var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var RemoteProcessSimulator = require('../common/remote-process-simulator');
var TesselSimulator = require('../common/tessel-simulator');

exports['Tessel'] = {
  setUp: function(done) {
    done();
  },

  tearDown: function(done) {
    done();
  },

  construction: function(test) {
    test.expect(14);

    var usb = new Tessel({
      connectionType: 'USB'
    });

    var lan = new Tessel({
      connectionType: 'LAN'
    });

    test.deepEqual(usb.usbConnection, {
      connectionType: 'USB',
      authorized: true,
    });
    test.deepEqual(usb.connection, {
      connectionType: 'USB',
      authorized: true,
    });
    test.equal(usb.lanConnection, undefined);

    test.deepEqual(lan.lanConnection, {
      connectionType: 'LAN'
    });
    test.deepEqual(lan.connection, {
      connectionType: 'LAN'
    });
    test.equal(lan.usbConnection, undefined);

    var usbOwnProperties = Object.getOwnPropertyNames(usb);
    var lanOwnProperties = Object.getOwnPropertyNames(lan);

    test.ok(usbOwnProperties.indexOf('addConnection') !== -1);
    test.ok(usbOwnProperties.indexOf('closed') !== -1);
    test.ok(usbOwnProperties.indexOf('name') !== -1);
    test.ok(usbOwnProperties.indexOf('serialNumber') !== -1);

    test.ok(lanOwnProperties.indexOf('addConnection') !== -1);
    test.ok(lanOwnProperties.indexOf('closed') !== -1);
    test.ok(lanOwnProperties.indexOf('name') !== -1);
    test.ok(lanOwnProperties.indexOf('serialNumber') !== -1);

    test.done();
  },
};

exports['Tessel.prototype.receive'] = {
  setUp: function(done) {
    this.rps = new RemoteProcessSimulator();
    this.tessel = new Tessel({
      connectionType: 'USB'
    });

    done();
  },

  tearDown: function(done) {
    done();
  },

  error: function(test) {
    test.expect(1);

    this.tessel.receive(this.rps).catch(function(error) {
      test.equal(error.message, 'Some Error');
      test.done();
    });

    this.rps.stderr.emit('data', new Buffer('Some Error'));
    this.rps.emit('close');
  },

  dataReceived: function(test) {
    test.expect(1);

    this.tessel.receive(this.rps).then(function(received) {
      test.equal(received.toString(), 'Some Data');
      test.done();
    });

    this.rps.stdout.emit('data', new Buffer('Some Data'));
    this.rps.emit('close');
  },
};

exports['Tessel.prototype.simpleExec'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();

    this.rps = new RemoteProcessSimulator();
    this.tessel = new TesselSimulator();

    this.receive = this.sandbox.spy(this.tessel, 'receive');
    this.connectionExec = this.sandbox.stub(this.tessel.connection, 'exec', function() {
      return Promise.resolve(this.rps);
    }.bind(this));

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  callsConnectionExecWithCommand: function(test) {
    test.expect(2);

    this.tessel.simpleExec('some command').then(function() {
      test.equal(this.connectionExec.callCount, 1);
      test.equal(this.receive.callCount, 1);
      test.done();
    }.bind(this));

    setImmediate(function() {
      this.rps.emit('close');
    }.bind(this));
  },

  callsConnectionExecWithCommandAndErrors: function(test) {
    test.expect(3);

    this.tessel.simpleExec('some command').catch(function(error) {
      test.equal(error.message, 'Some Error');
      test.equal(this.connectionExec.callCount, 1);
      test.equal(this.receive.callCount, 1);
      test.done();
    }.bind(this));

    setImmediate(function() {
      this.rps.stderr.emit('data', new Buffer('Some Error'));
      this.rps.emit('close');
    }.bind(this));
  },

  callsConnectionExecWithCommandAndDataReceived: function(test) {
    test.expect(3);

    this.tessel.simpleExec('some command').then(function(received) {
      test.equal(received, 'Some Data');
      test.equal(this.connectionExec.callCount, 1);
      test.equal(this.receive.callCount, 1);
      test.done();
    }.bind(this));

    setImmediate(function() {
      this.rps.stdout.emit('data', new Buffer('Some Data'));
      this.rps.emit('close');
    }.bind(this));
  },
};
