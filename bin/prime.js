#!/usr/bin/env node
var parser = require("nomnom")
  , erase = require('../lib/erase')
  , root = require('../lib/root')
  , wifi = require('../lib/wifi')
  , controller = require('../lib/controller');
  ;

parser.command('run')
  .callback(function(opts) {
    controller.runScript(opts, false);
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
    controller.runScript(opts, true); // true: push=true
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
    erase.erase(opts);
  })
  .option('verbose', {
    flag : true,
    abbr: 'v',
    help: 'choose to view more debugging information'
  })
  .help('Erase pushed code from Tessel filesystem.');

parser.command('wifi')
  .callback(function(opts) {
    if (opts.scan) {
      wifi.printAvailableNetworks();
    }
    else if (opts.ip) {
      wifi.printIPAddress();
    }
    else if (opts.ssid && opts.password) {
      var options = {ssid: opts.ssid, password: opts.password}
      wifi.setWiFiCredentialsOverSSH(options)
    }
  })
  .option('scan', {
    abbr: 's',
    flag: true,
    help: "Scan for available networks"
  })
  .option('ip', {
    abbr: 'i',
    flag: true,
    help: 'Print the IP Address of the remote Tessel'
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

parser.command('list')
  .callback(function(opts) {
    controller.listTessels();
  })
  .help('Show all connected Tessels');

parser.usage('Usage: prime <command>');

parser.parse();
