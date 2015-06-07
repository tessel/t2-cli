# t2-cli
The starting point for the command line interface to the next version of Tessel

Join the [conversation on Slack](https://tessel-slack.herokuapp.com/), our project's chat client!

<img src="http://tessel-slack.herokuapp.com/badge.svg">

## Installation
Clone this repo and then run `npm link --local`.

## Setup

### USB
Connecting to a Tessel 2 over USB requires no special setup.

### LAN
In order to authorize the device with your computer to work over a LAN connection, call `t2 provision` after connecting it via USB. This will place an SSH key on the device. Use the `t2 wifi` command as described below to connect Tessel 2 to a local network. You should now be able to access your Tessel 2 remotely.

### Virtual Machine
Check out the [Virtual Machine repo](https://github.com/tessel/t2-vm) for instructions on how to set up the VM. All CLI commands except `provision` and `wifi` should be functional with the VM.

## Usage
Specify which Tessel to use with the `--name <name>` option appended to any command.

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

## TODO
Help us build Tessel 2's CLI! The [issues section](https://github.com/tessel/t2-cli/issues) of this repo is full of small, fully outlined projects to add functionality.
