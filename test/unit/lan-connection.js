// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

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

  ipWhenIpV6: function(test) {
    test.expect(1);
    this.lanConnection = new LAN.Connection({
      addresses: ['fc00::', '172.16.2.5'],
      host: 'home.loc',
    });
    // The first address was picked
    test.equal(this.lanConnection.ip, 'fc00::');
    test.done();
  },

  ipWhenIpV6LinkLocal: function(test) {
    test.expect(1);
    this.lanConnection = new LAN.Connection({
      addresses: ['fc00::', '172.16.2.5'],
      networkInterface: 'en0',
      host: 'home.loc',
    });
    // THe first address was picked, which was ipv6, and a network interface also provided
    test.equal(this.lanConnection.ip, 'fc00::%en0');
    test.done();
  },

  ipWhenIpV4: function(test) {
    test.expect(1);
    this.lanConnection = new LAN.Connection({
      addresses: ['172.16.2.5', 'fc00::'],
      networkInterface: 'en0',
      host: 'home.loc',
    });
    // The first address was picked
    test.equal(this.lanConnection.ip, '172.16.2.5');
    test.done();
  },

  // no ip addresses were found, fallback to the host
  ipWhenNoIps: function(test) {
    test.expect(1);
    this.lanConnection = new LAN.Connection({
      networkInterface: 'en0',
      host: 'home.loc',
    });
    test.equal(this.lanConnection.ip, 'home.loc');
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

exports['LAN.Connection.prototype.exec'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.isProvisioned = this.sandbox.stub(Tessel, 'isProvisioned', function() {
      return false;
    });

    this.Client = this.sandbox.spy(ssh, 'Client');

    this.lanConnection = new LAN.Connection({});

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  // closed: function(test) {
  //   test.expect(1);
  //
  //   this.lanConnection.closed = true;
  //   this.lanConnection.exec(undefined, (error) => {
  //     test.equal(error.message, 'Remote SSH connection has already been closed');
  //     test.done();
  //   });
  // },

  emitClose: function(test) {
    test.expect(2);

    this.lanConnection.open()
      .then(() => {
        test.equal(this.Client.callCount, 1);

        this.lanConnection.ssh.emit('close');
        this.lanConnection.exec(undefined, (error) => {
          test.equal(error.message, 'Remote SSH connection has already been closed');
          test.done();
        });
      });
  },
};

exports['LAN.Scanner.prototype.start'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.setImmediate = this.sandbox.stub(global, 'setImmediate', (cb) => cb());
    this.createBrowser = this.sandbox.stub(mdns, 'createBrowser', () => {
      var emitter = new Emitter();
      emitter.discover = this.sandbox.spy();
      return emitter;
    });

    this.readFileSync = this.sandbox.stub(fs, 'readFileSync', () => 'this is the contents of id_rsa');

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
    this.scanner.on('error', function(error) {
      test.equal(error.message, 'get outta here!');
      test.done();
    });
    // 2
    this.scanner.browser.emit('ready');
  },

  updateDiscovered: function(test) {
    test.expect(3);

    var data = {};
    var connectionHandler = this.sandbox.spy();

    this.scanner.start();
    test.equal(this.scanner.discovered.length, 0);
    this.scanner.on('connection', connectionHandler);
    this.scanner.browser.emit('update', data);

    test.equal(connectionHandler.callCount, 1);
    test.equal(this.scanner.discovered.length, 1);
    test.done();
  },

  updateDiscoveredExists: function(test) {
    test.expect(4);

    var connectionHandler = this.sandbox.spy();
    var discovery = {
      addresses: ['192.168.1.9'],
      query: ['_tessel._tcp.local'],
      type: [{
        name: 'tessel',
        protocol: 'tcp',
        subtypes: [],
        description: undefined
      }],
      port: 22,
      fullname: 'bishop._tessel._tcp.local',
      txt: [''],
      host: 'bishop.local',
      interfaceIndex: 0,
      networkInterface: 'en0'
    };

    var connection = {
      auth: {
        host: '192.168.1.9',
        port: 22,
        username: 'root',
        passphrase: '',
        privateKey: undefined,
        readyTimeout: 5000
      },
      ip: '192.168.1.9',
      host: 'bishop.local',
      connectionType: 'LAN',
      authorized: false,
      ssh: undefined
    };

    test.equal(this.scanner.discovered.length, 0);

    this.scanner.on('connection', connectionHandler);
    this.scanner.start();

    this.scanner.discovered.push(connection);
    test.equal(this.scanner.discovered.length, 1);
    this.scanner.browser.emit('update', discovery);

    test.equal(connectionHandler.callCount, 0);
    test.equal(this.scanner.discovered.length, 1);
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
    this.scanner.on('error', function(error) {
      test.equal(error.message, 'get outta here!');
      test.done();
    });

    // 2
    this.scanner.browser.emit('update', {
      fullname: 'Test Unit'
    });
  },
};
