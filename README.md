# t2-cli
The starting point for the Tessel 2 command line interface.

Join the [conversation on Slack](https://tessel-slack.herokuapp.com/), our project's chat client!

[![Code of Conduct](https://img.shields.io/badge/%E2%9D%A4-code%20of%20conduct-blue.svg?style=flat)](https://github.com/tessel/project/blob/master/CONDUCT.md)


[![Slack](http://tessel-slack.herokuapp.com/badge.svg)](https://tessel-slack.herokuapp.com/)

[![Travis-CI Build Status](https://travis-ci.org/tessel/t2-cli.svg?branch=master)](https://travis-ci.org/tessel/t2-cli)
[![Appveyor Build status](https://ci.appveyor.com/api/projects/status/9a6l5gwswuhqgk99?svg=true)](https://ci.appveyor.com/project/rwaldron/t2-cli)

Documentation: [Tessel 2 Command Line Interface](https://tessel.gitbooks.io/t2-docs/content/API/CLI.html)

## Contents

* [Installation for development](#installation-for-development)
* [Updating Tessel](#updating)
* [Testing](#testing)
* [Development milestones](#development-milestones)
* [Releasing](#releasing)

## Installation for development
Prerequisites for installation: [Node.js](https://nodejs.org/) and [Git](https://git-scm.com/downloads).

1. Clone this repository by entering the following: `git clone https://github.com/tessel/t2-cli`.
2. Go to the root directory of repository: `cd t2-cli`.
3. Create a symbolic link: `npm link --local`.

####Windows
You may encounter the following error when executing `npm link` on windows:
```
19798 error Windows_NT 6.3.9600
19799 error argv "C:\\Program Files\\nodejs\\\\node.exe" "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" "link"
19800 error node v0.12.4
19801 error npm  v2.10.1
19802 error code ELIFECYCLE
19803 error tessel@0.3.23 postinstall: `tessel install-drivers || true; tessel trademark || true`
19803 error Exit status 1
19804 error Failed at the tessel@0.3.23 postinstall script 'tessel install-drivers || true; tessel trademark || true'.
```
This error occurs because of windows folder permissions. To resolve this make sure you are running cmd or powershell as an administrator and that the permissions on the node_modules folder is set to full control for the user.

####Source Tab Completion
For bash users, add this line to your `~/.bashrc` or `~/.bash_profile` file:

`source /PATH/TO/t2-cli/bash_completion`

For zsh users, add these lines to your `~/.zshrc` file:

```
# Add custom completion scripts
fpath=(/PATH/TO/t2-cli $fpath)

# compsys initialization
autoload -U compinit
compinit
```

## Updating
Just run `t2 update` to make sure you are running the most recent build of OpenWRT and firmware.

## Testing

### Overview
In order to maintain a reliable code base, there is extensive code coverage and style checking involved with adding to or editting this repo. [Grunt](http://gruntjs.com) is used as the task runner, along with plugins for the following tools:

- [jshint](http://jshint.com/docs/): used to verify our best practices and prevents us from making mistakes that could lead to hard-to-find bugs, see [`.jshintrc`](https://github.com/tessel/t2-cli/blob/master/.jshintrc) for our configuration
- [jscs](http://jscs.info): used to maintain the project's preferred code style, see [`.jscsrc`](https://github.com/tessel/t2-cli/blob/master/.jscsrc) for our configuration
- [jsbeautifier](https://github.com/beautify-web/js-beautify): used to format code into the repo's preferred style, see [`Gruntfile.js`](https://github.com/tessel/t2-cli/blob/master/Gruntfile.js#L62) for our configuration
- [nodeunit](https://github.com/caolan/nodeunit): used to create and run unit tests

All of these tasks can be run by entering `npm test` (an alias for `grunt test` without needing to have the `grunt-cli` installed globally) into your command line. Be sure to run this command before pushing new code so JSHint and style errors can be caught as soon as possible. 

### Writing Tests
Check out the [nodeunit documentation](https://github.com/caolan/nodeunit#usage) for general usage of the library. For this project, there is a global test setup file (found under [`test/common/bootstrap.js`](https://github.com/tessel/t2-cli/blob/master/test/common/bootstrap.js)) for including any dependencies needed to run the various test modules, as well as two simulator modules, [`RemoteProcessSimulator`](https://github.com/tessel/t2-cli/blob/master/test/common/remote-process-simulator.js) and [`TesselSimulator`](https://github.com/tessel/t2-cli/blob/master/test/common/tessel-simulator.js), for simulating command line and hardware interactions in the tests.

Unit tests are found in the [`test/unit/`](https://github.com/tessel/t2-cli/tree/master/test/unit) directory, named after the feature being tested. A typical unit test looks like the following example:

```js
// Test dependencies are required and exposed in common/bootstrap.js

// The module name is usually the name of the function being tested, i.e. Tessel.prototype.findAvailableNetworks
exports['functionName'] = {
  // this is called before the each test is run
  setUp: function(done) {
    // sinon is used to watch and mock parts of the Tessel codebase used by the tested function
    this.sandbox = sinon.sandbox.create();
    this.functionName = this.sandbox.spy(Tessel.prototype, 'functionName');

    // create a new TesselSimulator to be used by this module
    this.tessel = TesselSimulator();

    done();
  },

  // this is called after each test is run, should cleanup all mocks
  tearDown: function(done) {
    this.tessel.mockClose();
    this.sandbox.restore();
    done();
  },

  // this should be something recognizable and clearly states what outcome of the function is being tested
  testName: function(test) {
    // the number of assertions the test should expect
    test.expect(1);

    this.tessel.functionName();

    // `equal` is a function passed through by the Node.js `assert` module, see https://github.com/caolan/nodeunit#api-documentation for more info
    // `callCount` is a property from Sinon's spy, see http://sinonjs.org/docs/#spies for more info
    test.equal(this.functionName.callCount, 1);

    // this should always be called when every assertion is done
    test.done();
  }
};
```

## Development Milestones
Help us build Tessel 2's CLI! The [issues section](https://github.com/tessel/t2-cli/issues) of this repo is full of small, fully outlined projects to add functionality.

The table [here](https://github.com/tessel/project/issues/106) outlines the major milestones for the CLI prior to general release. **Feel free to contribute towards milestones that that aren't the highest priority or bugs not on that list! All contributions are welcome.**                                                                                                            


## Releasing

For all releases, a maintainer will complete the following steps: 

1. Update the version, commit it, and tag it (all of these things happen with the following command):

  ```
  npm version [<newversion> | major | minor | patch]
  ```

  Where `<newversion>` is either "major", "minor" or "patch" (currently, we are in pre-1.0 "patch" releases). More than likely, you will type `npm version patch`.

2. `git push --tags`  (or `git push remote-name --tags`, where `remote-name` is the name of your remote that points to `git@github.com:tessel/t2-cli.git`)

3. `grunt changelog` will produce a pre-formatted changelog that looks something like this: 

  ```
  | Commit | Message/Description |
  | ------ | ------------------- |
  | sha    | we fixed stuff      |
  ```

  Copy the table to clipboard

4. Open https://github.com/tessel/t2-cli/releases and click `Edit` on the right hand side of the "Latest Release": 
  
  ![](https://i.gyazo.com/4099829ecb663257c643e28ce1ef51ec.png)

  Type the tag name into the "Release title" field: 

  ![](https://i.gyazo.com/d88e251a0c77296b2be6d33224eaa2ca.png)

  Paste the changelog into the "Describe this release" field: 

  ![](https://i.gyazo.com/646654508baf21b685499c830f1baa2c.png)

  When complete it will look something like this: 

  ![](https://i.gyazo.com/f86ea740e358a46949394d5a7a3906e1.png)






