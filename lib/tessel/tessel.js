/* 
  Constructor function for Tessel objects
    param connection: the Connection object that represents the physical comm bus
*/
function Tessel(connection) {
  // Set the connection var so we have an abstract interface to relay comms
  this.connection = connection;
  // The human readable name of the device
  this.name;
  // The unique serial number of the device
  this.serialNumber;
}

module.exports = Tessel;

require('./deploy');
require('./erase');


