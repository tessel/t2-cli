#!/usr/bin/env node
var parser = require("nomnom")
  , controller = require('../lib/controller')
  , init = require('../lib/init')
  ;

parser.command('run')
  .callback(function(opts) {
    controller.deployScript(opts, false)
      .catch(function (err) {
        console.error(err);
        process.exit(1);
      });
  })
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
      .catch(function(err) {
        console.error(err);
        process.exit(1);
      });
  })
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
    controller.eraseScript(opts, function(err) {
      throw err;
    });
  })
  .option('verbose', {
    flag : true,
    abbr: 'v',
    help: 'choose to view more debugging information'
  })
  .help('Erase pushed code from Tessel filesystem.');

parser.command('list')
  .callback(function(opts) {
    controller.listTessels()
      .then(function() {
        process.exit(1);
      })
      .catch(function(error){
        console.error(error);
        process.exit(1);
      });
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
  .option('list', {
    abbr: 'l',
    flag: true,
    help: "List available Wifi networks"
  })
  .option('ip', {
    abbr: 'i',
    flag: true,
    help: "Show Tessel's IP ADDRESS"
  })
  .option('ssid', {
    abbr: 'n',
    help: "Set the SSID of the network to connect to"
  })
  .option('password', {
    abbr: 'p',
    help: "Set the password of the network to connect to"
  })
  .callback(function(opts) {
    if (opts.list) {
      controller.printAvailableNetworks(opts)
        .then(function(info){
          process.exit(1);
        })
        .catch(function(err) {
          if (err) throw err;
          process.exit(1);
        });
    }
    else if (opts.ip) {
      controller.printIPAddress(opts)
        .then(function(info){
          process.exit(1);
        })
        .catch(function(err) {
          if (err) throw err;
          process.exit(1);
        });
    }
    else if (opts.ssid && opts.password) {
      controller.connectToNetwork(opts)
        .then(function(info){
          process.exit(1);
        })
        .catch(function(err) {
          if (err) throw err;
          process.exit(1);
        });
    }
  })
  .help('Configure the wireless connection');

parser.usage('Usage: t2 <command>');

parser.parse();
