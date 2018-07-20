// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['LAN.Connection'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.readFileSync = this.sandbox.stub(fs, 'readFileSync').callsFake(function() {
      return 'this is the contents of id_rsa';
    });
    this.lanConnection = new LAN.Connection({});

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  connectionType(test) {
    test.expect(1);
    test.equal(this.lanConnection.connectionType, 'LAN');
    test.done();
  },

  ipWhenIpV6(test) {
    test.expect(1);
    this.lanConnection = new LAN.Connection({
      addresses: ['fc00::', '172.16.2.5'],
      host: 'home.loc',
    });
    // The first address was picked
    test.equal(this.lanConnection.ip, 'fc00::');
    test.done();
  },

  ipWhenIpV6LinkLocal(test) {
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

  ipWhenIpV4(test) {
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
  ipWhenNoIps(test) {
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
  setUp(done) {
    this.scanner = new LAN.Scanner();
    done();
  },

  tearDown(done) {
    done();
  },

  emitterSubclass(test) {
    test.expect(1);
    test.ok(this.scanner instanceof Emitter);
    test.done();
  },

  properties(test) {
    test.expect(2);
    test.equal(this.scanner.browser, undefined);
    test.deepEqual(this.scanner.discovered, []);
    test.done();
  },
};

exports['LAN.Connection.prototype.exec'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.isProvisioned = this.sandbox.stub(Tessel, 'isProvisioned').returns(true);

    const emitter = new Emitter();
    emitter.connect = () => emitter.emit('ready');

    this.Client = this.sandbox.stub(ssh, 'Client').returns(emitter);

    this.lanConnection = new LAN.Connection({
      privateKey: 'foo'
    });

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  closed(test) {
    test.expect(1);

    this.lanConnection.closed = true;
    this.lanConnection.exec(undefined, (error) => {
      test.equal(error.message, 'Remote SSH connection has already been closed');
      test.done();
    });
  },

  emitClose(test) {
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
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.setImmediate = this.sandbox.stub(global, 'setImmediate').callsFake((cb) => cb());
    this.createBrowser = this.sandbox.stub(mdns, 'createBrowser').callsFake(() => {
      var emitter = new Emitter();
      emitter.discover = this.sandbox.spy();
      return emitter;
    });

    this.readFileSync = this.sandbox.stub(fs, 'readFileSync').callsFake(() => 'this is the contents of id_rsa');

    this.scanner = new LAN.Scanner();

    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  createBrowser(test) {
    test.expect(1);

    this.scanner.start();

    test.equal(this.createBrowser.callCount, 1);
    test.done();
  },

  readyDiscover(test) {
    test.expect(1);

    this.scanner.start();
    this.scanner.browser.emit('ready');

    test.equal(this.scanner.browser.discover.callCount, 1);
    test.done();
  },

  readyDiscoverThrows(test) {
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

  updateDiscovered(test) {
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

  updateDiscoveredExists(test) {
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

  updateDiscoveredThrows(test) {
    test.expect(1);

    this.scanner.start();

    this.LANConnection = this.sandbox.stub(LAN, 'Connection').callsFake(function() {
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


exports['LAN.Scanner.prototype.stop'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.scanner = new LAN.Scanner();
    done();
  },

  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  callStopSafely(test) {
    test.expect(1);
    this.scanner.browser = undefined;
    test.doesNotThrow(() => {
      this.scanner.stop();
    });
    test.done();
  },
};
