// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');

exports['Tessel.prototype.rename'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();

    this.getName = this.sandbox.stub(Tessel.prototype, 'getName', function() {
      return Promise.resolve('TheFakeName');
    });
    this._getMACAddress = this.sandbox.stub(Tessel.prototype, '_getMACAddress', function() {
      return Promise.resolve('TheFakeMACAddress');
    });
    this.resetMDNS = this.sandbox.stub(Tessel.prototype, 'resetMDNS', function() {
      return Promise.resolve();
    });
    this.setName = this.sandbox.spy(Tessel.prototype, 'setName');

    this.isValidName = this.sandbox.spy(Tessel, 'isValidName');
    this.renameTessel = this.sandbox.spy(controller, 'renameTessel');
    this.commitHostname = this.sandbox.spy(commands, 'commitHostname');
    this.openStdinToFile = this.sandbox.spy(commands, 'openStdinToFile');
    this.setHostname = this.sandbox.spy(commands, 'setHostname');
    this.setHostnameFlag = this.sandbox.spy(commands, 'setHostnameFlag');
    this.getHostname = this.sandbox.spy(commands, 'getHostname');
    this.logWarn = this.sandbox.stub(log, 'warn', function() {});
    this.logInfo = this.sandbox.stub(log, 'info', function() {});
    this.tessel = TesselSimulator();
    this.exec = this.sandbox.spy(this.tessel.connection, 'exec');
    this.closeTesselConnections = this.sandbox.stub(controller, 'closeTesselConnections');

    // When we get a listener that the Tessel process needs to close before advancing
    this.tessel._rps.on('newListener', (event) => {
      if (event === 'close') {
        setImmediate(() => {
          // Emit the close event to keep it going
          this.tessel._rps.emit('close');
        });
      }
    });

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.tessel._rps.removeAllListeners('newListener');
    this.sandbox.restore();
    done();
  },

  isValidName: function(test) {
    test.expect(2);

    // This needs more fleshing out.
    //
    test.equal(Tessel.isValidName('foo'), true);
    test.equal(Tessel.isValidName('foo-'), false);

    test.done();
  },

  renameTesselNoOpts: function(test) {
    test.expect(2);

    this.renameTessel().catch((err) => {
      test.equal(err, 'A new name must be provided.');
      test.equal(this.closeTesselConnections.callCount, 0);
      test.done();
    });
  },

  renameTesselInvalid: function(test) {
    test.expect(2);

    this.renameTessel({
      newName: '!@#$'
    }).catch((err) => {
      test.equal(err, 'Invalid name: !@#$. The name must be a valid hostname string. See http://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names.');
      test.equal(this.closeTesselConnections.callCount, 0);
      test.done();
    });
  },

  resetName: function(test) {
    test.expect(8);

    this.tessel.rename({
        reset: true
      })
      .then(() => {
        // When reset:
        // - the mac address is requested
        // - setName is called
        // - the connection executes the setHostName command
        test.equal(this._getMACAddress.callCount, 1);
        test.equal(this.setName.callCount, 1);
        test.equal(this.setHostname.callCount, 1);
        test.equal(this.setHostnameFlag.callCount, 1);
        test.equal(this.commitHostname.callCount, 1);
        test.equal(this.openStdinToFile.callCount, 1);

        test.ok(this.setHostname.lastCall.calledWith('Tessel-TheFakeMACAddress'));

        // getName is _not_ called.
        test.equal(this.getName.callCount, 0);

        test.done();
      });
  },

  validRename: function(test) {
    test.expect(7);

    this.tessel.rename({
        newName: 'ValidAndUnique'
      })
      .then(() => {
        // When valid rename:
        // - getName is called
        // - setName is called
        // - the connection executes the setHostName command
        test.equal(this.getName.callCount, 1);
        test.equal(this.setName.callCount, 1);
        test.equal(this.setHostname.callCount, 1);
        test.equal(this.setHostnameFlag.callCount, 1);
        test.equal(this.commitHostname.callCount, 1);
        test.equal(this.openStdinToFile.callCount, 1);
        test.ok(this.setHostname.lastCall.calledWith('ValidAndUnique'));

        test.done();
      });
  },

  validRenameSameAsCurrent: function(test) {
    test.expect(1);

    this.tessel.rename({
        newName: 'TheFakeName'
      })
      .then(() => {
        // When renamed with same current name:
        // - warning is logged
        test.equal(this.logWarn.callCount, 1);
        test.done();
      });
  },

  invalidRename: function(test) {
    test.expect(2);

    this.tessel.rename({
        newName: '...'
      })
      .then((value) => {
        test.equal(value, true, 'this should never be hit');
      })
      .catch(() => {
        // When invalid rename:
        // - name is checked
        // - getName is NOT called
        test.equal(this.isValidName.callCount, 1);
        test.equal(this.getName.callCount, 0);

        test.done();
      });
  },

  invalidSetName: function(test) {
    test.expect(3);

    this.tessel.setName('...')
      .then((value) => {
        test.equal(value, true, 'this should never be hit');
      })
      .catch(() => {
        // When invalid rename:
        // - name is checked
        // - the connection NEVER executes the setHostName command
        test.equal(this.isValidName.callCount, 1);
        // test.equal(this.tessel.connection.exec.callCount, 0);
        test.equal(this.setHostname.callCount, 0);
        test.equal(this.setHostnameFlag.callCount, 0);

        test.done();
      });
  },
};
