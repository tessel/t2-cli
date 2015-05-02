#!/usr/bin/env node
var parser = require("nomnom")
  , controller = require('../lib/controller')
  , init = require('../lib/init')
  , tessel = require('tessel')
  ;

var nameOption = {
  metavar : 'NAME',
  help : 'the name of the tessel on which the command will be executed.'
}

parser.command('run')
  .callback(function(opts) {
    controller.deployScript(opts, false)
      .catch(function (err) {
        if(err instanceof Error){
          throw err;
        }
        tessel.logs.warn(err);
        process.exit(1);
      });
  })
  .option('name', nameOption)
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'the entry point file to deploy to Tessel'
  })
  .option('verbose', {
    flag : true,
    abbr: 'v',
    help: 'choose to view more debugging information'
  })
  .help('Deploy a script to Tessel and run it with Node.');

parser.command('push')
  .callback(function(opts) {
    // true: push=true
    controller.deployScript(opts, true)
      .catch(function (err) {
        if(err instanceof Error){
          throw err;
        }
        tessel.logs.warn(err);
        process.exit(1);
      });
  })
  .option('name', nameOption)
  .option('entryPoint', {
    position: 1,
    required: true,
    help: 'the entry point file to deploy to Tessel'
  })
  .option('verbose', {
    flag : true,
    abbr: 'v',
    help: 'choose to view more debugging information'
  })
  .help('Deploy a script to memory on Tessel and run it with Node whenever Tessel boots up.');

parser.command('erase')
  .callback(function(opts) {
    controller.eraseScript(opts)
      .catch(function (err) {
        if(err instanceof Error){
          throw err;
        }
        tessel.logs.warn(err);
        process.exit(1);
      });
  })
  .option('name', nameOption)
  .option('verbose', {
    flag : true,
    abbr: 'v',
    help: 'choose to view more debugging information'
  })
  .help('Erase pushed code from Tessel filesystem.');

parser.command('list')
  .callback(function(opts) {
    controller.listTessels(opts)
      .then(function() {
        process.exit(1);
      })
      .catch(function(err){
        if(err instanceof Error){
          throw err;
        };
        tessel.logs.err(err);
        process.exit(1);
      });
  })
  .option('all', {
    flag: true,
    abbr: 'a',
    help: 'list all tessels, including ones you are not authorized on'
  })
  .option('timeout', {
    abbr: 't',
    help: 'set timeout in seconds for scanning for networked tessels'
  })
  .help('Show all connected Tessels');

parser.command('init')
  .callback(init)
  .option('interactive', {
    flag: true,
    abbr: 'i',
    help: 'Run in interactive mode'
  })
  .help('Initialize repository for your Tessel project')

parser.command('wifi')
  .callback(function(opts) {
    //TODO: Refactor switch case into controller.wifi
    if (opts.list) {
      controller.printAvailableNetworks(opts)
        .then(function(info){
          process.exit(1);
        })
        .catch(function (err) {
          if(err instanceof Error){
            throw err;
          }
          tessel.logs.warn(err);
          process.exit(1);
      });
    }
    else if (opts.ip) {
      controller.printIPAddress(opts)
        .then(function(info){
          process.exit(1);
        })
        .catch(function (err) {
          if(err instanceof Error){
            throw err;
          }
          tessel.logs.warn(err);
          process.exit(1);
      });
    }
    else if (opts.ssid && opts.password) {
      controller.connectToNetwork(opts)
        .then(function(info){
          process.exit(1);
        })
        .catch(function (err) {
          if(err instanceof Error){
            throw err;
          }
          tessel.logs.warn(err);
          process.exit(1);
        });
    }
  })
  .option('name', nameOption)
  .option('list', {
    abbr: 'l',
    flag: true,
    help: "List available Wifi networks"
  })
  .option('ssid', {
    abbr: 'n',
    help: "Set the SSID of the network to connect to"
  })
  .option('password', {
    abbr: 'p',
    help: "Set the password of the network to connect to"
  })
  .help('Configure the wireless connection');

parser.usage('Usage: t2 <command>');

parser.parse();
