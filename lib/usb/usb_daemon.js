// Built-ins
// ...

// Third Party
var async = require('async');
var protocol = require('usb-daemon-parser');

// Internal
var USBProcess = require('./usb_process');

var MAX_PROCESS_ID = 255;

function USBDaemon() {
  // Make sure we only have a singleton instance
  if (USBDaemon.prototype._singletonInstance) {
    return USBDaemon.prototype._singletonInstance;
  } else {
    USBDaemon.prototype._singletonInstance = this;
  }

  // Dict of serial number to ConnectionEntry
  this.entries = {};
  // Iterating loop of process IDs
  this.currentID = 0;

  /* Register a connection with the daemon.
  The daemon will monitor all USB traffic and parse
  out packets. The daemon will interpret those parsed
  packets to create, destroy, and modify processes
  */
  this.register = (connection) => {
    // Create a connection entry for the Daemon table
    // Includes data parser and processes hash
    var entry = new ConnectionEntry();

    // Set the entry in the table
    this.entries[connection.serialNumber] = entry;

    // Pass off all data from this USB connection to the protocol parser
    connection.pipe(entry.parser);

    // Set up listeners for the various parser events
    this._startListening(entry);
  };

  /* Deregister a connection with the daemon. This will
  close all existing connections locally and remotely.
  */
  this.deregister = (connection, callback) => {
    // Find the Daemon table entry for this connection
    var entry = this.getEntryForConnection(connection);
    // Get an array of process ids
    var pids = Object.keys(entry.processes);
    // Iterate through the process ids
    async.eachSeries(pids, (pid, cb) => {
        // Access the remot process
        var proc = entry.processes[pid];
        // If it exists
        if (proc) {
          // Close it
          this.closeProcess(entry, proc, cb);
        }
        // FIXME: If proc is false, the `cb` callback will never get called!
      },
      (err) => {
        // Remove this entry from the table
        delete this.entries[entry];
        // Call the callback
        if (typeof callback === 'function') {
          callback(err);
        }
      });
  };

  /* Start up a new remote process on Tessel */
  this.openProcess = (connection, callback) => {
    // Grab the corresponding entry for this connection
    var entry = this.getEntryForConnection(connection);
    // If it doesn't exist, return an error
    if (!entry) {
      return callback && callback(new Error('This USB Connection was never registered with the daemon...'));
    }
    // If it does exist
    else {
      // Create a new process
      var newProc = new USBProcess(this._nextID(), connection);
      // Assign this process to the connection in our entry table
      entry.processes[newProc.id] = newProc;

      // Once it closes its resources
      newProc.once('close', function() {
        // Delete the process from the entry
        delete entry.processes[newProc.id];
      });

      // Return the new running process
      return callback && callback(null, newProc);
    }
  };

  /* Close up an existing remote process on Tessel */
  this.closeProcess = function(entry, proc, callback) {
    // If this process is still running
    if (proc.active) {
      // Kill it
      // TODO: How can I get SIGKILL signal without hardcoding it
      proc.kill(9);
    }
    // Once we have confirmation that it closed
    proc.once('close', function() {
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  /* Internal method to listen to parser events and disburse
  them to the process as necessary */
  this._startListening = (entry) => {
    // When we get a command that a remote process has exited
    entry.parser.on('EXIT-STATUS', function(packet) {
      // Grab the process that died remotely
      var proc = entry.processes[packet.pid];
      // If it exists
      if (proc) {
        // Tell the process it's dying
        proc.emit('death', packet);
      }
    });
    // When we get a command that a remote process has exited
    entry.parser.on('ACK-CLOSE', function(packet) {
      // Grab the process that died remotely
      var proc = entry.processes[packet.pid];
      // If it exists
      if (proc) {
        proc.emit('close', proc.exitedWithError);
      }
    });

    // When we receive a stdout write message, we'll want to push it
    entry.parser.on('WRITE-STDOUT', function(packet) {
      // Get the relevant process
      var proc = entry.processes[packet.pid];
      // If it exists
      if (proc) {
        // Set the stream to write to
        packet.stream = proc.stdout;
        // Tell the stream to write to it
        // The stream is responsible for the actual writing
        proc.stdout.emit('incoming', packet.data);
      }
    });

    // When we receive a stderr write message, we'll want to push it
    entry.parser.on('WRITE-STDERR', function(packet) {
      // Get the relevant process
      var proc = entry.processes[packet.pid];
      // If it exists
      if (proc) {
        // Tell the process to write to it
        // The stream is responsible for the actual writing
        proc.stderr.emit('incoming', packet.data);
      }
    });

    // Once we get acknowledgement of the control command
    entry.parser.on('ACK-CONTROL', function(packet) {
      // Get the relevant process
      var proc = entry.processes[packet.pid];

      // If it exists
      if (proc) {
        // Add the acknowledged credits to the stream
        proc.control.ack(packet.data, packet.dataLength);
      }
    });

    // Once we get acknowledgement of the control command
    entry.parser.on('ACK-STDIN', function(packet) {
      // Get the relevant process
      var proc = entry.processes[packet.pid];

      // If it exists
      if (proc) {
        // Add the acknowledged credits to the stream
        proc.stdin.ack(packet.data, packet.dataLength);
      }
    });

    // Once we get notified that the remote stdout was closed
    entry.parser.on('CLOSE-STDOUT', function(packet) {
      // Get the responsible process
      var proc = entry.processes[packet.pid];

      // If it exists
      if (proc) {
        // Close the local stdout stream
        proc.stdout.close();
      }
    });

    // Once we get notified that the remote stderr was closed
    entry.parser.on('CLOSE-STDERR', function(packet) {
      // Get the responsible process
      var proc = entry.processes[packet.pid];

      // If it exists
      if (proc) {
        // Close the local stderr stream
        proc.stderr.close();
      }
    });
  };

  /* Internal method to stop listening to parser events */
  this._stopListening = function(connection) {
    connection._parser.removeAllListeners();
  };

  /* Internal method to retrieve process details for a given connection */
  this.getEntryForConnection = (connection) => {
    return this.entries[connection.serialNumber];
  };

  /* Internal method to retrieve the next available process id */
  this._nextID = () => {

    // Get all currently used ids, what's the first available?
    var usedIDs = this.getIDsInUse();
    var prev;
    var cur;

    // Go through the array to see if there are gaps between assigned IDs
    for (var i in usedIDs) {
      // Set the current one
      cur = usedIDs[i];

      // If we haven't set the previous value (this is the first iter)
      if (prev === undefined) {
        // And the first used id is not 0
        if (cur > 0) {
          // Return 0 as an available ID
          return 0;
        }
      }
      // If we have found a gap in the sequence
      else if (cur - prev > 1) {
        // Return the first available slot in the sequence
        return prev + 1;
      }

      // Set the previous to the current for the next loop
      prev = cur;
    }

    // No gaps were found, so return the next number as long as it's less than max
    if (usedIDs.length > MAX_PROCESS_ID) {
      throw new Error('Attempt to spawn more than the maximum number of processes over USB');
    } else {
      return usedIDs.length;
    }
  };

  this.getIDsInUse = () => {
    var usedIDs = [];
    for (var i in this.entries) {
      var entry = this.entries[i];
      for (var j in entry.processes) {
        usedIDs.push(entry.processes[j].id);
      }
    }

    return usedIDs;
  };
}

/* Basic object constructor definition for a connection entry*/
function ConnectionEntry() {
  this.parser = new protocol.Parser();
  this.processes = {};
}

module.exports = new USBDaemon();
