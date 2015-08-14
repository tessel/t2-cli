# t2-cli
The starting point for the Tessel 2 command line interface.

Join the [conversation on Slack](https://tessel-slack.herokuapp.com/), our project's chat client!

[![Slack](http://tessel-slack.herokuapp.com/badge.svg)](https://tessel-slack.herokuapp.com/)

[![Build Status](https://travis-ci.org/tessel/t2-cli.svg?branch=master)](https://travis-ci.org/tessel/t2-cli)

## Contents

* [Installation for development](#installation-for-development)
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

## Development Milestones
Help us build Tessel 2's CLI! The [issues section](https://github.com/tessel/t2-cli/issues) of this repo is full of small, fully outlined projects to add functionality.

The table below outlines the major milestones for the CLI prior to general release. **Feel free to contribute towards milestones that that aren't the highest priority! All contributions are welcome.**

[Milestones tracked here.](https://github.com/tessel/t2-cli/milestones)

| Milestone Name            | Subtasks                                                                                                                                                                                                                    | Notes                                                                                                                                                                                                                                                      |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1. [Continuous Tesselation](https://github.com/tessel/t2-cli/milestones/Continuous%20Tesselation) | <ul><li>[Complete Unit Tests](https://github.com/tessel/t2-cli/issues/72)</li><li>[Hardware Integration Tests](https://github.com/tessel/t2-cli/issues/155)</li><li>[General Cleanup](https://github.com/tessel/t2-cli/issues/104)</li></ul>            | We should focus on building the test infrastructure that will enable us to ensure a reliable CLI distribution. By the time these tasks are done, the code should be clean, well reviewed, and automatically tested with each PR.  **Completion Goal: July 12, 2015** |
|      2. [Easy Updation](https://github.com/tessel/t2-cli/milestones/Easy%20Updation)     | <ul><li>[ OpenWRT Updating](https://github.com/tessel/t2-cli/issues/81)</li><li>[Coprocessor Updating](https://github.com/tessel/t2-cli/issues/109)</li></ul>                                                                                     | By completing these tasks, it should be possible to have a one line call to update the OpenWRT and coprocessor firmware image on Tessel 2.   **Completion Goal: July 26**                                                                                      |
|  3. [Complete Speculation](https://github.com/tessel/t2-cli/milestones/Complete%20Speculation)  | <ul><li>Finish all issues listed under the ['spec-cli'](https://github.com/tessel/t2-cli/labels/spec-cli) label.</li></ul>                                                                                                                   | After the completion of these designed command line interactions should be finished and working according to the full specification.  **Completion Goal: August 9**                                                                                            |
|    4. [Bonus Pointation](https://github.com/tessel/t2-cli/milestones/Bonus%20Pointation)    | <ul><li>[Automatically pull in binary dependencies](https://github.com/tessel/t2-cli/issues/96)</li><li>[Rust code bundling and running (will need to also port module code)](https://github.com/tessel/t2-cli/issues/200)</li><li>[Python code bundling (will need to also port module code)](https://github.com/tessel/t2-cli/issues/201)</li></ul> | The goal of this milestone is to build on the core functionality with functional binary dependencies and Python/Rust support.  **Completion Goal: August 16**                                                                                                  |
|   5. [Finally Publication](https://github.com/tessel/t2-cli/milestones/Finally%20Publication)  | <ul><li>[ Merge with the original Tessel CLI](https://github.com/tessel/t2-cli/issues/15)</li><li> Release on NPM!</li></ul>                                                                                                                       | After this milestone is complete, the CLI will be ready for all the T2 users to enjoy!  **Completion Goal: August 23**                                                                                                                                         |
