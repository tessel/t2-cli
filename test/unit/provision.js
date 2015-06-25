var sinon = require('sinon');
var Tessel = require('../../lib/tessel/tessel');
var controller = require('../../lib/controller');
var fs = require('fs-extra');
var path = require('path');
var cp = require('child_process');

exports['Tessel.isProvisioned()'] = {
  setUp: function(done) {
    this.existsSync = sinon.stub(fs, 'existsSync').returns(true);
    done();
  },

  tearDown: function(done) {
    this.existsSync.restore();
    done();
  },

  isProvisionedTrue: function(test) {
    test.expect(3);

    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = 'funkytown';
    Tessel.isProvisioned();

    test.equal(this.existsSync.callCount, 2);
    test.equal(this.existsSync.firstCall.args[0], path.join(Tessel.TESSEL_AUTH_PATH, 'id_rsa'));
    test.equal(this.existsSync.lastCall.args[0], path.join(Tessel.TESSEL_AUTH_PATH, 'id_rsa.pub'));

    Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
    test.done();
  },

  isProvisionedFalse: function(test) {
    test.expect(2);

    this.existsSync.returns(false);

    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = 'funkytown';
    Tessel.isProvisioned();

    test.equal(this.existsSync.callCount, 1);
    test.equal(this.existsSync.firstCall.args[0], path.join(Tessel.TESSEL_AUTH_PATH, 'id_rsa'));

    Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
    test.done();
  },
};

exports['controller.provisionTessel'] = {
  setUp: function(done) {
    this.isProvisioned = sinon.stub(Tessel, 'isProvisioned').returns(true);
    this.provisionTessel = sinon.spy(controller, 'provisionTessel');
    this.exec = sinon.stub(cp, 'exec', function(command, callback) {
      callback();
    });
    var provisionSpy = sinon.spy();
    this.provisionSpy = provisionSpy;
    this.getTessel = sinon.stub(Tessel, 'get', function() {
      return new Promise(function(resolve) {
        resolve({
          provisionTessel: provisionSpy
        });
      });
    });
    done();
  },

  tearDown: function(done) {
    this.isProvisioned.restore();
    this.provisionTessel.restore();
    this.exec.restore();
    this.getTessel.restore();
    done();
  },

  refuse: function(test) {
    test.expect(1);
    this.provisionTessel().catch(function(error) {
      test.equal(error, 'Keys already exist. Refusing to overwrite them.');
      test.done();
    });
  },

  completeForced: function(test) {
    test.expect(3);

    var tesselAuthPath = Tessel.TESSEL_AUTH_PATH;

    Tessel.TESSEL_AUTH_PATH = 'funkytown';

    this.provisionTessel({
      force: true
    }).then(function() {
      test.equal(this.exec.callCount, 1);
      test.equal(this.exec.lastCall.args[0], 'rm -r ' + Tessel.TESSEL_AUTH_PATH);
      test.equal(this.provisionSpy.callCount, 1);

      Tessel.TESSEL_AUTH_PATH = tesselAuthPath;
      test.done();
    }.bind(this));
  },

  completeUnprovisioned: function(test) {
    test.expect(1);

    this.isProvisioned.returns(false);

    this.provisionTessel({
      force: true
    }).then(function() {
      test.equal(this.provisionSpy.callCount, 1);
      test.done();
    }.bind(this));
  },

  reportFailure: function(test) {
    test.expect(1);

    this.exec.restore();
    this.exec = sinon.stub(cp, 'exec', function(command, callback) {
      callback('some error');
    });

    this.provisionTessel({
      force: true
    }).catch(function(error) {
      test.equal(error, 'some error');
      test.done();
    });
  }
};
