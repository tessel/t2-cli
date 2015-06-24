var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var commands = require('../../lib/tessel/commands');
var logs = require('../../lib/logs');
var controller = require('../../lib/controller');

exports['Tessel.prototype.rename'] = {
  setUp: function(done) {

    this.getName = sinon.stub(Tessel.prototype, 'getName', function(callback) {
      callback(null, 'TheFakeName');
    });
    this._getMACAddress = sinon.stub(Tessel.prototype, '_getMACAddress', function(callback) {
      callback(null, 'TheFakeMACAddress');
    });

    this.isValidName = sinon.spy(Tessel, 'isValidName');
    this.renameTessel = sinon.spy(controller, 'renameTessel');
    this.setName = sinon.spy(Tessel.prototype, 'setName');
    this.setHostname = sinon.spy(commands, 'setHostname');
    this.getHostname = sinon.spy(commands, 'getHostname');
    this.logsWarn = sinon.stub(logs, 'warn', function() {});
    this.logsInfo = sinon.stub(logs, 'info', function() {});

    this.tessel = new Tessel();
    this.tessel.connection = {
      exec: sinon.spy()
    };

    done();
  },

  tearDown: function(done) {
    this.tessel.close();
    this.isValidName.restore();
    this.renameTessel.restore();
    this.getName.restore();
    this.setName.restore();
    this._getMACAddress.restore();
    this.setHostname.restore();
    this.getHostname.restore();
    this.logsWarn.restore();
    this.logsInfo.restore();
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

    this.tessel.rename({
      reset: true
    });

    // When reset:
    // - the mac address is requested
    // - setName is called
    // - the connection executes the setHostName command
    test.equal(this._getMACAddress.callCount, 1);
    test.equal(this.setName.callCount, 1);
    test.equal(this.tessel.connection.exec.callCount, 1);
    test.equal(this.setHostname.callCount, 1);
    test.ok(this.setHostname.lastCall.calledWith('Tessel-TheFakeMACAddress'));

    // getName is _not_ called.
    test.equal(this.getName.callCount, 0);

    test.done();
  },

  validRename: function(test) {
    // test.expect(3);

    this.tessel.rename({
      newName: 'ValidAndUnique'
    });

    // When valid rename:
    // - getName is called
    // - setName is called
    // - the connection executes the setHostName command
    test.equal(this.getName.callCount, 1);
    test.equal(this.setName.callCount, 1);
    test.equal(this.tessel.connection.exec.callCount, 1);
    test.equal(this.setHostname.callCount, 1);
    test.ok(this.setHostname.lastCall.calledWith('ValidAndUnique'));

    test.done();
  },

  validRenameSameAsCurrent: function(test) {
    test.expect(2);

    var spy = sinon.spy();

    this.tessel.rename({
      newName: 'TheFakeName'
    }, spy);
    // When renamed with same current name:
    // - warning is logged
    // - callback called
    //
    test.equal(this.logsWarn.callCount, 1);
    test.equal(spy.callCount, 1);

    test.done();
  },

  invalidRename: function(test) {
    test.expect(2);

    this.tessel.rename({
      newName: '...'
    });

    // When invalid rename:
    // - name is checked
    // - getName is NOT called
    test.equal(this.isValidName.callCount, 1);
    test.equal(this.getName.callCount, 0);

    test.done();
  },

  invalidSetName: function(test) {
    test.expect(3);

    this.tessel.setName('...');

    // When invalid rename:
    // - name is checked
    // - the connection NEVER executes the setHostName command
    test.equal(this.isValidName.callCount, 1);
    test.equal(this.tessel.connection.exec.callCount, 0);
    test.equal(this.setHostname.callCount, 0);

    test.done();
  },
};
