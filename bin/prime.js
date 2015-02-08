#!/usr/bin/env node
var parser = require("nomnom")
  , deploy = require('../lib/deploy')
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

parser.usage('Usage: prime <command>');

parser.parse();