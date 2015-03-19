#!/usr/bin/env node
var parser = require("nomnom")
  , controller = require('../lib/controller');
  ;

parser.command('run')
  .callback(function(opts) {
    controller.deployScript(opts, false, function (err) {
      if (err) {
        throw err;
      }
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
    controller.deployScript(opts, true, function(err) {
      throw err;
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
    controller.listTessels(function(err) {
      if (err) throw err;
    });
  })
  .help('Show all connected Tessels');

parser.usage('Usage: prime <command>');

parser.parse();
