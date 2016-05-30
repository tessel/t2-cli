/*global Preferences */

exports['Preferences'] = {
  surface: function(test) {
    test.expect(3);
    test.equal(typeof Preferences.read, 'function');
    test.equal(typeof Preferences.write, 'function');
    test.equal(typeof Preferences.load, 'function');
    test.done();
  }
};

exports['Preferences.load'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsErr = this.sandbox.stub(logs, 'err');
    this.logsInfo = this.sandbox.stub(logs, 'info');

    this.exists = this.sandbox.stub(fs, 'exists', (file, handler) => {
      handler(true);
    });
    this.readFile = this.sandbox.stub(fs, 'readFile', (file, handler) => {
      handler(null, '{}');
    });
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  load: function(test) {
    test.expect(2);

    Preferences.load().then(() => {
      test.equal(this.exists.callCount, 1);
      test.equal(this.exists.lastCall.args[0].endsWith('preferences.json'), true);
      test.done();
    });
  },

  homedir: function(test) {
    test.expect(1);

    Preferences.load().then(() => {
      test.ok(this.exists.firstCall.args[0].startsWith(os.homedir()));
      test.done();
    });
  }
};

exports['Preferences.read'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsErr = this.sandbox.stub(logs, 'err');
    this.logsInfo = this.sandbox.stub(logs, 'info');

    this.exists = this.sandbox.stub(fs, 'exists', (file, handler) => {
      handler(true);
    });
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  readEmptyFile: function(test) {
    test.expect(1);

    var defaultValue = 'value';
    this.readFile = this.sandbox.stub(fs, 'readFile', (file, handler) => {
      handler(null, '');
    });

    Preferences.read('key', defaultValue).then(result => {
      test.equal(result, defaultValue);
      test.done();
    });
  },

  readError: function(test) {
    test.expect(1);

    var defaultValue = 'value';
    this.readFile = this.sandbox.stub(fs, 'readFile', (file, handler) => {
      handler(new Error('this should not matter'));
    });

    Preferences.read('key', defaultValue).then(result => {
      test.equal(result, defaultValue);
      test.done();
    });
  },

  readWithDefaults: function(test) {
    test.expect(1);

    var defaultValue = 'value';
    this.readFile = this.sandbox.stub(fs, 'readFile', (file, handler) => {
      handler(null, '{}');
    });

    Preferences.read('key', defaultValue).then(result => {
      test.equal(result, defaultValue);
      test.done();
    });
  },

  readSetValues: function(test) {
    test.expect(1);

    var defaultValue = null;
    var value = 'value';
    this.readFile = this.sandbox.stub(fs, 'readFile', (file, handler) => {
      handler(null, `{"key": "${value}"}`);
    });

    Preferences.read('key', defaultValue).then(result => {
      test.equal(result, value);
      test.done();
    });
  }
};

exports['Preferences.write'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.state = {};
    this.logsErr = this.sandbox.stub(logs, 'err');
    this.logsInfo = this.sandbox.stub(logs, 'info');
    this.exists = this.sandbox.stub(fs, 'exists', (file, handler) => {
      handler(true);
    });
    this.readFile = this.sandbox.stub(fs, 'readFile', (file, handler) => {
      handler(null, JSON.stringify(this.state));
    });
    this.writeFile = this.sandbox.stub(fs, 'writeFile', (file, data, handler) => {
      this.state = JSON.parse(data);
      handler(null);
    });
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  write: function(test) {
    test.expect(2);

    var key = 'key';
    var value = 'value';

    Preferences.write(key, value).then(() => {
      test.equal(true, this.state.hasOwnProperty(key));
      test.equal(value, this.state[key]);
      test.done();
    });
  }
};
