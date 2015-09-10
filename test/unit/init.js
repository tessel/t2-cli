exports['init (language args)'] = {
  setUp: (done) => {
    done();
  },
  tearDown: (done) => {
    done();
  },
  javascriptArgs: function(test) {
    test.expect(4);
    // No language arg indicates JavaScript by default
    test.ok(init.detectLanguage({}) === initJavaScript);
    // Can request JavaScript with explicit name
    test.ok(init.detectLanguage({
      lang: 'javascript'
    }) === initJavaScript);
    // Can request JavaScript with abbr
    test.ok(init.detectLanguage({
      lang: 'js'
    }) === initJavaScript);
    // This won't request JavaScript init
    test.ok(init.detectLanguage({
      lang: 'something else'
    }) !== initJavaScript);
    test.done();
  },
  rustArgs: function(test) {
    test.expect(4);
    // No language arg does not mean Rust
    test.ok(init.detectLanguage({}) !== initRust);
    // Can request Rust with explicit name
    test.ok(init.detectLanguage({
      lang: 'rust'
    }) === initRust);
    // Can request Rust with abbr
    test.ok(init.detectLanguage({
      lang: 'rs'
    }) === initRust);
    // This won't request Rust init
    test.ok(init.detectLanguage({
      lang: 'whitespace'
    }) !== initRust);
    test.done();
  },
  pythonArgs: function(test) {
    test.expect(4);
    // No language arg does not mean Rust
    test.ok(init.detectLanguage({}) !== initPython);
    // Can request Rust with explicit name
    test.ok(init.detectLanguage({
      lang: 'python'
    }) === initPython);
    // Can request Rust with abbr
    test.ok(init.detectLanguage({
      lang: 'py'
    }) === initPython);
    // This won't request Rust init
    test.ok(init.detectLanguage({
      lang: 'morse-code'
    }) !== initPython);
    test.done();
  }
};

exports['init --lang rust'] = {
  setUp: (done) => {
    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn', function() {});
    this.logInfo = this.sandbox.stub(log, 'info', function() {});
    done();
  },
  tearDown: (done) => {
    this.sandbox.restore();
    done();
  },
  cargoVerifySucceed: (test) => {
    test.expect(3);
    // Stub our own exec so we don't try running cargo on the host cpu
    this.exec = this.sandbox.stub(cp, 'exec', (command, callback) => {
      // Ensure the command is cargo
      test.equal(command, 'cargo');
      // Reject to simulate no Rust or Cargo install
      callback();
    });

    // Stub the generating sample code so we don't write to fs
    this.generateRustSample = this.sandbox.stub(initRust, 'generateRustSample').returns(Promise.resolve());

    // Attempt to initialize a Rust projec
    init.initProject({
        lang: 'rust'
      })
      // It should not succeed
      .then(() => {
        // Ensure exec was called just once
        test.equal(this.exec.callCount, 1);
        test.equal(this.generateRustSample.callCount, 1);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'a rejection should not be served if cargo is installed');
      });
  },

  cargoVerifyFail: (test) => {
    test.expect(4);

    // Stub our own exec so we don't try running cargo on the host cpu
    this.exec = this.sandbox.stub(cp, 'exec', (command, callback) => {
      // Ensure the command is cargo
      test.equal(command, 'cargo');
      // Reject to simulate no Rust or Cargo install
      callback(new Error('undefined command: cargo'));
    });

    // Stub the generating sample code so we don't write to fs
    this.generateRustSample = this.sandbox.stub(initRust, 'generateRustSample').returns(Promise.resolve());

    // Attempt to initialize a Rust projec
    return init.initProject({
        lang: 'rust'
      })
      // It should not succeed
      .then(() => {
        test.ok(false, 'a rejection should be served if cargo is not installed');
      })
      .catch((err) => {
        // Ensure exec was called just once
        test.equal(this.exec.callCount, 1);
        // Ensure we did not attempt to generate Rust code
        test.equal(this.generateRustSample.callCount, 0);
        // Ensure we received an error
        test.ok(err instanceof Error);
        test.done();
      });
  }
};

exports['init --lang javascript'] = {
  setUp: (done) => {
    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn', function() {});
    this.logInfo = this.sandbox.stub(log, 'info', function() {});
    done();
  },
  tearDown: (done) => {
    this.sandbox.restore();
    done();
  },
};

exports['init --lang python'] = {
  setUp: (done) => {
    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn', function() {});
    this.logInfo = this.sandbox.stub(log, 'info', function() {});
    done();
  },
  tearDown: (done) => {
    this.sandbox.restore();
    done();
  },
};
