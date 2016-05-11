exports['deployment.resolveLanguage()'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.arg = '';
    this.existsSync = this.sandbox.stub(fs, 'existsSync', (arg) => {
      return this.arg === arg;
    });
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  js: function(test) {
    test.expect(4);
    test.equal(deployment.resolveLanguage('js'), deployment.js);
    test.equal(deployment.resolveLanguage('JS'), deployment.js);
    test.equal(deployment.resolveLanguage('javascript'), deployment.js);
    test.equal(deployment.resolveLanguage('JAVASCRIPT'), deployment.js);
    test.done();
  },

  jsInferred: function(test) {
    test.expect(4);
    // Set the stub return value
    this.arg = 'package.json';
    test.equal(deployment.resolveLanguage('.'), deployment.js);
    test.equal(deployment.resolveLanguage('./'), deployment.js);
    test.equal(deployment.resolveLanguage('../'), deployment.js);
    test.equal(deployment.resolveLanguage('../../'), deployment.js);
    test.done();
  },

  jsInferredInvalidProjectDirectory: function(test) {
    test.expect(4);
    // Set the stub return value
    this.arg = '';
    test.equal(deployment.resolveLanguage('.'), null);
    test.equal(deployment.resolveLanguage('./'), null);
    test.equal(deployment.resolveLanguage('../'), null);
    test.equal(deployment.resolveLanguage('../../'), null);
    test.done();
  },

  rs: function(test) {
    test.expect(4);
    test.equal(deployment.resolveLanguage('rs'), deployment.rs);
    test.equal(deployment.resolveLanguage('RS'), deployment.rs);
    test.equal(deployment.resolveLanguage('rust'), deployment.rs);
    test.equal(deployment.resolveLanguage('RUST'), deployment.rs);
    test.done();
  },

  rsInferred: function(test) {
    test.expect(4);
    // Set the stub return value
    this.arg = 'Cargo.toml';
    test.equal(deployment.resolveLanguage('.'), deployment.rs);
    test.equal(deployment.resolveLanguage('./'), deployment.rs);
    test.equal(deployment.resolveLanguage('../'), deployment.rs);
    test.equal(deployment.resolveLanguage('../../'), deployment.rs);
    test.done();
  },

  rsInferredInvalidProjectDirectory: function(test) {
    test.expect(4);
    // Set the stub return value
    this.arg = '';
    test.equal(deployment.resolveLanguage('.'), null);
    test.equal(deployment.resolveLanguage('./'), null);
    test.equal(deployment.resolveLanguage('../'), null);
    test.equal(deployment.resolveLanguage('../../'), null);
    test.done();
  },

  py: function(test) {
    test.expect(4);
    test.equal(deployment.resolveLanguage('py'), deployment.py);
    test.equal(deployment.resolveLanguage('python'), deployment.py);
    test.equal(deployment.resolveLanguage('PY'), deployment.py);
    test.equal(deployment.resolveLanguage('PYTHON'), deployment.py);
    test.done();
  },

  failure: function(test) {
    test.expect(4);
    test.equal(deployment.resolveLanguage(1), null);
    test.equal(deployment.resolveLanguage('whatever'), null);
    test.equal(deployment.resolveLanguage('ruby'), null);
    test.equal(deployment.resolveLanguage(null), null);
    test.done();
  },
};
