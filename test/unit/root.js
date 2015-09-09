// unit test t2 root command
var sinon = require('sinon');
var ctrl = require('../../lib/controller');
var Tessel = require('../../lib/tessel/tessel');
var Seeker = require('../../lib/discover.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
// due to the sinon stub objects on Menu we need to incrase the default max of 10 event listeners
EventEmitter.defaultMaxListeners = 100;

var logs = require('../../lib/logs');
var M = require('terminal-menu');

// template for creating fake tessels
function createFakeTessel(options) {
  var tessel = new Tessel({
    connectionType: options.type || 'LAN',
    authorized: options.authorized !== undefined ? options.authorized : true,
    end: function() {
      return Promise.resolve();
    }

  });

  function serialNumber(options) {
    if (options.type === 'USB') {
      return options.serialNumber;
    } else {
      return false;
    }
  }
  tessel.serialNumber = serialNumber(options);
  tessel.name = options.name || 'a';
  
  options.sandbox.stub(tessel, 'close', function() {
    return Promise.resolve();
  });
  // return the fake tessel
  return tessel;
}

exports['controller.root'] = {

  setUp: function(done) {

    var self = this;

    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    // no display output necessary so overriding write
    this.menu = new M({
      width: 50,
      x: 1,
      y: 2,
      bg: 'red'
    });
    // add sandbox-stub to this.rtm and override method 'write'
    this.sandbox.stub(this.menu, 'add', function add() {
      this.add = function(label) {
        this.items.push({
          x: this.x,
          y: this.y,
          label: label
        });
        this._fillLine(this.y);
        this.y++;
      };
    });
    this.sandbox.stub(this.menu, 'write', function write() {
      this.write = function() {
        return this;
      };
    });
    this.sandbox.stub(this.menu, '_draw', function _draw() {
      this._draw = function() {
        return this;
      };
    });
    // copy the Menu events 'select' and 'close' into the EventEmitter
    // FIXME: This doesn't work due to the untestable way terminal-menu adds listener
    // see: index.js Menu.prototype.add

    // util.inherits(this.rtm, EventEmitter);

    this.activeSeeker = undefined;
    this.seeker = this.sandbox.stub(Seeker, 'TesselSeeker', function Seeker() {
      this.start = function() {
        self.activeSeeker = this;
        return this;
      };
      this.stop = function() {
        return this;
      };
    });
    // copy the seeker events into the EventEmitter
    util.inherits(this.seeker, EventEmitter);
    this.sandbox.stub(ctrl.ssh, 'pro', function() {
      this.pro = function() {
        return this;
      };
    });

    this.sandbox.stub(ctrl.ssh, 'clear', function() {
      this.clear = function() {
        return Promise.resolve();
      };
    });

    this.sandbox.stub(ctrl.ssh, 'exit', function() {
      this.exit = function(resolve) {
        resolve();
      };
    });
    // setting up fake system for logging, so there is no console output while testing
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  singleTesselNoMenu: function(test) {
    var LanTessel = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'LanTessel',
      type: 'LAN'
    });
    test.expect(7);
    ctrl.root({
      timeout: 0.3,
      path: '~/.tessel/id_rsa',
      menu: this.menu
    }).then(function(obj) {
      // wakeup the stubid ... stub
      this.menu.add();
      // add first item
      test.equal(this.menu.items.length, 0);
      test.equal(this.menu.x, 3);
      test.equal(this.menu.y, 3);
      //
      this.menu = null;
      delete this.menu;

      test.equal(obj.opts.timeout, 0.3);
      test.equal(obj.tessels.length, 1);
      test.equal(LanTessel.connections[0].authorized, true);
      test.equal(LanTessel, obj.tessels[0]);
      test.done();
    }.bind(this));
    this.activeSeeker.emit('tessel', LanTessel);
  }
};
