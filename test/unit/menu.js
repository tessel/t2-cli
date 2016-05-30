// Test dependencies are required and exposed in common/bootstrap.js
/*global Menu */

exports['Menu.prompt'] = {
  setUp: function(done) {
    this.sandbox = sinon.sandbox.create();
    this.logsWarn = this.sandbox.stub(logs, 'warn', function() {});
    this.logsInfo = this.sandbox.stub(logs, 'info', function() {});
    this.logsBasic = this.sandbox.stub(logs, 'basic', function() {});

    done();
  },
  tearDown: function(done) {
    this.sandbox.restore();
    done();
  },
  selectItem: function(test) {
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

    this.prompt = this.sandbox.stub(inquirer, 'prompt', function(questions, callback) {
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
        choices: tessels.map(function(tessel, i) {
          map[tessel.name] = i;
          return tessel.name;
        })
      },
      translate: function(answer) {
        test.ok(true);
        return tessels[map[answer.selected]];
      }
    }).then(function(tessel) {
      test.equal(tessel, a);
      test.done();
    });
  },

  noSelectedItem: function(test) {
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

    this.prompt = this.sandbox.stub(inquirer, 'prompt', function(questions, callback) {
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
        choices: tessels.map(function(tessel, i) {
          map[tessel.name] = i;
          return tessel.name;
        })
      },
      translate: function(answer) {
        test.equal(answer.selected, '\tExit');
        return tessels[map[answer.selected]];
      }
    }).then(function(tessel) {
      test.equal(tessels.indexOf(tessel), -1);
      test.done();
    });
  }
};
