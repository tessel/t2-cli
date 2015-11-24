# t2-cli
The starting point for the Tessel 2 command line interface.

Join the [conversation on Slack](https://tessel-slack.herokuapp.com/), our project's chat client!

[![Slack](http://tessel-slack.herokuapp.com/badge.svg)](https://tessel-slack.herokuapp.com/)

[![Travis-CI Build Status](https://travis-ci.org/tessel/t2-cli.svg?branch=master)](https://travis-ci.org/tessel/t2-cli)
[![Appveyor Build status](https://ci.appveyor.com/api/projects/status/9a6l5gwswuhqgk99?svg=true)](https://ci.appveyor.com/project/rwaldron/t2-cli)

See docs on T2 CLI usage [on the t2-docs repo](https://github.com/tessel/t2-docs/blob/master/cli.md).

## Contents

* [Installation for development](#installation-for-development)
* [Updating Tessel](#updating-tessel-2-on-board-osfirmware)
* [Development milestones](#development-milestones)

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

### Updating
Just run `t2 update` to make sure you are running the most recent build of OpenWRT and firmware.

## Development Milestones
Help us build Tessel 2's CLI! The [issues section](https://github.com/tessel/t2-cli/issues) of this repo is full of small, fully outlined projects to add functionality.

The table [here](https://github.com/tessel/project/issues/106) outlines the major milestones for the CLI prior to general release. **Feel free to contribute towards milestones that that aren't the highest priority or bugs not on that list! All contributions are welcome.**                                                                                                                                        |
