# t2-cli
The starting point for the Tessel 2 command line interface.

Join the [conversation on Slack](https://tessel-slack.herokuapp.com/), our project's chat client!

[![Slack](http://tessel-slack.herokuapp.com/badge.svg)](https://tessel-slack.herokuapp.com/)

[![Build Status](https://travis-ci.org/tessel/t2-cli.svg?branch=master)](https://travis-ci.org/tessel/t2-cli) 

## Installation
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

## Updating Tessel 2 On-board OS/Firmware
There are two components to the Tessel on-board software: The OpenWRT Linux image on the MediaTek processor and the firmware image that runs on the Atmel co-processor. 

### How do I know if I need to update my T2? 
Unfortunately, [we have an open PR](https://github.com/tessel/t2-cli/pull/130) to detect the version of code running on T2 but it hasn't merged yet! If you aren't seeing your Tessel 2 show up with `t2 list`, then you probably have an old version of firmware (because the USB VID/PID is out of date). If you see functionality in the [Tessel API](https://github.com/tessel/t2-firmware#t2-hardware-api) that isn't defined on your board, then you probably need to update.

### Updating
Eventually, this will be [rolled into the CLI](https://github.com/tessel/t2-cli/issues/81) but it hasn't been built yet. For now, go ahead and update your co-processor firmware by following the instructions [here](https://github.com/tessel/t2-firmware/#flashing). Then update the OpenWRT image on the primary processor by either [building it yourself](https://github.com/tessel/openwrt-tessel) or downloading [a prebuilt binary](https://kevinmehall.net/tmp/openwrt/openwrt-ramips-mt7620-tessel-squashfs-sysupgrade.bin), transferring it to your T2 (often accomplished with `scp -i ~/.tessel/id_rsa PATH_TO_IMAGE root@IP_ADDR_OF_T2:/tmp`) and running `sysupgrade /tmp/PATH_TO_IMAGE` on your T2. Make sure it's uploaded to the `/tmp` folder on T2 - any other folder will ruin the upgrade. If you need to find the IP Address of your T2 but don't know how, first connect it to your network (`t2 wifi -n YOUR_SSID -p YOUR_PASSWORD`), then run `t2 list` to make sure it's actually connected over the LAN, and note its name. Then run `ping YOUR_NAME.local` in order to see the IP address (you can also give it a simpler name first with `t2 rename NEW_NAME`. If you already know what dterm is, you can just dterm into the device and run `ifconfig`. Wait for it to automatically restart itself and you're good to go!

## Setup

### USB
Connecting to a Tessel 2 over USB requires no special setup.

### LAN
In order to authorize the device with your computer to work over a LAN connection, call `t2 provision` after connecting it via USB. This will place an SSH key on the device. Use the `t2 wifi` command as described below to connect Tessel 2 to a local network. You should now be able to access your Tessel 2 remotely.

### Virtual Machine
Check out the [Virtual Machine repo](https://github.com/tessel/t2-vm) for instructions on how to set up the VM. All CLI commands except `provision` and `wifi` should be functional with the VM.

## Usage
Specify which Tessel to use with the `--name <name>` option appended to any command.
If `--name` is not specified, CLI will resolve a Tessel based on the following, in order:

1. If an environment variable called `TESSEL` exists, it will default to this value (e.g. `export TESSEL=Bulbasaur`)
2. The first available Tessel will be chosen, with preference given to USB-connected Tessels

### Starting Projects
* `t2 init` in the current directory, create a package.json and index.js with Hello World code. *Note that the index.js code doesn't yet work on Tessel 2*

### Tessel Management
* `t2 provision` authorize your computer to access a Tessel over SSH (USB-connected Tessel only)
* `t2 list` show what Tessels are available over WiFi and USB.
* `t2 rename` change the name of a Tessel

### Code Deploy
* `t2 run <file>` deploy the file and its dependencies
  * `[--lan]` deploy over LAN connection
  * `[--usb]` deploy over USB connection
* `t2 push <file>` copy the file and its dependencies into Tessel's Flash & run immediately
  * `[--lan]` deploy over LAN connection
  * `[--usb]` deploy over USB connection
* `t2 erase` erase any code pushed using the `t2 push` command

### Using Wifi
* `t2 wifi` show details about an existing WiFi connection
  * `[-l]` lists the available networks
  * `[-n SSID]` connects to the provided SSID
  * `[-p PASS]` connects with the given password

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
