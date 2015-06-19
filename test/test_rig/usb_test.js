module.exports = function(selectedTessel) {
  return new Promise(function(resolve) {
      console.log('usb test');
      resolve(selectedTessel);
  });
}