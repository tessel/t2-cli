var t2 = require('./');

var wifiOpts = {'ssid': 'technicallyVPN',
 'password': 'scriptstick', 'host': 'www.baidu.com', 'timeout': 10}

var thOpts = {};

// t2.Tessel.listTessels({timeout: 10})
//   .then(function(devices){
//     var t2List = [];
//     // go through all the usb connected devices
//     devices.forEach(function(d){
//       if (d.connection.connectionType !== 'LAN') {
//         wifiOpts.name = d.name;
//         runWifiTest(wifiOpts, d);

//         // run ethernet & usb test
//         runThruHoleTests()
//         t2List.push(d);
//       }
//     })
//     console.log("t2s", t2List);
//   });


// function runWifiTest(wifiOpts, selectedTessel) {
//   console.log("opts", wifiOpts);
//   t2.Tessel.runWifiTest(wifiOpts, selectedTessel)
//   .then(function(){
//     process.exit(0);
//   })
//   .catch(function(err){
//     throw err;
//     // logs.err(err);
//     process.exit(1);
//   })
// }

// function runThruHoleTests(thOpts, selectedTessel) {
//   // run usb & through hole tests
//   t2.Tessel.runTests(thOpts, selectedTessel) {

//   }
// }

var foundTessels = [];

// list tessels as they attach and detach
function findTessels() {
  var seeker = new t2.discover.TesselSeeker().start();
  seeker.on('usbConnection', function(tessel){
    // got a usb connection to a tessel
    console.log("usb connected", tessel.connection.serialNumber, tessel.name);
  })

  seeker.on('tessel', function(tessel) {
    if (tessel.connection.connectionType == 'USB') {
      // found the name of the tessel
      // add only if tessels are over usb
      // console.log("tessel", tessel.name);
      foundTessels.push({serialNumber: tessel.connection.serialNumber,
        name: tessel.name});
      console.log("foundTessels", seeker.usbDeviceList);
      tessel.connection.end(function(){
        console.log('ending the connection of ', tessel.name);
      })
    }
  });

  seeker.on('detach', function (tessel){
    // go through list of tessels and remove the detached device
    console.log("detaching", tessel.connection.serialNumber);
    console.log("foundTessels", seeker.usbDeviceList);
    // console.log("foundTessels", foundTessels);
  });
}

console.log("finding after timeout");
// setTimeout(function(){
  findTessels();
// }, 20*1000);
