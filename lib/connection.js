var util = require('util');
var stream = require('stream');
var Duplex = stream.Duplex;

function Connection() {
  Duplex.call(this);
  this.connectionType;
}

util.inherits(Connection, Duplex);

module.exports = Connection;