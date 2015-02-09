#!/usr/bin/env node
var parser = require("nomnom")
  , deploy = require('../lib/deploy')
  , root = require('../lib/root');
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

parser.command('root')
  .callback(function(opts) {
    root.ssh(opts);
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

parser.usage('Usage: prime <command>');

parser.parse();