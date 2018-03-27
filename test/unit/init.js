'use strict';

// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['init.createNewProject()'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();

    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');

    this.lang = {
      generateProject: this.sandbox.spy()
    };

    this.lang = {
      js: {
        generateProject: this.sandbox.stub(init.js, 'generateProject').returns(Promise.resolve()),
      },
      py: {
        generateProject: this.sandbox.stub(init.py, 'generateProject').returns(Promise.resolve()),
      },
      rs: {
        generateProject: this.sandbox.stub(init.rs, 'generateProject').returns(Promise.resolve()),
      },
    };

    this.resolveLanguage = this.sandbox.spy(init, 'resolveLanguage');
    this.pathResolve = this.sandbox.spy(path, 'resolve');

    done();
  },
  tearDown(done) {
    this.sandbox.restore();
    done();
  },

  spinnerStop(test) {
    test.expect(1);

    init.createNewProject({
      directory: './',
      lang: 'javascript',
    }).then(() => {
      test.equal(this.spinnerStop.callCount, 1);
      test.done();
    });
  },

  directory(test) {
    test.expect(1);

    init.createNewProject({
      directory: './',
      lang: 'javascript',
    }).then(() => {
      test.equal(this.pathResolve.callCount, 0);
      test.done();
    });
  },

  noDirectory(test) {
    test.expect(2);

    init.createNewProject({
      lang: 'javascript',
    }).then(() => {
      test.equal(this.pathResolve.callCount, 1);
      test.equal(this.pathResolve.lastCall.args[0], '.');
      test.done();
    });
  },

  resolveLanguage: {
    js(test) {
      test.expect(3);

      init.createNewProject({
        directory: './',
        lang: 'js',
      }).then(() => {
        test.equal(this.resolveLanguage.callCount, 1);
        test.equal(this.resolveLanguage.lastCall.args[0], 'js');
        test.equal(this.lang.js.generateProject.callCount, 1);
        test.done();
      });
    },
    javascript(test) {
      test.expect(3);

      init.createNewProject({
        directory: './',
        lang: 'javascript',
      }).then(() => {
        test.equal(this.resolveLanguage.callCount, 1);
        test.equal(this.resolveLanguage.lastCall.args[0], 'javascript');
        test.equal(this.lang.js.generateProject.callCount, 1);
        test.done();
      });
    },
    py(test) {
      test.expect(3);

      init.createNewProject({
        directory: './',
        lang: 'py',
      }).then(() => {
        test.equal(this.resolveLanguage.callCount, 1);
        test.equal(this.resolveLanguage.lastCall.args[0], 'py');
        test.equal(this.lang.py.generateProject.callCount, 1);
        test.done();
      });
    },
    python(test) {
      test.expect(3);

      init.createNewProject({
        directory: './',
        lang: 'python',
      }).then(() => {
        test.equal(this.resolveLanguage.callCount, 1);
        test.equal(this.resolveLanguage.lastCall.args[0], 'python');
        test.equal(this.lang.py.generateProject.callCount, 1);
        test.done();
      });
    },
    rs(test) {
      test.expect(3);

      init.createNewProject({
        directory: './',
        lang: 'rs',
      }).then(() => {
        test.equal(this.resolveLanguage.callCount, 1);
        test.equal(this.resolveLanguage.lastCall.args[0], 'rs');
        test.equal(this.lang.rs.generateProject.callCount, 1);
        test.done();
      });
    },
    rust(test) {
      test.expect(3);

      init.createNewProject({
        directory: './',
        lang: 'rust',
      }).then(() => {
        test.equal(this.resolveLanguage.callCount, 1);
        test.equal(this.resolveLanguage.lastCall.args[0], 'rust');
        test.equal(this.lang.rs.generateProject.callCount, 1);
        test.done();
      });
    },

    unrecognized(test) {
      test.expect(2);

      this.resolveLanguage.restore();
      this.resolveLanguage = this.sandbox.stub(init, 'resolveLanguage').returns(null);

      init.createNewProject({
        directory: './',
        lang: 'rust',
      }).catch(error => {
        test.equal(error.toString(), 'Error: Unrecognized language selection.');
        test.equal(this.resolveLanguage.callCount, 1);
        test.done();
      });
    }
  },
};

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
    this.copy = this.sandbox.stub(fs, 'copy').callsFake((source, target, callback) => {
      callback();
    });
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  cargoVerifySucceed: function(test) {
    test.expect(3);
    // Stub our own exec so we don't try running cargo on the host cpu
    this.exec = this.sandbox.stub(cp, 'exec').callsFake((command, callback) => {
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
    this.exec = this.sandbox.stub(cp, 'exec').callsFake((command, callback) => {
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
  },

  'src/main.rs created': function(test) {
    test.expect(5);

    // Does not exist, will be created.
    this.exists = this.sandbox.stub(fs, 'exists').callsFake((filename, callback) => {
      callback(false);
    });

    this.mkdir = this.sandbox.stub(fs, 'mkdir').callsFake((dirname, callback) => {
      callback(false);
    });

    init.rs.createSampleProgram()
      .then(() => {
        test.equal(this.copy.callCount, 2);
        test.equal(this.copy.firstCall.args[0].endsWith(path.normalize('/resources/rust/Cargo.toml')), true);
        test.equal(this.copy.firstCall.args[1].endsWith(path.normalize('Cargo.toml')), true);
        test.equal(this.copy.lastCall.args[0].endsWith(path.normalize('/resources/rust/main.rs')), true);
        test.equal(this.copy.lastCall.args[1].endsWith(path.normalize('/src/main.rs')), true);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'a rejection should not be served if cargo is installed');
      });
  },
};

exports['init --lang=javascript'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.warn = this.sandbox.stub(log, 'warn');
    this.info = this.sandbox.stub(log, 'info');

    this.writeFile = this.sandbox.stub(fs, 'writeFile').callsFake((filename, encoding, callback) => {
      callback(null, {
        stub: true,
        filename
      });
    });
    this.readFile = this.sandbox.stub(fs, 'readFile').callsFake((filename, encoding, callback) => {
      callback(null, {
        stub: true,
        filename
      });
    });
    this.copy = this.sandbox.stub(fs, 'copy').callsFake((src, dest, callback) => {
      callback();
    });

    const projectDependencyPath = path.normalize('test/unit/fixtures/project-binary-modules/node_modules/release/package.json');

    this.globSync = this.sandbox.stub(glob, 'sync').callsFake(() => {
      return [
        projectDependencyPath
      ];
    });

    this.npm = {
      commands: {
        install(deps, callback) {
          callback();
        }
      },
      registry: {
        log: {
          level: 'warn'
        }
      }
    };

    this.npmLoad = this.sandbox.stub(npm, 'load').callsFake((callback) => {
      callback(null, this.npm);
    });

    done();
  },
  tearDown(done) {
    this.sandbox.restore();
    done();
  },


  allOperations(test) {
    test.expect(12);

    // THIS TEST ONLY ASSERTS THAT ALL EXPECTED
    // OPERATIONS ARE CALLED
    const operations = [{
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
      name: 'createNpmrc',
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

      this[operation.name] = this.sandbox.stub(init.js, operation.name).callsFake(() => Promise.resolve('{"a":1}'));
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

  loadNpmSuccess(test) {
    test.expect(1);

    init.js.loadNpm().then(() => {
      test.equal(this.npmLoad.callCount, 1);
      test.done();
    });
  },

  loadNpmFailure(test) {
    test.expect(2);

    this.npmLoad.restore();
    this.npmLoad = this.sandbox.stub(npm, 'load').callsFake((callback) => {
      callback(new Error('npm.load failed?'), {});
    });

    init.js.loadNpm().catch((error) => {
      test.equal(this.npmLoad.callCount, 1);
      test.equal(error.toString(), 'Error: npm.load failed?');
      test.done();
    });
  },

  readPackageJsonSuccess(test) {
    test.expect(1);

    this.readFile.restore();
    this.readFile = this.sandbox.stub(fs, 'readFile').callsFake((file, encoding, callback) => {
      callback(null, '{}');
    });

    init.js.readPackageJson().then(() => {
      test.equal(this.readFile.callCount, 1);
      test.done();
    });
  },

  readPackageJsonFailure(test) {
    test.expect(2);

    this.readFile.restore();
    this.readFile = this.sandbox.stub(fs, 'readFile').callsFake((file, encoding, callback) => {
      callback(new Error('fs.readFile failed?'), {});
    });

    init.js.readPackageJson().catch((error) => {
      test.equal(this.readFile.callCount, 1);
      test.equal(error.toString(), 'Error: fs.readFile failed?');
      test.done();
    });
  },

  writePackageJsonSuccess(test) {
    test.expect(1);

    this.writeFile.restore();
    this.writeFile = this.sandbox.stub(fs, 'writeFile').callsFake((file, data, callback) => {
      callback(null, '{}');
    });

    init.js.writePackageJson().then(() => {
      test.equal(this.writeFile.callCount, 1);
      test.done();
    });
  },

  writePackageJsonFailure(test) {
    test.expect(2);

    this.writeFile.restore();
    this.writeFile = this.sandbox.stub(fs, 'writeFile').callsFake((file, data, callback) => {
      callback(new Error('fs.writeFile failed?'), {});
    });

    init.js.writePackageJson().catch((error) => {
      test.equal(this.writeFile.callCount, 1);
      test.equal(error.toString(), 'Error: fs.writeFile failed?');
      test.done();
    });
  },

  prettyPrintJson(test) {
    test.expect(4);

    this.stringify = this.sandbox.stub(JSON, 'stringify');

    const data = {
      a: 1
    };

    init.js.prettyPrintJson(data);

    test.equal(this.stringify.callCount, 1);
    test.equal(this.stringify.lastCall.args[0], data);
    test.equal(this.stringify.lastCall.args[1], null);
    test.equal(this.stringify.lastCall.args[2], 2);


    test.done();
  },

  npmInstallRegistryLogLevel(test) {
    test.expect(3);

    this.loadNpm = this.sandbox.stub(init.js, 'loadNpm').callsFake(() => {
      return Promise.resolve(this.npm);
    });

    test.equal(this.npm.registry.log.level, 'warn');

    init.js.npmInstall(['test@1.1.1'])
      .then(() => {
        test.equal(this.npm.registry.log.level, 'silent');
        test.equal(this.loadNpm.callCount, 1);
        test.done();
      });
  },

  npmInstallNoDeps(test) {
    test.expect(1);

    this.loadNpm = this.sandbox.stub(init.js, 'loadNpm');

    init.js.npmInstall([])
      .then(() => {
        test.equal(this.loadNpm.callCount, 0);
        test.done();
      });
  },

  npmInstallWithDepsSuccess(test) {
    test.expect(2);

    const dependencies = [
      'debug@1.1.1',
      'linked@1.1.1',
      'missing@1.1.1',
      'release@1.1.1',
    ];

    const npm = {
      commands: {
        install(dependencies, callback) {
          test.ok(true);
          callback();
        },
      },
      registry: {
        log: {
          level: 'warn',
        },
      },
    };

    this.loadNpm = this.sandbox.stub(init.js, 'loadNpm').returns(Promise.resolve(npm));

    init.js.npmInstall(dependencies)
      .then(() => {
        test.equal(this.loadNpm.callCount, 1);
        test.done();
      });
  },
  npmInstallWithDepsFailure(test) {
    test.expect(2);

    const dependencies = [
      'debug@1.1.1',
      'linked@1.1.1',
      'missing@1.1.1',
      'release@1.1.1',
    ];

    const npm = {
      commands: {
        install(dependencies, callback) {
          test.ok(true);
          callback(new Error('npm.commands.install failed?'));
        },
      },
      registry: {
        log: {
          level: 'warn',
        },
      },
    };

    this.loadNpm = this.sandbox.stub(init.js, 'loadNpm').returns(Promise.resolve(npm));

    init.js.npmInstall(dependencies)
      .catch(error => {
        test.equal(error.toString(), 'Error: npm.commands.install failed?');
        test.done();
      });
  },

  getDependencies(test) {
    test.expect(1);

    const parsedPackageJson = {
      name: 'project-binary-modules',
      version: '0.0.1',
      description: 'project-binary-modules',
      main: 'index.js',
      dependencies: {
        debug: '1.1.1',
        linked: '1.1.1',
        missing: '1.1.1',
        release: '1.1.1'
      }
    };

    const dependencies = init.js.getDependencies(parsedPackageJson);

    test.deepEqual(dependencies, [
      'debug@1.1.1',
      'linked@1.1.1',
      'missing@1.1.1',
      'release@1.1.1',
    ]);
    test.done();
  },

  getDependenciesInstalledByAuthorNoSaved(test) {
    test.expect(1);

    const parsedPackageJson = {
      name: 'project-binary-modules',
      version: '0.0.1',
      description: 'project-binary-modules',
      main: 'index.js',
      dependencies: {}
    };

    const dependencies = init.js.getDependencies(parsedPackageJson);

    test.deepEqual(dependencies, [
      'release@1.1.1',
    ]);
    test.done();
  },

  getDependenciesInstalledByAuthorPlusSaved(test) {
    test.expect(1);

    const parsedPackageJson = {
      name: 'project-binary-modules',
      version: '0.0.1',
      description: 'project-binary-modules',
      main: 'index.js',
      dependencies: {
        debug: '1.1.1',
        linked: '1.1.1',
      }
    };

    const dependencies = init.js.getDependencies(parsedPackageJson);

    test.deepEqual(dependencies, [
      'debug@1.1.1',
      'linked@1.1.1',
      'release@1.1.1',
    ]);
    test.done();
  },

  getDependenciesInstalledByAuthorDeduped(test) {
    test.expect(1);

    const parsedPackageJson = {
      name: 'project-binary-modules',
      version: '0.0.1',
      description: 'project-binary-modules',
      main: 'index.js',
      dependencies: {
        release: '1.1.1',
      }
    };

    const dependencies = init.js.getDependencies(parsedPackageJson);

    test.deepEqual(dependencies, [
      'release@1.1.1',
    ]);
    test.done();
  },

  getDependenciesEmpty(test) {
    test.expect(1);

    const parsedPackageJson = {
      name: 'project-binary-modules',
      version: '0.0.1',
      description: 'project-binary-modules',
      main: 'index.js'
    };

    const dependencies = init.js.getDependencies(parsedPackageJson);

    test.deepEqual(dependencies, ['release@1.1.1']);
    test.done();
  },

  resolveNpmConfig(test) {
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

  createSampleProgram(test) {
    test.expect(3);

    this.exists = this.sandbox.stub(fs, 'exists').callsFake((filename, callback) => {
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

  createSampleProgramExists(test) {
    test.expect(1);

    this.exists = this.sandbox.stub(fs, 'exists').callsFake((filename, callback) => {
      callback(true);
    });

    init.js.createSampleProgram()
      .then(() => {
        test.equal(this.copy.callCount, 0);
        test.done();
      });
  },

  createTesselinclude(test) {
    test.expect(3);

    this.exists = this.sandbox.stub(fs, 'exists').callsFake((filename, callback) => {
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

  createTesselincludeExists(test) {
    test.expect(1);

    this.exists = this.sandbox.stub(fs, 'exists').callsFake((filename, callback) => {
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
