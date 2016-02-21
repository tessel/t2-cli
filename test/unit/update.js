// Test dependencies are required and exposed in common/bootstrap.js

var builds = [{
  sha: 'ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29',
  released: '2015-05-18T02:21:57.856Z',
  version: '0.0.0'
}, {
  sha: '9a85c84f5a03c715908921baaaa9e7397985bc7f',
  released: '2015-08-12T03:01:57.856Z',
  version: '0.0.1'
}];

exports['controller.update'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});
    this.tessel = TesselSimulator();

    this.getTessel = this.sandbox.stub(Tessel, 'get', (opts) => {
      this.tessel.setLANConnectionPreference(opts.lanPrefer);
      return Promise.resolve(this.tessel);
    });

    this.update = this.sandbox.stub(Tessel.prototype, 'update', () => Promise.resolve());

    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', () => {
      return Promise.resolve('9a85c84f5a03c715908921baaaa9e7397985bc7f');
    });

    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList', () => Promise.resolve(builds));

    this.updateTesselWithVersion = this.sandbox.spy(controller, 'updateTesselWithVersion');
    this.closeTesselConnections = this.sandbox.spy(controller, 'closeTesselConnections');

    done();
  },

  tearDown: function(done) {
    this.sandbox.restore();
    this.tessel.mockClose();

    // If builds were reversed, fix them.
    if (builds[0].version === '0.0.1') {
      builds.reverse();
    }
    done();
  },

  listBuilds: function(test) {
    test.expect(3);

    controller.printAvailableUpdates()
      .then(() => {
        test.equal(this.requestBuildList.callCount, 1);
        // Print info that these are logs
        // 'Latest builds:'
        test.equal(this.logsInfo.callCount, 1);
        // Print each version out
        // '\t Version:', build.version, '\tPublished:', build.released.toLocaleString()
        test.equal(this.logsBasic.callCount, 2);
        // Finish
        test.done();
      })
      .catch(error => {
        test.ok(false, `printAvailableUpdates failed: ${error.toString()}`);
        test.done();
      });
  },

  listBuildFetchError: function(test) {
    test.expect(2);

    var errMessage = 'Could not fetch builds';

    this.requestBuildList.restore();
    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList', function() {
      return Promise.reject(new Error(errMessage));
    });

    controller.printAvailableUpdates()
      .then(() => {
        test.equal(true, false, 'Build fetch should have failed.');
        test.done();
      })
      .catch(error => {
        // We tried to fetch the builds
        test.equal(this.requestBuildList.callCount, 1);
        // But it failed with the erroror message we specified
        test.equal(error.message, errMessage);
        test.done();
      });
  },

  buildOptionValid: function(test) {
    test.expect(9);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {}
    });

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      version: '0.0.1',
      lanPrefer: true
    };
    controller.update(opts)
      .then(() => {
        // We have to fetch the build list to figure out what the sha is of this version
        test.equal(this.requestBuildList.callCount, 1);
        // We did fetch the specified build
        test.equal(this.fetchBuild.callCount, 1);
        // It was called with the correct args
        test.deepEqual(this.fetchBuild.lastCall.args[0], builds[1]);
        // We fetched the Tessel to update
        test.equal(this.getTessel.callCount, 1);
        // The Tessel was updated
        test.equal(this.update.callCount, 1);
        // The update used the appropriate binaries
        test.equal(this.update.calledWith(binaries), true);
        // Then the Tessel was closed
        test.equal(this.tessel.closed, true);
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      })
      .catch(error => {
        test.ok(false, `update failed: ${error.toString()}`);
        test.done();
      });
  },

  buildWillNotUpdateOverUSB: function(test) {
    test.expect(1);

    var opts = {
      version: '0.0.1',
      lanPrefer: true
    };

    controller.update(opts)
      .catch(function(error) {
        test.equal(error, 'No LAN connection found. USB-only updates do not work yet. Please ensure Tessel is connected to wifi and try again');
        test.done();
      });
  },

  buildOptionInvalid: function(test) {
    test.expect(3);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    var errMessage = 'No such build exists';

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.reject(new Error(errMessage));
    });

    var opts = {
      version: '0.0.1'
    };
    controller.update(opts)
      .catch(error => {
        // We attempted to fetch a build
        test.equal(this.fetchBuild.callCount, 1);
        // But it failed with the error we specified
        test.equal(error.message, errMessage);
        // We need to close all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        test.done();
      });
  },

  buildLatest: function(test) {
    test.expect(8);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {}
    });

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

    var opts = {
      lanPrefer: true
    };
    controller.update(opts)
      .then(() => {
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
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      })
      .catch(error => {
        test.ok(false, `update failed: ${error.toString()}`);
        test.done();
      });
  },

  buildLatestAlreadyCurrent: function(test) {
    test.expect(7);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      lanPrefer: true
    };
    controller.update(opts)
      .then(() => {
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
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      });
  },

  buildLatestUpdateFailed: function(test) {
    test.expect(7);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

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
    this.update = this.sandbox.stub(Tessel.prototype, 'update', () => {
      return Promise.reject(new Error(errMessage));
    });

    var opts = {
      lanPrefer: true
    };
    controller.update(opts)
      .catch(error => {
        // We fetched only one build
        test.equal(this.fetchBuild.callCount, 1);
        // It was the latest build
        test.equal(this.fetchBuild.calledWith(builds[1]), true);
        // Update Tessel was not called because it was already up to date
        test.equal(this.update.callCount, 1);
        // The update failed with our error message
        test.equal(error.message, errMessage);
        // Then Tessel was closed
        test.equal(this.tessel.closed, true);
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      });
  },

  buildLatestForce: function(test) {
    test.expect(7);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      force: true,
      lanPrefer: true
    };

    controller.update(opts)
      .then(() => {
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
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      })
      .catch(error => {
        test.ok(false, `update failed: ${error.toString()}`);
        test.done();
      });
  },

  explicitLatestDoesntImmediatelyUpdate: function(test) {
    test.expect(3);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      version: 'latest',
      lanPrefer: true
    };

    controller.update(opts)
      .then(() => {
        test.equal(this.updateTesselWithVersion.callCount, 0);
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      })
      .catch(error => {
        test.ok(false, `update failed: ${error.toString()}`);
        test.done();
      });
  },

  noVerifiedVersion: function(test) {
    test.expect(2);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    var opts = {
      version: 'x.x.x',
      lanPrefer: true
    };
    controller.update(opts)
      .catch(error => {
        test.equal(error, 'The requested build was not found. Please see the available builds with `t2 update -l`.');
        // We need to close all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        test.done();
      });
  },

  noVersionForcedUpdate: function(test) {
    test.expect(4);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.reject(new Error('[Error: cat: can\'t open \'/etc/tessel-version\': No such file or directory]'));
    });

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      lanPrefer: true
    };
    controller.update(opts)
      .then(() => {
        // It should attempt to fetch a build
        test.equal(this.fetchBuild.callCount, 1);
        // We should be requesting the latest build
        test.equal(this.fetchBuild.calledWith(builds[1]), true);
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'It should force an update if the file version is not found');
        test.done();
      });
  },

  noVersionUnknownError: function(test) {
    test.expect(4);

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    var unknownError = new Error('Something totally weird happened.');

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      return Promise.reject(unknownError);
    });

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    var opts = {
      lanPrefer: true
    };
    controller.update(opts)
      .then(() => {
        test.ok(false, 'It should throw an error if we get an unknown error');
        test.done();
      })
      .catch(error => {
        // Make sure this error has the proper error message
        test.equal(error.message, unknownError.message);
        // It should not attempt to fetch any builds
        test.equal(this.fetchBuild.callCount, 0);
        // We closed all open Tessel connections
        test.equal(this.closeTesselConnections.callCount, 1);
        // We called the close function with an array
        test.equal(Array.isArray(this.closeTesselConnections.args[0]), true);
        test.done();
      });
  },

  properBuildCompare: function(test) {

    // use builds where the string compare of the versions
    // would lead to incorrect comparison ('0.0.7 > 0.0.10')
    var mixedBuilds = [{
      sha: 'ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29',
      released: '2015-05-18T02:21:57.856Z',
      version: '0.0.7'
    }, {
      sha: '9a85c84f5a03c715908921baaaa9e7397985bc7f',
      released: '2015-08-12T03:01:57.856Z',
      version: '0.0.10'
    }];

    // This Tessel instance MUST be connected via BOTH
    //
    // - USB
    // - LAN (authorized)
    //
    this.tessel = TesselSimulator({
      type: 'LAN',
      authorized: true,
    });

    this.tessel.addConnection({
      connectionType: 'USB',
      end: function() {
        return Promise.resolve();
      }
    });

    var binaries = {
      firmware: new Buffer(0),
      openwrt: new Buffer(0)
    };

    this.fetchCurrentBuildInfo.restore();
    this.fetchCurrentBuildInfo = this.sandbox.stub(Tessel.prototype, 'fetchCurrentBuildInfo', function() {
      // Resolve with earlier build (0.0.7)
      return Promise.resolve(mixedBuilds[0].sha);
    });


    this.requestBuildList.restore();
    this.requestBuildList = this.sandbox.stub(updates, 'requestBuildList', function() {
      // Return our two mixed builds
      return Promise.resolve(mixedBuilds);
    });

    this.fetchBuild = this.sandbox.stub(updates, 'fetchBuild', function() {
      return Promise.resolve(binaries);
    });

    controller.update({})
      .then(() => {
        // It should attempt to fetch a build
        test.equal(this.fetchBuild.callCount, 1);
        // We should be requesting the latest build
        test.equal(this.fetchBuild.calledWith(mixedBuilds[1]), true);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'Update should not reject with valid options and builds.');
        test.done();
      });
  }
};

exports['update-fetch'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    var mixedBuilds = [{
      sha: 'ac4d8d8a5bfd671f7f174c2eaa258856bd82fe29',
      released: '2015-05-18T02:21:57.856Z',
      version: '0.0.0'
    }, {
      sha: '9a85c84f5a03c715908921baaaa9e7397985bc7f',
      released: '2015-08-12T03:01:57.856Z',
      version: '0.0.4'
    }, {
      sha: '789432897cd7829a988888b8843274cd8de89a98',
      released: '2015-06-12T03:01:57.856Z',
      version: '0.0.1'
    }];

    this.requestGet = this.sandbox.stub(request, 'get', function(url, cb) {
      cb(null, {
        statusCode: 200
      }, JSON.stringify(mixedBuilds));
    });
    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  buildsSorted: function(test) {
    test.expect(4);

    // Request the out of order builds
    updates.requestBuildList()
      .then((builds) => {
        // Ensure they were put back in order
        test.ok(builds.length === 3);
        test.ok(builds[0].version === '0.0.0');
        test.ok(builds[1].version === '0.0.1');
        test.ok(builds[2].version === '0.0.4');
        test.done();
      })
      .catch(() => {
        test.ok(false, 'An error was returned when the list fetch should succeed');
        test.done();
      });
  }
};

exports['Tessel.update'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});
    this.tessel = TesselSimulator();

    this.tessel.connection.enterBootloader = function() {};
    this.updateFirmware = sinon.spy(this.tessel, 'updateFirmware');
    this.enterBootloader = sinon.stub(this.tessel.connection, 'enterBootloader').returns(Promise.resolve());
    this.tessel.writeFlash = function() {};
    this.writeFlash = sinon.stub(this.tessel, 'writeFlash').returns(Promise.resolve());

    this.newImage = {
      openwrt: new Buffer(0),
      firmware: new Buffer(0)
    };

    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  standardUpdate: function(test) {
    var updatePath = path.join('/tmp/', updates.OPENWRT_BINARY_FILE);
    // The exec commands that should be run to update OpenWRT
    var expectedCommands = [commands.openStdinToFile(updatePath), commands.sysupgrade(updatePath)];
    // Which command is being written
    var commandsWritten = 0;
    // When we get a command
    this.tessel._rps.on('control', (data) => {
      // Switch based on the number of command this is
      switch (commandsWritten) {
        // If it's the first command
        case 0:
          // Ensure that it's attempting to write the openwrt image to /tmp
          test.equal(data.toString(), expectedCommands[commandsWritten].join(' '));
          // Once we receive stdin of the image
          this.tessel._rps.on('stdin', (data) => {
            // Ensure it's the proper image
            test.deepEqual(data, this.newImage.openwrt);
            // Close the process to continue with updates
            this.tessel._rps.emit('close');
          });
          break;
        case 1:
          // Ensure that it's attempting to run sysupgrade
          test.equal(data.toString(), expectedCommands[commandsWritten].join(' '));
          // Emit that the upgrade has complete to continue
          setImmediate(() => this.tessel._rps.stdout.push('Upgrade completed'));
      }

      commandsWritten++;
    });

    // Begin the update
    this.tessel.update(this.newImage)
      // Update completed as expected
      .then(() => {
        test.ok(this.updateFirmware.callCount, 1);
        test.ok(this.enterBootloader.callCount, 1);
        test.ok(this.writeFlash.callCount, 1);
        test.done();
      })
      .catch(() => {
        test.ok(false, 'Update test failed with valid options and builds');
        test.done();
      });
  }
};
