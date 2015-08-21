var sinon = require('sinon');
var controller = require('../../lib/controller');
var logs = require('../../lib/logs');
var updates = require('../../lib/update-fetch');
var Tessel = require('../../lib/tessel/tessel');
var TesselSimulator = require('../common/tessel-simulator');

var fetchBuildListSim = {
  '9a85c84f5a03c715908921baaaa9e7397985bc7f': {
    released: '2015-08-12T03:01:57.856Z',
    version: '0.0.1'
  },
  'ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29': {
    released: '2015-05-18T02:21:57.856Z',
    version: '0.0.0'
  }
};

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

    this.updateTessel = this.sandbox.stub(Tessel.prototype, 'update', function() {
      return Promise.resolve();
    });

    this.fetchCurrentTesselVersion = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.resolve('9a85c84f5a03c715908921baaaa9e7397985bc7f');
    });

    this.fetchBuildList = this.sandbox.stub(updates, 'fetchBuildList', function() {
      return Promise.resolve(fetchBuildListSim);
    });

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },

  listBuilds: function(test) {
    test.expect(3);

    var opts = {
      list: true
    };

    controller.update(opts)
      .then(function() {
        test.equal(this.fetchBuildList.callCount, 1);
        // Print info that these are logs
        test.equal(this.logsInfo.callCount, 2);
        // Print each version out
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

    this.fetchBuildList.restore();
    this.fetchBuildList = this.sandbox.stub(updates, 'fetchBuildList', function() {
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
        test.equal(this.fetchBuildList.callCount, 1);
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

    this.fetchSpecificBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      build: '0.0.1'
    };

    controller.update(opts)
      .then(function() {
        // We have to fetch the build list to figure out what the sha is of this version
        test.equal(this.fetchBuildList.callCount, 1);
        // We did fetch the specified build
        test.equal(this.fetchSpecificBuild.callCount, 1);
        // It was called with the correct args
        test.equal(this.fetchSpecificBuild.calledWith(opts.build), true);
        // We fetched the Tessel to update
        test.equal(this.getTessel.callCount, 1);
        // The Tessel was updated
        test.equal(this.updateTessel.callCount, 1);
        // The update used the appropriate binaries
        test.equal(this.updateTessel.calledWith(binaries), true);
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

    this.fetchSpecificBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.reject(new Error(errMessage));
    });

    var opts = {
      build: '0.0.1'
    };
    controller.update(opts)
      .catch(function(err) {
        // We attempted to fetch a build
        test.equal(this.fetchSpecificBuild.callCount, 1);
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

    this.fetchSpecificBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    this.fetchCurrentTesselVersion.restore();
    this.fetchCurrentTesselVersion = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.resolve('ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29');
    });

    var opts = {};
    controller.update(opts)
      .then(function() {
        // Make sure we checked what the Tessel version is currently at
        test.equal(this.fetchCurrentTesselVersion.callCount, 1);
        // We fetched only one build
        test.equal(this.fetchSpecificBuild.callCount, 1);
        // It was the latest build
        test.equal(this.fetchSpecificBuild.calledWith('0.0.1'), true);
        // Update Tessel was successfully called
        test.equal(this.updateTessel.callCount, 1);
        // It was provided the binaries
        test.equal(this.updateTessel.calledWith(binaries), true);
        // Then Tessel was closed
        test.equal(this.tessel.closed, true);
        test.done();
      }.bind(this))
      .catch(function(err) {
        test.ifError(err);
      });
  },

  buildLatestAlreadyCurrent: function(test) {
    test.expect(5);

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchSpecificBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {};
    controller.update(opts)
      .then(function() {})
      .catch(function() {
        // Make sure we checked what the Tessel version is currently at
        test.equal(this.fetchCurrentTesselVersion.callCount, 1);
        // We fetched the build list to convert our current sha to a version
        // and to find the most current version to update the Tessel with
        test.equal(this.fetchBuildList.callCount, 2);
        // We didn't fetch any builds because Tessel is already up to date
        test.equal(this.fetchSpecificBuild.callCount, 0);
        // Update Tessel was not called because it was already up to date
        test.equal(this.updateTessel.callCount, 0);
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

    this.fetchSpecificBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    this.fetchCurrentTesselVersion.restore();
    this.fetchCurrent = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.resolve('ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29');
    });

    var errMessage = 'Something absolutely dreadful happened. Your Tessel is bricked.';
    this.updateTessel.restore();
    this.updateTessel = this.sandbox.stub(Tessel.prototype, 'update', function() {
      return Promise.reject(new Error(errMessage));
    }.bind(this));

    var opts = {};
    controller.update(opts)
      .catch(function(err) {
        // We fetched only one build
        test.equal(this.fetchSpecificBuild.callCount, 1);
        // It was the latest build
        test.equal(this.fetchSpecificBuild.calledWith('0.0.1'), true);
        // Update Tessel was not called because it was already up to date
        test.equal(this.updateTessel.callCount, 1);
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
    this.fetchSpecificBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      force: true
    };
    controller.update(opts)
      .then(function() {
        // We fetched only one build
        test.equal(this.fetchSpecificBuild.callCount, 1);
        // It was the latest build
        test.equal(this.fetchSpecificBuild.calledWith(version), true);
        // Update Tessel was not called because it was already up to date
        test.equal(this.updateTessel.callCount, 1);
        // It was provided the binaries
        test.equal(this.updateTessel.calledWith(binaries), true);
        // Then Tessel was closed
        test.equal(this.tessel.closed, true);
        test.done();
      }.bind(this))
      .catch(function(err) {
        test.ifError(err);
      });
  }
};
