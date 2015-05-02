# t2-cli
The starting point for the command line interface to the next version of Tessel

## Installation
Clone this repo and then run `npm link --local`.

## Setup

Create a folder at `HOME/.tessel` (for example, on OSX this is `mkdir ~/.tessel`). Copy your existing SSH key into that folder or make a new one (something like `cp ~/.ssh/id_rsa* ~/.tessel/`).

Copy the example.env into a file called config.env and modify each of the fields so that they are accurate. The keyPath refers to the path to your SSH key and the keyPassphrase is an optional configuration if you need to specify a passphrase to access your key.

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
Tessel 2's CLI spec is under design [here](https://docs.google.com/document/d/176UvfGPrQqlUNYBiKo4HdL7_NTzgQgjb8gbCKlEw_dA/edit#heading=h.lnadxqdut7b6). Comments are welcome.
