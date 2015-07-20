var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var controller = require('../../lib/controller');
var TesselSimulator = require('../common/tessel-simulator');

exports['Tessel.prototype.rename'] = {
  setUp: function(done) {
    var self = this;

    this.getName = sinon.stub(Tessel.prototype, 'getName', function() {
      return new Promise(function(resolve) {
        resolve('TheFakeName');
      });
    });
    this._getMACAddress = sinon.stub(Tessel.prototype, '_getMACAddress', function() {
      return new Promise(function(resolve) {
        resolve('TheFakeMACAddress');
      });
    });

    this.isValidName = sinon.spy(Tessel, 'isValidName');
    this.renameTessel = sinon.spy(controller, 'renameTessel');
    this.setName = sinon.spy(Tessel.prototype, 'setName');
    this.setHostname = sinon.spy(commands, 'setHostname');
    this.getHostname = sinon.spy(commands, 'getHostname');
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});
    this.tessel = TesselSimulator();
    this.exec = sinon.spy(this.tessel.connection, 'exec');

    function closeAdvance(event) {
      if (event === 'close') {
        setImmediate(function() {
          // Emit the close event to keep it going
          self.tessel._rps.emit('close');
        });
      }
    }

    // When we get a listener that the Tessel process needs to close before advancing
    this.tessel._rps.on('newListener', closeAdvance);

    done();
  },

  tearDown: function(done) {
    this.tessel.mockClose();
    this.isValidName.restore();
    this.renameTessel.restore();
    this.getName.restore();
    this.setName.restore();
    this._getMACAddress.restore();
    this.setHostname.restore();
    this.getHostname.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
    this.tessel._rps.removeAllListeners('newListener');
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
    test.expect(1);

    this.renameTessel().catch(function(error) {
      test.equal(error, 'A new name must be provided.');
      test.done();
    });
  },

  renameTesselInvalid: function(test) {
    test.expect(1);

    this.renameTessel({
      newName: '!@#$'
    }).catch(function(error) {
      test.equal(error, 'Invalid name: !@#$. The name must be a valid hostname string. See http://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_host_names.');
      test.done();
    });
  },

  resetName: function(test) {
    test.expect(6);

    var self = this;

    this.tessel.rename({
        reset: true
      })
      .then(function nameReset() {
        // When reset:
        // - the mac address is requested
        // - setName is called
        // - the connection executes the setHostName command
        test.equal(self._getMACAddress.callCount, 1);
        test.equal(self.setName.callCount, 1);
        test.equal(self.exec.callCount, 5);
        test.equal(self.setHostname.callCount, 1);
        test.ok(self.setHostname.lastCall.calledWith('Tessel-TheFakeMACAddress'));

        // getName is _not_ called.
        test.equal(self.getName.callCount, 0);

        test.done();
      });
  },

  validRename: function(test) {
    var self = this;
    test.expect(5);

    this.tessel.rename({
        newName: 'ValidAndUnique'
      })
      .then(function renamed() {
        // When valid rename:
        // - getName is called
        // - setName is called
        // - the connection executes the setHostName command
        test.equal(self.getName.callCount, 1);
        test.equal(self.setName.callCount, 1);
        test.equal(self.exec.callCount, 5);
        test.equal(self.setHostname.callCount, 1);
        test.ok(self.setHostname.lastCall.calledWith('ValidAndUnique'));

        test.done();
      });
  },

  validRenameSameAsCurrent: function(test) {
    var self = this;
    test.expect(1);

    this.tessel.rename({
        newName: 'TheFakeName'
      })
      .then(function done() {
        // When renamed with same current name:
        // - warning is logged
        test.equal(self.logsWarn.callCount, 1);
        test.done();
      });
  },

  invalidRename: function(test) {
    var self = this;
    test.expect(2);

    this.tessel.rename({
        newName: '...'
      }).then(function(value) {
        test.equal(value, true, 'this should never be hit');
      })
      .catch(function() {
        // When invalid rename:
        // - name is checked
        // - getName is NOT called
        test.equal(self.isValidName.callCount, 1);
        test.equal(self.getName.callCount, 0);

        test.done();
      });
  },

  invalidSetName: function(test) {
    var self = this;
    test.expect(2);

    this.tessel.setName('...')
      .then(function(value) {
        test.equal(value, true, 'this should never be hit');
      })
      .catch(function() {
        // When invalid rename:
        // - name is checked
        // - the connection NEVER executes the setHostName command
        test.equal(self.isValidName.callCount, 1);
        // test.equal(this.tessel.connection.exec.callCount, 0);
        test.equal(self.setHostname.callCount, 0);

        test.done();
      });
  },
};
