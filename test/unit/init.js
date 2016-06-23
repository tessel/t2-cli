exports['init.resolveLanguage()'] = {
  setUp: function(done) {
    done();
  },
  tearDown: function(done) {
    done();
  },
  javascript: function(test) {
    test.expect(4);
    // No language arg indicates JavaScript by default
    test.equal(init.resolveLanguage(), init.js);
    // Can request JavaScript with explicit name
    test.equal(init.resolveLanguage('javascript'), init.js);
    // Can request JavaScript with abbr
    test.equal(init.resolveLanguage('js'), init.js);
    // This won't request JavaScript init
    test.equal(init.resolveLanguage('something else'), null);
    test.done();
  },
  rust: function(test) {
    test.expect(4);
    // No language arg does not mean Rust
    test.notEqual(init.resolveLanguage(), init.rs);
    // Can request Rust with explicit name
    test.equal(init.resolveLanguage('rust'), init.rs);
    // Can request Rust with abbr
    test.equal(init.resolveLanguage('rs'), init.rs);
    // This won't request Rust init
    test.equal(init.resolveLanguage('whitespace'), null);
    test.done();
  },
  python: function(test) {
    test.expect(4);
    // No language arg does not mean Rust
    test.notEqual(init.resolveLanguage(), init.py);
    // Can request Rust with explicit name
    test.equal(init.resolveLanguage('python'), init.py);
    // Can request Rust with abbr
    test.equal(init.resolveLanguage('py'), init.py);
    // This won't request Rust init
    test.equal(init.resolveLanguage('morse-code'), null);
    test.done();
  }
};

exports['init --lang=rust'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  cargoVerifySucceed: function(test) {
    test.expect(3);
    // Stub our own exec so we don't try running cargo on the host cpu
    this.exec = this.sandbox.stub(cp, 'exec', (command, callback) => {
      // Ensure the command is cargo
      test.equal(command, 'cargo');
      // Reject to simulate no Rust or Cargo install
      callback();
    });

    // Stub the generating sample code so we don't write to fs
    this.createSampleProgram = this.sandbox.stub(init.rs, 'createSampleProgram').returns(Promise.resolve());

    // Attempt to initialize a Rust projec
    init.createNewProject({
        lang: 'rust'
      })
      // It should not succeed
      .then(() => {
        // Ensure exec was called just once
        test.equal(this.exec.callCount, 1);
        test.equal(this.createSampleProgram.callCount, 1);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'a rejection should not be served if cargo is installed');
      });
  },

  cargoVerifyFail: function(test) {
    test.expect(4);

    // Stub our own exec so we don't try running cargo on the host cpu
    this.exec = this.sandbox.stub(cp, 'exec', (command, callback) => {
      // Ensure the command is cargo
      test.equal(command, 'cargo');
      // Reject to simulate no Rust or Cargo install
      callback(new Error('undefined command: cargo'));
    });

    // Stub the generating sample code so we don't write to fs
    this.createSampleProgram = this.sandbox.stub(init.rs, 'createSampleProgram').returns(Promise.resolve());

    // Attempt to initialize a Rust projec
    init.createNewProject({
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
        test.equal(this.createSampleProgram.callCount, 0);
        // Ensure we received an error
        test.ok(err instanceof Error);
        test.done();
      });
  }
};

exports['init --lang=javascript'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.writeFile = this.sandbox.stub(fs, 'writeFile', (filename, encoding, callback) => {
      callback(null, {
        stub: true,
        filename
      });
    });
    this.readFile = this.sandbox.stub(fs, 'readFile', (filename, encoding, callback) => {
      callback(null, {
        stub: true,
        filename
      });
    });
    this.copy = this.sandbox.stub(fs, 'copy', (src, dest, callback) => {
      callback();
    });


    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },


  allOperations: function(test) {
    test.expect(11);

    // THIS TEST ONLY ASSERTS THAT ALL EXPECTED
    // OPERATIONS ARE CALLED
    var operations = [{
      name: 'loadNpm',
      callCount: 1,
    }, {
      name: 'resolveNpmConfig',
      callCount: 1,
    }, {
      name: 'buildJSON',
      callCount: 1,
    }, {
      name: 'prettyPrintJson',
      callCount: 1,
    }, {
      name: 'writePackageJson',
      callCount: 1,
    }, {
      name: 'readPackageJson',
      callCount: 2,
    }, {
      name: 'getDependencies',
      callCount: 1,
    }, {
      name: 'npmInstall',
      callCount: 1,
    }, {
      name: 'createTesselinclude',
      callCount: 1,
    }, {
      name: 'createSampleProgram',
      callCount: 1,
    }, ];

    operations.forEach(operation => {
      if (this[operation.name] && this[operation.name].restore) {
        this[operation.name].restore();
      }

      this[operation.name] = this.sandbox.stub(init.js, operation.name, () => Promise.resolve('{"a":1}'));
    });

    init.js.generateProject({})
      .then(() => {
        test.ok(true);
        operations.forEach(operation => {
          test.equal(init.js[operation.name].callCount, operation.callCount);
        });
        test.done();
      });
  },

  resolveNpmConfig: function(test) {
    test.expect(1);

    init.js.resolveNpmConfig({
        config: {
          list: {
            'a': 1,
            'b': 2,
            'c': 3
          }
        }
      })
      .then((list) => {
        test.deepEqual(list, {
          a: 1,
          b: 2,
          c: 3
        });
        test.done();
      });
  },

  createSampleProgram: function(test) {
    test.expect(3);

    this.exists = this.sandbox.stub(fs, 'exists', (filename, callback) => {
      callback(false);
    });


    init.js.createSampleProgram()
      .then(() => {
        test.equal(this.copy.callCount, 1);
        test.equal(this.copy.lastCall.args[0].endsWith(path.normalize('resources/javascript/index.js')), true);
        test.equal(this.copy.lastCall.args[1].endsWith(path.normalize('index.js')), true);
        test.done();
      });
  },

  createSampleProgramExists: function(test) {
    test.expect(1);

    this.exists = this.sandbox.stub(fs, 'exists', (filename, callback) => {
      callback(true);
    });

    init.js.createSampleProgram()
      .then(() => {
        test.equal(this.copy.callCount, 0);
        test.done();
      });
  },

  createTesselinclude: function(test) {
    test.expect(3);

    this.exists = this.sandbox.stub(fs, 'exists', (filename, callback) => {
      callback(false);
    });

    init.js.createTesselinclude()
      .then(() => {
        test.equal(this.copy.callCount, 1);
        test.equal(this.copy.lastCall.args[0].endsWith(path.normalize('resources/javascript/.tesselinclude')), true);
        test.equal(this.copy.lastCall.args[1].endsWith(path.normalize('.tesselinclude')), true);
        test.done();
      });
  },

  createTesselincludeExists: function(test) {
    test.expect(1);

    this.exists = this.sandbox.stub(fs, 'exists', (filename, callback) => {
      callback(true);
    });

    init.js.createTesselinclude()
      .then(() => {
        test.equal(this.copy.callCount, 0);
        test.done();
      });
  },
};

exports['init --lang=python'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
};
