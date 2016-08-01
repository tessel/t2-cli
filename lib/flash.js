// System Objects
// ...

// Third Party Dependencies
var async = require('async');

// Internal
var log = require('./log');

// Constants
var PAGE = 256;
var CHIP_ID = new Buffer([0x01, 0x02, 0x19]);

function address(addr) {
  return [(addr >> 24) & 0xFF, (addr >> 16) & 0xFF, (addr >> 8) & 0xFF, addr & 0xFF];
}

// Generate a mediatek factory partition
function factoryPartition(mac1, mac2) {
  return concatToBuffer(
    [0x20, 0x76, 0x03, 0x01],
    mac1,
    Array(30).fill(0xff),
    mac2
  );
}

function transaction(usbConnection, write, read, status_poll, wren, next) {
  read = read || 0;
  status_poll = status_poll || false;
  wren = wren || false;

  if (write.length > 500 || read >= Math.pow(2, 24)) {
    return next(new Error('Transaction too large'));
  }
  var flags = (status_poll ? 1 : 0) | ((wren ? 1 : 0) << 1);
  var hdr = [(read >> 0) & 0xff, (read >> 8) & 0xff, (read >> 16) & 0xff, flags];

  var data = concatToBuffer(hdr, write);

  usbConnection.epOut.transfer(data, (err) => {
    if (err) {
      return next(err);
    }
    if (read > 0) {
      return usbConnection.epIn.transfer(read, next);
    }
    next();
  });
}

function readChipId(usbConnection, next) {
  transaction(usbConnection, [0x9f], 3, null, null, next);
}

function checkChipId(chipId, next) {
  if (Buffer.compare(chipId, CHIP_ID) !== 0) {
    return next(new Error('Invalid chip ID (flash communication error)'));
  }
  next();
}

function setWriteEnabled(usbConnection, next) {
  transaction(usbConnection, [0x06], null, null, null, next);
}

function eraseChip(usbConnection, next) {
  transaction(usbConnection, [0x60], null, null, null, next);
}

// Poll for the WIP bit in the status register to go low
function waitTransactionComplete(usbConnection, next) {
  setTimeout(function onWait() {
    getStatus(usbConnection, (err, status) => {
      if (err) {
        return next(err);
      }
      if (status === 0) {
        return next();
      }
      process.nextTick(waitTransactionComplete, usbConnection, next);
    });
  }, 200);
}

// Read the status register
function getStatus(usbConnection, next) {
  transaction(usbConnection, [0x05], 1, null, null,(err, data) => {
    next(err, data ? data[0] : data);
  });
}

function write(usbConnection, writeAddress, data, sliceStart, next) {
  if (!next) {
    next = sliceStart;
    sliceStart = 0;
  }
  if (sliceStart >= data.length) {
    return next();
  }

  var sliceEnd = sliceStart + PAGE;
  var pageData = data.slice(sliceStart, sliceEnd);
  writePage(usbConnection, writeAddress, pageData, (err) => {
    if (err) {
      return next(err);
    }
    process.nextTick(write, usbConnection, writeAddress + PAGE, data, sliceEnd, next);
  });
}

function concatToBuffer() {
  var totalLength = 0;
  var buffers = [];
  var buffer;
  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i];
    buffer = new Buffer(arg);
    totalLength += buffer.length;
    buffers.push(buffer);
  }
  var result = new Buffer(totalLength);

  var byteIndex = 0;
  for (i = 0; i < buffers.length; i++) {
    buffer = buffers[i];
    buffer.copy(result, byteIndex);
    byteIndex += buffer.length;
  }

  return result;
}

// Write a page to flash
function writePage(usbConnection, addr, data, next) {
  var status_poll = true;
  var wren = true;
  transaction(
    usbConnection,
    concatToBuffer([0x12], address(addr), data),
    null,
    status_poll,
    wren,
    next
  );
}

// Returns a random integer, both low and high are inclusive
function randint(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function randbyte() {
  return randint(0, 255);
}

function asyncLog(msg, next) {
  log.info(msg);
  next();
}

module.exports = function flashDevice(usbConnection, ubootBuffer, squashfsBuffer, next) {
  var uid = [randbyte(), randbyte(), randbyte(), randbyte()];
  var mac1 = [0x02, 0xa3].concat(uid);
  var mac2 = [0x02, 0xa4].concat(uid);

  async.waterfall([
    asyncLog.bind(null, 'Checking the chip id...'),
    readChipId.bind(null, usbConnection),
    checkChipId,

    asyncLog.bind(null, 'Erasing the chip...'),
    setWriteEnabled.bind(null, usbConnection),
    eraseChip.bind(null, usbConnection),
    waitTransactionComplete.bind(null, usbConnection),

    asyncLog.bind(null, 'Writing uboot...'),
    write.bind(null, usbConnection, 0, ubootBuffer),
    waitTransactionComplete.bind(null, usbConnection),

    asyncLog.bind(null, 'Writing mediatek factory partition...'),
    write.bind(null, usbConnection, 0x40000, factoryPartition(mac1, mac2)),
    waitTransactionComplete.bind(null, usbConnection),

    asyncLog.bind(null, 'Writing squashfs...'),
    write.bind(null, usbConnection, 0x50000, squashfsBuffer),
    waitTransactionComplete.bind(null, usbConnection),
    asyncLog.bind(null, 'The update was successful.'),
    asyncLog.bind(null, 'Please power cycle your Tessel.')

  ], next);
};
