// Test dependencies are required and exposed in common/bootstrap.js
require('../common/bootstrap');
/*global Menu */

exports['Menu.prompt'] = {
  setUp(done) {
    this.sandbox = sinon.sandbox.create();
    this.logWarn = this.sandbox.stub(log, 'warn');
    this.logInfo = this.sandbox.stub(log, 'info');
    this.logBasic = this.sandbox.stub(log, 'basic');

    done();
  },
  tearDown(done) {
    this.sandbox.restore();
    done();
  },
  selectItem(test) {
    test.expect(2);
    var a = new TesselSimulator({
      type: 'LAN',
      name: 'Tessel-A',
      authorized: true
    });
    var b = new TesselSimulator({
      type: 'LAN',
      name: 'Tessel-B',
      serialNumber: '1234'
    });
    var tessels = [a, b];
    var map = {};

    this.prompt = this.sandbox.stub(inquirer, 'prompt').callsFake(function(questions, callback) {
      // This matches the inquirer.prompt return value. Do not change.
      callback({
        selected: questions[0].choices[0]
      });
    });

    Menu.prompt({
      prompt: {
        name: 'selected',
        type: 'list',
        message: 'Pick one',
        choices: tessels.map((tessel, i) => {
          map[tessel.name] = i;
          return tessel.name;
        })
      },
      translate(answer) {
        test.ok(true);
        return tessels[map[answer.selected]];
      }
    }).then((tessel) => {
      test.equal(tessel, a);
      test.done();
    });
  },

  noSelectedItem(test) {
    test.expect(2);
    var a = new TesselSimulator({
      type: 'LAN',
      name: 'Tessel-A',
      authorized: true
    });
    var b = new TesselSimulator({
      type: 'LAN',
      name: 'Tessel-B',
      serialNumber: '1234'
    });
    var tessels = [a, b];
    var map = {};

    this.prompt = this.sandbox.stub(inquirer, 'prompt').callsFake(function(questions, callback) {
      // This matches the inquirer.prompt return value. Do not change.
      // controller.menu adds an "Exit" choice
      callback({
        selected: questions[0].choices[2]
      });
    });

    Menu.prompt({
      prompt: {
        name: 'selected',
        type: 'list',
        message: 'Pick one',
        choices: tessels.map((tessel, i) => {
          map[tessel.name] = i;
          return tessel.name;
        })
      },
      translate(answer) {
        test.equal(answer.selected, '\tExit');
        return tessels[map[answer.selected]];
      }
    }).then((tessel) => {
      test.equal(tessels.indexOf(tessel), -1);
      test.done();
    });
  }
};
