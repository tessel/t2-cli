var rust = require('../../../lib/tessel/deployment/rust');

var sandbox = sinon.sandbox.create();

exports['deploy.rust'] = {
  setUp: function(done) {
    this.info = sandbox.stub(log, 'info');
    this.warn = sandbox.stub(log, 'warn');
    this.error = sandbox.stub(log, 'error');

    this.outgoingResponse = new stream.Readable();
    this.incomingRequest = new stream.Writable();

    this.outgoingResponse._read = () => {};

    this.httpRequest = sandbox.stub(http, 'request', (options, cb) => {
      setImmediate(() => cb(this.outgoingResponse));
      return this.incomingRequest;
    });

    this.tarPack = sandbox.spy(tar, 'Pack');

    done();
  },
  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  remoteRustCompilationSuccess: function(test) {

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
    rust.remoteRustCompilation({
        rustCC: url.format({
          protocol: protocol,
          hostname: hostname,
          port: port
        }),
        target: DEPLOY_DIR_RS
      })
      .then(() => {

        // Check the options of the call to http
        test.equal(this.httpRequest.callCount, 1);
        test.equal(this.httpRequest.lastCall.args[0].host, hostname);
        test.equal(this.httpRequest.lastCall.args[0].port, port);
        test.equal(this.httpRequest.lastCall.args[0].path, '/rust-compile');
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

  remoteRustCompilationError: function(test) {

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
    rust.remoteRustCompilation({
        rustCC: 'remote-server',
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

  remoteRustCompilationStderr: function(test) {

    test.expect(3);

    // stderr will be written to when compilation fails
    var stderr = 'Compilation failed: you need to camelcase everything.';

    // Cross compilation result returned
    var result = JSON.stringify({
      stderr: stderr,
      stdout: '',
      binary: null,
    });

    // When we get a write to the post request
    this.incomingRequest._write = (chunk, enc, callback) => {
      callback();
    };

    // Star the remote rust compilation process to our mock server
    rust.remoteRustCompilation({
        rustCC: 'remote-server',
        target: DEPLOY_DIR_RS
      })
      .catch((err) => {
        // Check the options of the call to http
        test.equal(this.httpRequest.callCount, 1);

        // Ensure it fails with the provided error
        test.equal(stderr, err.message);

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

  // The pre bundle step ensures that the Rust entrypoint is set to the
  // name of the binary instead any of the code files of the project
  rustPreBundle: function(test) {

    test.expect(1);

    // Gather the project info for the project we'll target
    var cargoToml = toml.parse(fs.readFileSync(path.join(DEPLOY_DIR_RS, 'Cargo.toml'), 'utf8'));

    var opts = {
      target: DEPLOY_DIR_RS,
      resolvedEntryPoint: 'src/main.rs',
    };

    rust.preBundle(opts)
      .then(() => {
        // Ensure the resolved entry point was udpated to the package name
        test.equal(opts.resolvedEntryPoint, cargoToml.package.name);

        test.done();
      });
  }
};
