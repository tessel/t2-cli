#!/usr/bin/env node
var parser = require("nomnom")
  , deploy = require('../lib/deploy')
  , erase = require('../lib/erase')
  , root = require('../lib/root')
  , wifi = require('../lib/wifi')
  ;

parser.command('run')
  .callback(function(opts) {
    deploy.sftpDeploy(opts);
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
    deploy.sftpDeploy(opts, true); // true: push=true
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

parser.command('root')
  .callback(function(opts) {
    root.sshRoot(opts);
  })
  .option('host', {
    abbr: 'h',
    help: 'The IP Address of the remote Tessel'
  })
  .option('keyPath', {
    abbr: 'k',
    help: 'The path to your SSH Key'
  })
  .option('keyPassphrase', {
    abbr: ''
  })
  .help('Access the terminal of your remote Tessel');

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

parser.usage('Usage: prime <command>');

parser.command('init')
  .callback(init)
  .option('interactive', {
    flag: true,
    abbr: 'i',
    help: 'Run in interactive mode'
  })
  .help('Initialize repository for your Tessel project')

parser.parse();
