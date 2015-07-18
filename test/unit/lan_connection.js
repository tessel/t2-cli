var sinon = require('sinon');
var Emitter = require('events').EventEmitter;
var LAN = require('../../lib/lan_connection').LAN;
var fs = require('fs');
var mdns = require('mdns-js');

exports['LAN.Connection'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.readFileSync = this.sandbox.stub(fs, 'readFileSync', function() {
      return 'this is the contents of id_rsa';
    });
    this.lanConnection = new LAN.Connection({});

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  connectionType: function(test) {
    test.expect(1);
    test.equal(this.lanConnection.connectionType, 'LAN');
    test.done();
  },
};

exports['LAN.Scanner'] = {
  setUp: function(done) {
    this.scanner = new LAN.Scanner();
    done();
  },

  tearDown: function(done) {
    done();
  },

  emitterSubclass: function(test) {
    test.expect(1);
    test.ok(this.scanner instanceof Emitter);
    test.done();
  },

  properties: function(test) {
    test.expect(2);
    test.equal(this.scanner.browser, undefined);
    test.deepEqual(this.scanner.discovered, []);
    test.done();
  },
};

exports['LAN.Scanner.prototype.start'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.setImmediate = this.sandbox.stub(global, 'setImmediate', function(callback) {
      callback();
    });
    this.createBrowser = this.sandbox.stub(mdns, 'createBrowser', function() {
      var emitter = new Emitter();
      emitter.discover = this.sandbox.spy();
      return emitter;
    }.bind(this));

    this.readFileSync = this.sandbox.stub(fs, 'readFileSync', function() {
      return 'this is the contents of id_rsa';
    });

    this.scanner = new LAN.Scanner();

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  createBrowser: function(test) {
    test.expect(1);

    this.scanner.start();

    test.equal(this.createBrowser.callCount, 1);
    test.done();
  },

  readyDiscover: function(test) {
    test.expect(1);

    this.scanner.start();
    this.scanner.browser.emit('ready');

    test.equal(this.scanner.browser.discover.callCount, 1);
    test.done();
  },

  readyDiscoverThrows: function(test) {
    test.expect(1);

    this.scanner.start();

    this.scanner.browser.discover = function() {
      throw new Error('get outta here!');
    };

    // Order of calls is intentional!!
    // 1
    this.scanner.browser.emit('ready');
    // 2
    this.scanner.on('error', function(error) {
      test.equal(error.message, 'get outta here!');
      test.done();
    });
  },

  updateDiscovered: function(test) {
    test.expect(1);

    var data = {};
    var connectionHandler = this.sandbox.spy();

    this.scanner.start();
    this.scanner.on('connection', connectionHandler);
    this.scanner.browser.emit('update', data);

    test.equal(connectionHandler.callCount, 1);
    test.done();
  },

  updateDiscoveredExists: function(test) {
    test.expect(1);

    var connectionHandler = this.sandbox.spy();

    this.scanner.start();
    this.scanner.on('connection', connectionHandler);
    this.scanner.discovered.push(1);
    this.scanner.browser.emit('update', 1);

    test.equal(connectionHandler.callCount, 0);
    test.done();
  },

  updateDiscoveredThrows: function(test) {
    test.expect(1);

    this.scanner.start();

    this.LANConnection = this.sandbox.stub(LAN, 'Connection', function() {
      throw new Error('get outta here!');
    });

    // Order of calls is intentional!!
    // 1
    this.scanner.browser.emit('update');
    // 2
    this.scanner.on('error', function(error) {
      test.equal(error.message, 'get outta here!');
      test.done();
    });
  },
};
