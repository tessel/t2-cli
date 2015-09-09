var Tessel = require('./tessel/tessel');
var logs = require('./logs');
var debug = require('debug')('controller');

// create an object for t2 root steps for beeing more handy about unit testing of the T2 root command itself.
var controller = {};
controller.ssh = {
  makeMenu: function(tessel, index, rtm) {
    if (tessel.connection.connectionType === 'LAN') {
      if (!tessel.connection.authorized) {
        rtm.add(index + ') ' + tessel.name + ': ' + tessel.connection.ip + ' (not authorized) \n');
      } else {
        rtm.add(index + ') ' + tessel.name + ': ' + tessel.connection.ip + ' (authorized) \n');
      }

    } else if (tessel.connection.connectionType === 'USB') {
      if (!tessel.connection.authorized) {
        rtm.add(index + ') ' + tessel.name + ': [USB] (not authorized) \n');
      } else {
        rtm.add(index + ') ' + tessel.name + ': [USB] (authorized) \n');
      }
    } else {
      rtm.add('EXIT');
    }
    // FIXME: Workaround for trouble with dynamic added menu elements
    rtm._draw();
  },
  runSSH: function(id, opts, tessels, resolve, reject) {
    // clear console
    debug('runSSH...\n root@' + tessels[id].connections[0].host);
    if (opts.menu) {
      // because the test needs to resolve the promise ...
      resolve({
        opts: opts,
        tessels: tessels
      });
    } else {
      // if this is no test, starting the menu as child process
      process.stdout.write('\u001b[2J\u001b[0;0H');
      var ch = require('child_process')
        .spawn('ssh', ['-i',
          opts.path,
          'root@' + tessels[id].connections[0].host
        ], {
          stdio: 'inherit'
        });
      logs.info('Connect to ' + tessels[id].connections[0].host + '...');

      // FIXME: There is no handler for poweroff Tessel ! Needs to be fixed within the firmware...
      // (Terminal freezes imediatelly after poweroff the Tessel)

      ch.once('error', function(e) {
        if (e === 255) {
          process.stdout.write('\u001b[2J\u001b[0;0H');
          logs.warn('Sorry, you are not authorized!');
          logs.info('"t2 key generate" might help :-)');
          reject();
        } else {
          logs.warn('Error while connected to ' + tessels[id].connections[0].host + ':', e);
          reject(e);
        }

      });
      ch.once('exit', function(e) {

        if (e === 255) {
          process.stdout.write('\u001b[2J\u001b[0;0H');
          logs.warn('Sorry, you are not authorized!');
          logs.info('"t2 key generate" might help :-)');
          reject();
        } else if (e === 127) { // exit by user
          // clear console
          process.stdout.write('\u001b[2J\u001b[0;0H');
          logs.warn('Connection to ' + tessels[id].connections[0].host + ' closed!\n');
          resolve();
        } else if (e === 0) {
          // everything works fine ... now lets clear the terminal
          process.stdout.write('\u001b[2J\u001b[0;0H');
          logs.info('Connection to ' + tessels[id].connections[0].host + ' closed!\n');
          resolve();
        } else {
          logs.warn('Connection to ' + tessels[id].connections[0].host + ' closed due to reason:\n', e);
          reject(e);
        }
      });

      ch.once('close', function(e) {
        // tessel powers off
        if (e === 0) {
          // everything works fine...
          resolve();
        } else if (e === 255) {
          //reject();
          process.exit();
        } else if (e === 127) {
          reject();
        } else {
          logs.warn('Connection to ' + tessels[id].connections[0].host + ' closed due to reason:\n', e);
          reject();
        }
      });
    }
  },
  pro: function(rtm, resolve, reject) {
    // Menu navigation

    // raw mode for gain ability to navigate up and down within the menu
    process.stdin.setRawMode(true);

    process.stdin.pipe(rtm.createStream()).pipe(process.stdout);

    rtm.on('close', function() {
      process.stdin.setRawMode(false);
      process.stdin.end();
    });
    rtm.on('error', function(e) {
      process.stdin.setRawMode(false);
      reject(e);
    });
  },
  clear: function(resolve) {
    // selected exit!
    process.stdout.write('\u001b[2J\u001b[0;0H');
    controller.ssh.exit(resolve);
  },
  exit: function(resolve) {
    resolve();
    //process.exit();
  },
  multipleTessels: function(opts, tessels, rtm, resolve, reject) {
    // Hack for creating usebility (exit menu)
    tessels.push({
      connection: {
        connectionType: 'exit'
      }
    });

    rtm.reset();
    rtm.write('                                                \n');
    // create menu entries
    for (var i in tessels) {
      controller.ssh.makeMenu(tessels[i], i, rtm);
    }
    if (!opts.menu) {
      // if this is no test, starting the menu as child process
      controller.ssh.pro(rtm, resolve, reject);
    } else {
      // because the test needs to resolve the promise ...
      resolve({
        opts: opts,
        tessels: tessels
      });
    }

    rtm.once('select', function(label) {
      rtm.close();

      // Identify the Exit command by first letter (all other entries start with numbers/index)
      if (label[0] !== 'E') {
        controller.ssh.runSSH(label[0], opts, tessels, resolve, reject);
      } else {
        // going to clear screen and calling exit to resolve promise
        controller.ssh.clear(resolve);
      }

    });
  },
  seek: function(opts) {
    // to be able to replace the seeker in testing mode
    return Tessel.seekTessels(opts);
  }

};
module.exports = controller.ssh;
