// unit test t2 root menu object
var sinon = require('sinon');
var controller = require('../../lib/controller');
var Tessel = require('../../lib/tessel/tessel');
var Seeker = require('../../lib/discover.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var logs = require('../../lib/logs');
var Menu = require('terminal-menu');

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

exports['controller.menu'] = {

  setUp: function(done) {

    var self = this;

    this.sandbox = sinon.sandbox.create();
    this.processOn = this.sandbox.stub(process, 'on');
    // no display output necessary so overriding write
    this.rtm = new Menu({
      width: 50,
      x: 1,
      y: 2,
      bg: 'red'
    });
    // add sandbox-stub to this.rtm and override method 'write'
    this.sandbox.stub(this.rtm, 'add', function add() {
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
    this.sandbox.stub(this.rtm, 'write', function write() {
      this.write = function() {
        return this;
      };
    });
    this.sandbox.stub(this.rtm, '_draw', function _draw() {
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
    this.sandbox.stub(controller.ssh, 'pro', function() {
      this.pro = function() {
        return this;
      };
    });

    this.sandbox.stub(controller.ssh, 'clear', function() {
      this.clear = function() {
        return Promise.resolve();
      };
    });

    this.sandbox.stub(controller.ssh, 'exit', function() {
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
  addingMenuLine: function(test) {
    test.expect(6);

    // wakeup the stubid ... stub
    this.rtm.add();
    // add first item
    this.rtm.add('MenulineOne\n');

    test.equal(this.rtm.items.length, 1);
    test.equal(this.rtm.x, 3);
    test.equal(this.rtm.y, 4);
    // validate logs
    test.equal(this.logsInfo.callCount, 0);
    test.equal(this.logsWarn.callCount, 0);
    test.equal(this.logsBasic.callCount, 0);

    test.done();
  },
  addMenuLineBySeekingTessels: function(test) {
    // due to the Memory-Leaks warning from node.js (11+ callbacks)
    // we create 12 Menu-Entries 
    var UsbTessel1 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel1',
      type: 'USB'
    });
    var UsbTessel2 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel2',
      type: 'USB'
    });
    var UsbTessel3 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel3',
      type: 'USB'
    });
    var UsbTessel4 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel4',
      type: 'USB'
    });
    var UsbTessel5 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel5',
      type: 'USB'
    });
    var UsbTessel6 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel6',
      type: 'USB'
    });
    var UsbTessel7 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel7',
      type: 'USB'
    });
    var UsbTessel8 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel8',
      type: 'USB'
    });
    var UsbTessel9 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: false,
      name: 'UsbTessel9',
      type: 'USB'
    });
    var UsbTessel10 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel10',
      type: 'USB'
    });
    var UsbTessel11 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel11',
      type: 'USB'
    });
    var UsbTessel12 = createFakeTessel({
      sandbox: this.sandbox,
      authorized: true,
      name: 'UsbTessel12',
      type: 'USB'
    });

    test.expect(9);

    // adding menu
    controller.root({
      timeout: 0.1,
      path: '~/.tessel/id_rsa',
      menu: this.rtm
    }).then(function(obj) {

      // because 'EXIT' is added automatically length +1
      test.equal(this.rtm.items.length, 13);
      //      test.equal(1, 1);
      test.equal(this.rtm.items[8].label, '9) UsbTessel9: [USB] (not authorized) \n');
      test.equal(this.rtm.items[10].label, '11) UsbTessel11: [USB] (authorized) \n');
      test.equal(this.rtm.items[12].label, 'EXIT');

      // test if users home is converted
      test.equal(obj.opts.path[0] !== '~', true);
      // validate we are not testing nothing...
      test.equal(obj.opts.menu, this.rtm);
      // validate logs
      test.equal(this.logsInfo.callCount, 1);
      test.equal(this.logsWarn.callCount, 0);
      test.equal(this.logsBasic.callCount, 0);

      UsbTessel1 = null;
      UsbTessel2 = null;
      UsbTessel3 = null;
      UsbTessel4 = null;
      UsbTessel5 = null;
      UsbTessel6 = null;
      UsbTessel7 = null;
      UsbTessel8 = null;
      UsbTessel9 = null;
      UsbTessel10 = null;
      UsbTessel11 = null;
      UsbTessel12 = null;
      test.done();
    }.bind(this));
    // first emit is for waking up the stubid seeker ... 
    this.activeSeeker.emit('tessel', UsbTessel1);

    // simulate a USB-Tessel is discovered 
    this.activeSeeker.emit('tessel', UsbTessel1);
    this.activeSeeker.emit('tessel', UsbTessel2);
    this.activeSeeker.emit('tessel', UsbTessel3);
    this.activeSeeker.emit('tessel', UsbTessel4);
    this.activeSeeker.emit('tessel', UsbTessel5);
    this.activeSeeker.emit('tessel', UsbTessel6);
    this.activeSeeker.emit('tessel', UsbTessel7);
    this.activeSeeker.emit('tessel', UsbTessel8);
    this.activeSeeker.emit('tessel', UsbTessel9);
    this.activeSeeker.emit('tessel', UsbTessel10);
    this.activeSeeker.emit('tessel', UsbTessel11);
    this.activeSeeker.emit('tessel', UsbTessel12);
  }
};
