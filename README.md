# t2-cli
The starting point for the command line interface to the next version of Tessel

## Installation
Clone this repo and then run `npm link --local`.

## Setup

Copy the example.env into a file called config.env and modify each of the fields so that they are accurate. The keyPath refers to the path to your SSH key (postinstall has made one at `HOME/.tessel/id_rsa`).

## Usage
`t2 run FILENAME` will deploy that starting file and its dependencies to your remote Tessel

## TODO
The commands below are planned to be implemented by product ship date.

* `tessel wifi` show details about an existing WiFi connection
  * `[-l]` lists the available networks
  * `[-n SSID]` connects to the provided SSID
  * `[-p PASS]` connects with the given password
  * `[-s SECURITY]` connects using the provided SECURITY protocol (options: "WEP", "WPA", "PSK", "ENTERPRISE")
  * `[-t TIMEOUT]` continues attempting to connect for the provided number of seconds
* `tessel wap` create, resume, or stop an access point on Tessel 2
  * `[-n SSID]` create an access point with the given SSID
  * `[-p PASS]` create an access point with the given password
  * `[-s SECURITY]` create an access point with the given security
  * `up` start an access point with previous credentials
  * `down` stop an access point
* `tessel logs` lists the recent activity, console.logs of running program from flash or RAM
* `tessel setup` copies your RSA public key onto the Tessel so that you can SSH into that tessel
  * `[--name NAME]` gives the Tessel a name of your choosing
* `tessel status` prints the name of the script that is running on any connected Tessels, how long any scripts have been running, whether the script is in RAM or Flash, and each Tessel's Wifi connection status
  * `[-s]` prints the running script information
  * `[-w]` prints the wifi status
* `tessel update` checks for and installs any firmware updates
* `tessel root` provides access to the system on chip (SoC)
