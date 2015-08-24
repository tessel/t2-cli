var sinon = require('sinon');
var controller = require('../../lib/controller');
var logs = require('../../lib/logs');
var updates = require('../../lib/update-fetch');
var Tessel = require('../../lib/tessel/tessel');
var TesselSimulator = require('../common/tessel-simulator');

var builds = [
  {
    sha: 'ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29',
    released: '2015-05-18T02:21:57.856Z',
    version: '0.0.0'
  },
  {
    sha: '9a85c84f5a03c715908921baaaa9e7397985bc7f',
    released: '2015-08-12T03:01:57.856Z',
    version: '0.0.1'
  }
];

exports['controller.update'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});
    this.tessel = TesselSimulator();

    this.getTessel = this.sandbox.stub(Tessel, 'get', function() {
      return Promise.resolve(this.tessel);
    }.bind(this));

    this.update = this.sandbox.stub(Tessel.prototype, 'update', function() {
      return Promise.resolve();
    });

    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.resolve('9a85c84f5a03c715908921baaaa9e7397985bc7f');
    });

    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList', function() {
      return Promise.resolve(builds);
    });

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    this.tessel.mockClose();
    done();
  },

  listBuilds: function(test) {
    test.expect(3);

    var opts = {
      list: true
    };

    controller.update(opts)
      .then(function() {
        test.equal(this.requestBuildList.callCount, 1);
        // Print info that these are logs
        // 'Latest builds:'
        test.equal(this.logsInfo.callCount, 1);
        // Print each version out
        // '\t Version:', build.version, '\tPublished:', build.released.toLocaleString()
        test.equal(this.logsBasic.callCount, 2);
        // Finish
        test.done();
      }.bind(this))
      .catch(function(err) {
        test.ifError(err);
      });
  },

  listBuildFetchError: function(test) {
    test.expect(2);

    var errMessage = 'Could not fetch builds';

    this.requestBuildList.restore();
    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList', function() {
      return Promise.reject(new Error(errMessage));
    });

    var opts = {
      list: true
    };
    controller.update(opts)
      .then(function() {
        test.equal(true, false, 'Build fetch should have failed.');
      })
      .catch(function(err) {
        // We tried to fetch the builds
        test.equal(this.requestBuildList.callCount, 1);
        // But it failed with the error message we specified
        test.equal(err.message, errMessage);
        test.done();
      }.bind(this));
  },

  buildOptionValid: function(test) {
    test.expect(7);

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      version: '0.0.1'
    };

    controller.update(opts)
      .then(function() {
        // We have to fetch the build list to figure out what the sha is of this version
        test.equal(this.requestBuildList.callCount, 1);
        // We did fetch the specified build
        test.equal(this.fetchBuild.callCount, 1);
        // It was called with the correct args

        var build = this.fetchBuild.lastCall.args[0];

        test.deepEqual(build, builds[1]);
        // We fetched the Tessel to update
        test.equal(this.getTessel.callCount, 1);
        // The Tessel was updated
        test.equal(this.update.callCount, 1);
        // The update used the appropriate binaries
        test.equal(this.update.calledWith(binaries), true);
        // Then the Tessel was closed
        test.equal(this.tessel.closed, true);
        test.done();
      }.bind(this))
      .catch(function(err) {
        test.ifError(err);
      });
  },

  buildOptionInvalid: function(test) {
    test.expect(2);

    var errMessage = 'No such build exists';

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.reject(new Error(errMessage));
    });

    var opts = {
      version: '0.0.1'
    };
    controller.update(opts)
      .catch(function(err) {
        // We attempted to fetch a build
        test.equal(this.fetchBuild.callCount, 1);
        // But it failed with the error we specified
        test.equal(err.message, errMessage);
        test.done();
      }.bind(this));
  },

  buildLatest: function(test) {
    test.expect(6);

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.resolve('ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29');
    });

    var opts = {};
    controller.update(opts)
      .then(function() {
        // Make sure we checked what the Tessel version is currently at
        test.equal(this.fetchCurrentBuildInfo.callCount, 1);
        // We fetched only one build
        test.equal(this.fetchBuild.callCount, 1);
        // It was the latest build
        test.equal(this.fetchBuild.calledWith(builds[1]), true);
        // Update Tessel was successfully called
        test.equal(this.update.callCount, 1);
        // It was provided the binaries
        test.equal(this.update.calledWith(binaries), true);
        // Then Tessel was closed
        test.equal(this.tessel.closed, true);
        test.done();
      }.bind(this))
      .catch(function(err) {
        test.ifError(err);
        test.done();
      });
  },

  buildLatestAlreadyCurrent: function(test) {
    test.expect(5);

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function(data) {
      return Promise.resolve(binaries);
    });

    var opts = {};
    controller.update(opts)
      .then(function() {
        // Make sure we checked what the Tessel version is currently at
        test.equal(this.fetchCurrentBuildInfo.callCount, 1);
        // We fetched the build list once
        test.equal(this.requestBuildList.callCount, 1);
        // We didn't fetch any builds because Tessel is already up to date
        test.equal(this.fetchBuild.callCount, 0);
        // Update Tessel was not called because it was already up to date
        test.equal(this.update.callCount, 0);
        // Then Tessel was closed
        test.equal(this.tessel.closed, true);
        test.done();
      }.bind(this));
  },

  buildLatestUpdateFailed: function(test) {
    test.expect(5);

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.resolve('ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29');
    });

    var errMessage = 'Something absolutely dreadful happened. Your Tessel is bricked.';
    this.update.restore();
    this.update = this.sandbox.stub(Tessel.prototype, 'update', function() {
      return Promise.reject(new Error(errMessage));
    }.bind(this));

    var opts = {};
    controller.update(opts)
      .catch(function(err) {
        // We fetched only one build
        test.equal(this.fetchBuild.callCount, 1);
        // It was the latest build
        test.equal(this.fetchBuild.calledWith(builds[1]), true);
        // Update Tessel was not called because it was already up to date
        test.equal(this.update.callCount, 1);
        // The update failed with our error message
        test.equal(err.message, errMessage);
        // Then Tessel was closed
        test.equal(this.tessel.closed, true);
        test.done();
      }.bind(this));
  },

  buildLatestForce: function(test) {
    test.expect(5);

    var version = '0.0.1';
    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };
    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      force: true
    };
    controller.update(opts)
      .then(function() {
        // We fetched only one build
        test.equal(this.fetchBuild.callCount, 1);
        // It was the latest build
        test.equal(this.fetchBuild.calledWith(builds[1]), true);
        // Update Tessel was not called because it was already up to date
        test.equal(this.update.callCount, 1);
        // It was provided the binaries
        test.equal(this.update.calledWith(binaries), true);
        // Then Tessel was closed
        test.equal(this.tessel.closed, true);
        test.done();
      }.bind(this))
      .catch(function(err) {
        test.ifError(err);
      });
  }
};
