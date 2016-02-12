var api = require('../../index');

exports['API Surface'] = {
  setUp: function(done) {
    done();
  },
  tearDown: function(done) {
    done();
  },
  ensureExistence: function(test) {
    test.ok(api === controller);
    test.ok(api === controller);
    test.ok(api.commands === commands)
    test.ok(api.Tessel === Tessel);
    test.ok(api.USBConnection === usb.Connection);
    test.ok(api.LANConnection === lan.Connection);
    test.done();
  }
}
