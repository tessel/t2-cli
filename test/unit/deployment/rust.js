// Test dependencies are required and exposed in common/bootstrap.js
require('../../common/bootstrap');

var sandbox = sinon.sandbox.create();

exports['deploy.rust'] = {
  setUp(done) {
    this.info = sandbox.stub(log, 'info');
    this.warn = sandbox.stub(log, 'warn');
    this.error = sandbox.stub(log, 'error');

    this.outgoingResponse = new stream.Readable();
    this.incomingRequest = new stream.Writable();

    this.outgoingResponse._read = () => {};

    this.ifReachable = sandbox.stub(remote, 'ifReachable').returns(Promise.resolve());
    this.httpRequest = sandbox.stub(http, 'request').callsFake((options, cb) => {
      setImmediate(() => cb(this.outgoingResponse));
      return this.incomingRequest;
    });

    this.tarPack = sandbox.spy(tar, 'Pack');

    done();
  },
  tearDown(done) {
    sandbox.restore();
    done();
  },

  remoteRustCompilationSuccess(test) {

    test.expect(8);

    // Elements of cross compilation server address
    var protocol = 'http';
    var hostname = 'localhost';
    var port = '8080';

    // Cross compilation result returned
    var result = JSON.stringify({
      error: undefined,
      stderr: '',
      stdout: 'Compilation was wildly successful',
      binary: new Buffer('compiled binary', 'base64'),
    });

    // Buffer to store incoming chunks of the tarred project directory
    var receivedBuffers = [];
    // When we get a write to the post request
    this.incomingRequest._write = (chunk, enc, callback) => {
      // Save the incoming chunk
      receivedBuffers.push(chunk);
      // And continue the flow
      callback();
    };

    // Star the remote rust compilation process to our mock server
    deployment.rs.remoteRustCompilation({
        rustcc: url.format({
          protocol: protocol,
          hostname: hostname,
          port: port
        }),
        target: DEPLOY_DIR_RS,
        resolvedEntryPoint: 'charmander',
      })
      .then(() => {
        // Check the options of the call to http
        test.equal(this.httpRequest.callCount, 1);
        test.equal(this.httpRequest.lastCall.args[0].host, hostname);
        test.equal(this.httpRequest.lastCall.args[0].port, port);
        test.equal(this.httpRequest.lastCall.args[0].path, '/rust-compile?target=charmander');
        test.equal(this.httpRequest.lastCall.args[0].method, 'POST');

        // Make sure tar pack was called with the correct target
        test.equal(this.tarPack.callCount, 1);

        // Check that stdout was displayed
        test.equal(this.info.callCount, 2);

        var testPackingComplete = (testBuffer) => {

          // Concat the received buffers into one buffer representing the tarred
          // project sent to the cross compilation server
          receivedBuffers = Buffer.concat(receivedBuffers);
          // Make sure the two buffers are exactly equal (to ensure we tarred
          // the proper folder effectively)
          test.equal(receivedBuffers.compare(testBuffer), 0);
          // Finish the test
          test.done();
        };

        // Check the size of the tarball by
        // creating an outgoing tar packer for our template project
        var outgoingPacker = tar.Pack({
          noProprietary: true
        });

        var concatStream = concat(testPackingComplete);

        // Send the project directory through the tar packer into the concat cb
        fstream.Reader({
            path: DEPLOY_DIR_RS,
            type: 'Directory'
          })
          .pipe(outgoingPacker)
          .pipe(concatStream);

      });

    // When the incoming project folder finishes being sent
    this.incomingRequest.once('finish', () => {
      // Write the result to the stream
      this.outgoingResponse.push(result);
      // End the stream
      this.outgoingResponse.push(null);
    });
  },

  remoteRustCompilationMissingBinary(test) {
    test.expect(1);

    // Elements of cross compilation server address
    var protocol = 'http';
    var hostname = 'localhost';
    var port = '8080';

    // Cross compilation result returned
    var result = JSON.stringify({
      error: undefined,
      stderr: '',
      stdout: 'Compilation was wildly successful',
      binary: null,
    });

    // Buffer to store incoming chunks of the tarred project directory
    var receivedBuffers = [];
    // When we get a write to the post request
    this.incomingRequest._write = (chunk, enc, callback) => {
      // Save the incoming chunk
      receivedBuffers.push(chunk);
      // And continue the flow
      callback();
    };

    // Star the remote rust compilation process to our mock server
    deployment.rs.remoteRustCompilation({
        rustcc: url.format({
          protocol: protocol,
          hostname: hostname,
          port: port
        }),
        target: DEPLOY_DIR_RS,
        resolvedEntryPoint: 'charmander',
      })
      .catch(error => {
        test.equal(error.toString(), 'Error: Neither binary nor error returned by cross compilation server.');
        test.done();
      });

    // When the incoming project folder finishes being sent
    this.incomingRequest.once('finish', () => {
      // Write the result to the stream
      this.outgoingResponse.push(result);
      // End the stream
      this.outgoingResponse.push(null);
    });
  },

  remoteRustCompilationRespondsWithInvalidJSON(test) {
    test.expect(1);

    this.httpRequest.restore();
    this.httpRequest = sandbox.stub(http, 'request').callsFake((options, handler) => {
      var emitter = new Emitter();

      handler(emitter);

      emitter.emit('data', new Buffer('{'));
      emitter.emit('end');

      var duplex = stream.Duplex();

      duplex._write = x => x;

      return duplex;
    });


    var protocol = 'http';
    var hostname = 'localhost';
    var port = '8080';

    deployment.rs.remoteRustCompilation({
        rustcc: url.format({
          protocol: protocol,
          hostname: hostname,
          port: port
        }),
        target: DEPLOY_DIR_RS,
        resolvedEntryPoint: 'charmander',
      })
      .catch(error => {
        test.equal(
          error,
          tags.stripIndent `
          Please file an issue on https://github.com/tessel/t2-cli with the following:
          You received an invalid JSON response from the cross-compilation server.
              {` // <-- totally intentional. DO NOT CHANGE
        );
        test.done();
      });
  },

  remoteRustCompilationRespondsWithError(test) {
    test.expect(1);

    this.httpRequest.restore();
    this.httpRequest = sandbox.stub(http, 'request').callsFake((options, handler) => {
      var emitter = new Emitter();

      handler(emitter);

      emitter.emit('data', new Buffer('{}'));
      emitter.emit('error', 'DEAD!');

      var duplex = stream.Duplex();

      duplex._write = x => x;

      return duplex;
    });


    var protocol = 'http';
    var hostname = 'localhost';
    var port = '8080';

    deployment.rs.remoteRustCompilation({
        rustcc: url.format({
          protocol: protocol,
          hostname: hostname,
          port: port
        }),
        target: DEPLOY_DIR_RS,
        resolvedEntryPoint: 'charmander',
      })
      .catch(error => {
        test.equal(error, 'DEAD!');
        test.done();
      });
  },

  remoteRustCompilationError(test) {

    test.expect(3);

    var spawnError = 'Child spawn process failed for remote compilation';

    // Cross compilation result returned
    var result = JSON.stringify({
      error: spawnError,
      stderr: '',
      stdout: '',
      binary: null,
    });

    // When we get a write to the post request
    this.incomingRequest._write = (chunk, enc, callback) => {
      callback();
    };

    // Star the remote rust compilation process to our mock server
    deployment.rs.remoteRustCompilation({
        rustcc: 'remote-server',
        target: DEPLOY_DIR_RS
      })
      .catch((err) => {

        // Check the options of the call to http
        test.equal(this.httpRequest.callCount, 1);

        // Ensure it fails with the provided error
        test.equal(spawnError, err.message);

        // Ensure that this error is an Error Oject
        test.ok(err instanceof Error);

        // We have finished the test
        test.done();
      });

    // When the incoming project folder finishes being sent
    this.incomingRequest.once('finish', () => {
      // Write the result to the stream
      this.outgoingResponse.push(result);
      // End the stream
      this.outgoingResponse.push(null);
    });
  },

  remoteRustCompilationStderr(test) {

    test.expect(2);

    // stderr will be written to when compilation fails
    var stderr = 'Compilation failed: you need to camelcase everything.';

    // Cross compilation result returned
    var result = JSON.stringify({
      stderr: stderr,
      stdout: '',
      binary: new Buffer(0),
    });

    // When we get a write to the post request
    this.incomingRequest._write = (chunk, enc, callback) => {
      callback();
    };

    // Star the remote rust compilation process to our mock server
    deployment.rs.remoteRustCompilation({
        rustcc: 'remote-server',
        target: DEPLOY_DIR_RS
      })
      .then(() => {
        // Check the options of the call to http
        test.equal(this.httpRequest.callCount, 1);

        // Ensure it prints out the standard error
        test.equal(this.info.secondCall.args[0], stderr);

        // We have finished the test
        test.done();
      });

    // When the incoming project folder finishes being sent
    this.incomingRequest.once('finish', () => {
      // Write the result to the stream
      this.outgoingResponse.push(result);
      // End the stream
      this.outgoingResponse.push(null);
    });
  },

  // The pre bundle step ensures that the Rust entrypoint is set to the
  // name of the binary instead any of the code files of the project
  rustPreBundle(test) {

    test.expect(1);

    this.checkSdk = sandbox.stub(rust, 'checkSdk').returns(Promise.resolve());
    this.checkRust = sandbox.stub(rust, 'checkRust').returns(Promise.resolve());
    this.checkBinaryName = sandbox.stub(rust, 'checkBinaryName').returns(Promise.resolve());

    var opts = {
      target: DEPLOY_DIR_RS,
      resolvedEntryPoint: 'hello',
    };

    // Ensure the resolved entry point is resolved to the binary name.
    deployment.rs.preBundle(opts)
      .then(() => {
        test.equal(opts.resolvedEntryPoint, 'hello');
      }, error => {
        test.ok(false, error.toString());
      })
      .then(() => test.done());
  },

  rustTarBundleLocal(test) {
    test.expect(4);

    this.remoteRustCompilation = sandbox.stub(deployment.rs, 'remoteRustCompilation').callsFake(() => Promise.resolve(null));

    this.runBuild = sandbox.stub(rust, 'runBuild').callsFake(() => Promise.resolve(__filename));

    var opts = {
      rustcc: false,
    };

    // Ensure the resolved entry point is resolved to the binary name.
    deployment.rs.tarBundle(opts)
      .then((tarball) => {
        test.ok(Buffer.isBuffer(tarball), 'tarball should be buffer');
        test.equal(this.remoteRustCompilation.callCount, 0);
        test.equal(this.runBuild.callCount, 1);
        test.deepEqual(this.runBuild.lastCall.args[0], {
          isCli: true,
          binary: undefined,
          path: undefined
        });
      }, error => {
        test.ok(false, error.toString());
      })
      .then(() => test.done());
  },

  rustTarBundleRemote(test) {
    test.expect(4);

    this.remoteRustCompilation = sandbox.stub(deployment.rs, 'remoteRustCompilation').callsFake(() => Promise.resolve(new Buffer([])));

    this.runBuild = sandbox.stub(rust, 'runBuild').callsFake(() => Promise.resolve(null));

    var opts = {
      rustcc: true,
    };

    // Ensure the resolved entry point is resolved to the binary name.
    deployment.rs.tarBundle(opts)
      .then((tarball) => {
        test.ok(Buffer.isBuffer(tarball), 'tarball should be buffer');
        test.equal(this.runBuild.callCount, 0);
        test.equal(this.remoteRustCompilation.callCount, 1);
        test.deepEqual(this.remoteRustCompilation.lastCall.args[0], opts);
      }, error => {
        test.ok(false, error.toString());
      })
      .then(() => test.done());
  },

  checkBinaryNames(test) {
    test.expect(2);

    this.cargoMetadata = sandbox.stub(rust, 'cargoMetadata').callsFake(() => Promise.resolve({
      'packages': [{
        'name': 'blinky',
        'version': '0.0.1',
        'id': 'blinky 0.0.1 (path+file:///Users/tim/tcr/test/rust-blinky)',
        'source': null,
        'dependencies': [{
          'name': 'tessel',
          'source': 'registry+https://github.com/rust-lang/crates.io-index',
          'req': '^0.2.0',
          'kind': null,
          'optional': false,
          'uses_default_features': true,
          'features': [

          ],
          'target': null
        }],
        'targets': [{
          'kind': [
            'bin'
          ],
          'name': 'blinky',
          'src_path': '/Users/tim/tcr/test/rust-blinky/src/main.rs'
        }],
        'features': {

        },
        'manifest_path': '/Users/tim/tcr/test/rust-blinky/Cargo.toml'
      }],
      'resolve': null,
      'version': 1
    }));

    // Ensure the resolved entry point is resolved to the binary name.
    rust.checkBinaryName({
        isCli: false,
        binary: 'blinky',
        path: __filename
      })
      .then(dest => {
        test.equals(dest.name, 'blinky');
      }, error => {
        test.ok(false, error.toString());
      })
      .then(() => rust.checkBinaryName({
        isCli: false,
        binary: 'dummy',
        path: __filename
      }))
      .then(() => {
        test.ok(false, 'Name should not have matched.');
      }, error => {
        test.ok(true, error.toString());
      })
      .then(() => test.done());
  },
};

exports['deployment.rs.preBundle'] = {
  setUp(done) {
    done();
  },

  tearDown(done) {
    done();
  },

  rustcc(test) {
    deployment.rs.preBundle({
      rustcc: true
    }).then(() => {
      test.done();
    });
  },
};

exports['deployment.rs.meta'] = {
  setUp(done) {
    done();
  },

  tearDown(done) {
    done();
  },

  checkConfiguration(test) {
    test.expect(1);
    var config = deployment.rs.meta.checkConfiguration('a', 'b', 'c');
    test.deepEqual(config, {
      basename: 'a',
      program: 'c'
    });
    test.done();
  },

  shell(test) {
    test.expect(1);
    var shell = deployment.rs.meta.shell({
      resolvedEntryPoint: 'foo',
      subargs: ['-a', '-b', '--thing=whatever'],
    });
    var expect = tags.stripIndent `
    #!/bin/sh
    exec /app/remote-script/foo -a -b --thing=whatever
    `;
    test.equal(shell, expect);
    test.done();
  },
};
