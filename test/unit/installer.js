// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['installer'] = {
  surface: function(test) {
    test.expect(2);
    test.equal(typeof installer.drivers, 'function');
    test.equal(typeof installer.homedir, 'function');
    test.done();
  },
};

exports['installer.drivers'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.info = this.sandbox.stub(log, 'info');

    this.copySync = this.sandbox.stub(fs, 'copySync');
    this.spawn = this.sandbox.stub(cp, 'spawn', () => {
      this.emitter = new Emitter();
      return this.emitter;
    });

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  successful: function(test) {
    var isLinux = process.platform === 'linux';
    var callCount = isLinux ? 1 : 0;

    test.expect(isLinux ? 7 : 1);

    installer.drivers().then(() => {
      test.equal(this.copySync.callCount, callCount);

      if (isLinux) {
        test.equal(this.copySync.callCount, 1);
        test.equal(this.spawn.callCount, 1);

        // DO NOT USE path.normalize ON THESE PATHS!!
        // THEY WILL NOT BE USED ON WINDOWS SYSTEMS!!
        test.equal(this.copySync.lastCall.args[0].endsWith('resources/85-tessel.rules'), true);
        test.equal(this.copySync.lastCall.args[1], '/etc/udev/rules.d/85-tessel.rules');

        test.equal(this.spawn.lastCall.args[0], 'udevadm');
        test.deepEqual(this.spawn.lastCall.args[1], ['control', '--reload-rules']);
      }
      test.done();
    });

    if (isLinux) {
      this.emitter.emit('close', 0);
    }
  },
};

exports['installer.homedir'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');

    this.ensureDir = this.sandbox.stub(fs, 'ensureDir', (target, callback) => callback(null));
    this.outputJson = this.sandbox.stub(fs, 'outputJson', (target, data, callback) => callback(null));

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  successful: function(test) {
    test.expect(5);

    installer.homedir().then(() => {
      test.equal(this.ensureDir.callCount, 1);
      test.equal(this.outputJson.callCount, 1);

      test.equal(this.ensureDir.lastCall.args[0], path.join(osenv.home(), '.tessel'));
      test.equal(this.outputJson.lastCall.args[0], path.join(osenv.home(), '.tessel', 'preferences.json'));
      test.deepEqual(this.outputJson.lastCall.args[1], {});
      test.done();
    });
  },
};

exports['installer.rust-sdk'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.error = this.sandbox.stub(log, 'error');
    this.info = this.sandbox.stub(log, 'info');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  // For now we only care that this is defined, not that it does
  // anything particularly useful. That will be filled in later.
  //
  install: function(test) {
    test.expect(1);

    installer['rust-sdk']({
      action: 'install'
    }).then(() => {
      test.ok(true);
      test.done();
    });
  },

  remove: function(test) {
    test.expect(1);

    installer['rust-sdk']({
      action: 'remove'
    }).then(() => {
      test.ok(true);
      test.done();
    });
  },
};
