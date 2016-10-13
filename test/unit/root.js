// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['tessel.root'] = {
  setUp: function(done) {
    var testContext = this;
    this.sandbox = sinon.sandbox.create();
    this.spinnerStart = this.sandbox.stub(log.spinner, 'start');
    this.spinnerStop = this.sandbox.stub(log.spinner, 'stop');
    this.spawn = this.sandbox.stub(cp, 'spawn', () => {
      var child = new Emitter();

      setImmediate(() => {
        child.emit('close');
      });

      return child;
    });
    this.standardTesselCommand = this.sandbox.spy(controller, 'standardTesselCommand');
    this.logWarn = this.sandbox.stub(log, 'warn', function() {});
    this.logInfo = this.sandbox.stub(log, 'info', function() {});

    this.seeker = this.sandbox.stub(discover, 'TesselSeeker', function Seeker() {
      this.start = function(options) {
        testContext.activeSeeker = this;
        setTimeout(() => this.stop(), options.timeout);
        return this;
      };
      this.stop = function() {
        this.emit('end');
        return this;
      };
    });
    util.inherits(this.seeker, Emitter);
    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  spawnNotCalledNoTessels: function(test) {
    test.expect(2);

    // Root should call closeFailed Command if no Tessels were found
    this.finishWithError = this.sandbox.stub(t2, 'closeFailedCommand', () => {
      // We called standardTesselCommand to fetch the Tessel
      test.equal(this.standardTesselCommand.callCount, 1);
      // We did not spawn a root process because we did not have a Tessel
      test.equal(this.spawn.callCount, 0);
      test.done();
    });

    // Tell the CLI to start a root connection
    t2(['root', '-t', '0.001']);
  },

  spawnCalledWithLANTessel: function(test) {
    test.expect(3);

    // Root should call closeFailed Command if no Tessels were found
    this.finishWithSuccess = this.sandbox.stub(t2, 'closeSuccessfulCommand', () => {
      // We called standardTesselCommand to fetch the Tessel
      test.ok(this.standardTesselCommand.calledOnce);
      // We did not spawn a root process because we did not have a Tessel
      test.ok(this.spawn.calledOnce);
      // Make sure the proper args were used
      test.ok(this.spawn.calledWith(
        // We are using the ssh command
        'ssh',
        // Passing in the appropriate key to the right IP Address
        ['-i', Tessel.LOCAL_AUTH_KEY, 'root@' + tessel.lanConnection.ip],
        // We are piping std streams to the process
        {
          stdio: 'inherit'
        }
      ));
      test.done();
    });

    // Tell the CLI to start a root connection
    t2(['root', '-t', '0.001']);

    // Create a new Tessel
    var tessel = new Tessel({
      connectionType: 'LAN'
    });
    // Give it a name
    tessel.name = 'Frank';
    tessel.lanConnection.ip = '1.1.1.1';

    // Interval until an active seeker exists...
    this.interval = setInterval(() => {
      if (this.activeSeeker) {
        clearInterval(this.interval);
        this.activeSeeker.emit('tessel', tessel);
      }
    }, 1);
  },
};
