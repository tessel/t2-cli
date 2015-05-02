# t2-cli
The starting point for the command line interface to the next version of Tessel

## Installation
Clone this repo and then run `npm link --local`.

## Setup

Using Tessel 2 over USB requires no special setup.

In order to authorize the device with your computer to work over a LAN connection, call `tessel setup`. This will place an SSH key on the device.
Use the `tessel wifi` command as described below to connect Tessel 2 to a local network. You should now be able to access your Tessel 2 remotely.

## Usage
* `t2 setup` authorize your computer to access a Tessel over SSH (USB-connected Tessel only)
* `t2 list` show what Tessels are available over WiFi and USB. Use the names (before the ".local") or IP addresses listed here to specify which Tessel to use with the command `--name <name>` or `--ip <ip>`
* `t2 init` in the current directory, create a package.json and index.js with Hello World code. *Note that the index.js code doesn't yet work on Tessel 2*
* `t2 run <file>` deploy the file and its dependencies
* `t2 push <file>` copy the file and its dependencies into Tessel's Flash & run immediately
* `t2 erase` erase any code pushed using the `t2 push` command
* `t2 wifi` show details about an existing WiFi connection
  * `[-l]` lists the available networks
  * `[-n SSID]` connects to the provided SSID
  * `[-p PASS]` connects with the given password

## TODO
Tessel 2's CLI spec is under design [here](https://forums.tessel.io/t/t2-cli-spec-comments-requested/1743). Comments are welcome.
