var cp = require('child_process');

if (!process.env.MOCK_USB) {
  cp.execSync('npm install usb@1.1.1');
}

cp.execSync('t2 install-drivers || true');
