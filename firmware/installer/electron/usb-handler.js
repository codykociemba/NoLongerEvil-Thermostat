const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OMAP_DFU_VENDOR_ID = 0x0451;
const OMAP_DFU_PRODUCT_ID = 0xd00e;

function getResourcePath(relativePath) {
  let app;
  try {
    app = require('electron').app;
  } catch (e) {
    app = null;
  }

  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '..', 'resources', relativePath);
}

function getBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;

  let binaryName;
  if (platform === 'darwin') {
    binaryName = arch === 'arm64' ? 'omap_loader-macos-arm64' : 'omap_loader-macos-x64';
  } else if (platform === 'win32') {
    binaryName = 'omap_loader-win-x64.exe';
  } else if (platform === 'linux') {
    binaryName = 'omap_loader-linux-x64';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const binaryPath = getResourcePath(path.join('binaries', binaryName));

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Binary not found at ${binaryPath}`);
  }

  if (platform !== 'win32') {
    fs.chmodSync(binaryPath, '755');
  } else {
    const dllPath = getResourcePath(path.join('binaries', 'libusb-1.0.dll'));
    if (!fs.existsSync(dllPath)) {
      throw new Error(`libusb DLL not found at ${dllPath}`);
    }
  }

  return binaryPath;
}

function getFirmwarePaths(generation = 'gen2') {
  const firmwareDir = getResourcePath('firmware');

  return {
    xload: path.join(firmwareDir, `x-load-${generation}.bin`),
    uboot: path.join(firmwareDir, 'u-boot.bin'),
    uimage: path.join(firmwareDir, 'uImage')
  };
}

async function checkLibusb() {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return true;
  }

  try {
    require('usb');
    return true;
  } catch (error) {
    console.error('USB module load error:', error);
    return false;
  }
}

async function checkIsAdmin() {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec('NET SESSION', (err, stdout, stderr) => {
        resolve(stderr.length === 0);
      });
    });
  }
  return true;
}

async function checkSystem() {
  const platform = process.platform;
  const arch = process.arch;
  const hasLibusb = await checkLibusb();
  const isAdmin = await checkIsAdmin();

  let needsLibusb = platform === 'darwin' || platform === 'linux';
  let needsAdmin = platform === 'win32' ? !isAdmin : false;
  let needsWindowsDriver = false;
  let hasWindowsDriver = false;

  if (platform === 'win32') {
    try {
      const { checkDriverInstalled } = require('./windows-driver');
      const driverCheck = await checkDriverInstalled();
      hasWindowsDriver = driverCheck.installed || false;
      needsWindowsDriver = !hasWindowsDriver;
    } catch (error) {
      console.error('Error checking Windows driver:', error);
      needsWindowsDriver = true;
      hasWindowsDriver = false;
    }
  }

  try {
    const binaryPath = getBinaryPath();
    const firmwarePaths = getFirmwarePaths();

    const missingFiles = [];
    if (!fs.existsSync(binaryPath)) missingFiles.push('omap_loader binary');
    if (!fs.existsSync(firmwarePaths.xload)) missingFiles.push('x-load.bin');
    if (!fs.existsSync(firmwarePaths.uboot)) missingFiles.push('u-boot.bin');
    if (!fs.existsSync(firmwarePaths.uimage)) missingFiles.push('uImage');

    return {
      success: true,
      platform,
      arch,
      hasLibusb,
      needsLibusb,
      needsAdmin,
      isAdmin,
      needsWindowsDriver,
      hasWindowsDriver,
      binaryPath,
      missingFiles,
      ready: missingFiles.length === 0 && (!needsAdmin || isAdmin) && (!needsWindowsDriver || hasWindowsDriver)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      platform,
      arch,
      hasLibusb,
      needsLibusb,
      needsAdmin,
      isAdmin,
      needsWindowsDriver,
      hasWindowsDriver
    };
  }
}

async function detectDevice() {
  try {
    const usb = require('usb');

    const devices = usb.getDeviceList();
    const omapDevice = devices.find(device =>
      device.deviceDescriptor.idVendor === OMAP_DFU_VENDOR_ID &&
      device.deviceDescriptor.idProduct === OMAP_DFU_PRODUCT_ID
    );

    if (omapDevice) {
      return {
        success: true,
        detected: true,
        vendorId: OMAP_DFU_VENDOR_ID,
        productId: OMAP_DFU_PRODUCT_ID
      };
    }

    return {
      success: true,
      detected: false
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function installFirmware(progressCallback, generation = 'gen2') {
  if (process.platform === 'win32') {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      throw new Error('Administrator privileges are required to install the USB driver. Please run this application as Administrator.');
    }

    try {
      const { checkDriverInstalled, installWinUSBDriver } = require('./windows-driver');

      const driverCheck = await checkDriverInstalled();

      if (!driverCheck.installed) {
        console.log('Installing WinUSB driver for Windows...');

        if (progressCallback) {
          progressCallback({ stage: 'driver', percent: 5, message: 'Installing USB driver...' });
        }

        const driverResult = await installWinUSBDriver();
        console.log('Driver installation result:', driverResult);

        if (!driverResult.success) {
          throw new Error(`Failed to install Windows USB driver: ${driverResult.error || 'Unknown error'}`);
        }

        if (progressCallback) {
          progressCallback({ stage: 'driver', percent: 10, message: 'USB driver installed successfully' });
        }
      } else {
        console.log('WinUSB driver already installed, skipping installation');
        if (progressCallback) {
          progressCallback({ stage: 'driver', percent: 10, message: 'USB driver already installed' });
        }
      }
    } catch (error) {
      console.error('Windows driver check/installation failed:', error);
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const binaryPath = getBinaryPath();
      const firmwarePaths = getFirmwarePaths(generation);

      const args = [
        '-f', firmwarePaths.xload,
        '-f', firmwarePaths.uboot,
        '-a', '0x80100000',
        '-f', firmwarePaths.uimage,
        '-a', '0x80A00000',
        '-v',
        '-j', '0x80100000'
      ];

      let command = binaryPath;
      let spawnArgs = args;
      let spawnOptions = {};

      if (process.platform === 'win32') {
        console.log('Setting up Windows batch file for omap_loader...');
        console.log('Binary path:', binaryPath);
        console.log('Args:', args);

        const tmpDir = path.join(os.tmpdir(), `nle_firmware_${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        const logFile = path.join(tmpDir, 'install.log');
        fs.writeFileSync(logFile, '');

        const batchFile = path.join(tmpDir, 'install.bat');
        const batchContent = `@echo off
"${binaryPath}" ${args.map(a => `"${a}"`).join(' ')} > "${logFile}" 2>&1
`;
        fs.writeFileSync(batchFile, batchContent);

        console.log('Created batch file:', batchFile);
        console.log('Log file:', logFile);
        console.log('Batch content:', batchContent);

        command = batchFile;
        spawnArgs = [];
        spawnOptions = {
          shell: true,
          cwd: path.dirname(binaryPath),
          env: { ...process.env, PATH: `${path.dirname(binaryPath)};${process.env.PATH}` }
        };

        let lastSize = 0;
        let watchInterval = setInterval(() => {
          if (!fs.existsSync(logFile)) {
            return;
          }

          const stats = fs.statSync(logFile);
          if (stats.size > lastSize) {
            const newContent = fs.readFileSync(logFile, 'utf8').substring(lastSize);
            console.log('omap_loader output:', newContent);

            if (progressCallback) {
              if (newContent.includes('[+] scanning for USB device')) {
                progressCallback({ stage: 'waiting', percent: 15, message: 'Scanning for USB device...' });
              } else if (newContent.includes('[+] successfully opened')) {
                progressCallback({ stage: 'detected', percent: 25, message: 'Device detected!' });
              } else if (newContent.includes('[+] got ASIC ID')) {
                progressCallback({ stage: 'xload', percent: 35, message: 'Reading device info...' });
              } else if (newContent.includes("uploading 'u-boot.bin'")) {
                progressCallback({ stage: 'uboot', percent: 50, message: 'Uploading u-boot...' });
              } else if (newContent.includes("uploading 'uImage'")) {
                progressCallback({ stage: 'kernel', percent: 65, message: 'Uploading kernel (this may take a minute)...' });
              } else if (newContent.includes('[+] sending jump command')) {
                progressCallback({ stage: 'kernel', percent: 90, message: 'Finalizing installation...' });
              } else if (newContent.includes('[+] successfully transfered')) {
                progressCallback({ stage: 'complete', percent: 100, message: 'Installation complete!' });
              }
            }

            lastSize = stats.size;
          }
        }, 200);

        spawnOptions._logFile = logFile;
        spawnOptions._tmpDir = tmpDir;
        spawnOptions._batchFile = batchFile;
        spawnOptions._watchInterval = watchInterval;
      }

      if (process.platform !== 'win32') {
        const sudo = require('sudo-prompt');

        const tmpDir = path.join(os.tmpdir(), `nle_firmware_${Date.now()}`);
        fs.mkdirSync(tmpDir, { mode: 0o755 });

        const tmpFirmwarePaths = {
          xload: path.join(tmpDir, 'x-load.bin'),
          uboot: path.join(tmpDir, 'u-boot.bin'),
          uimage: path.join(tmpDir, 'uImage')
        };

        try {
          fs.copyFileSync(firmwarePaths.xload, tmpFirmwarePaths.xload);
          fs.copyFileSync(firmwarePaths.uboot, tmpFirmwarePaths.uboot);
          fs.copyFileSync(firmwarePaths.uimage, tmpFirmwarePaths.uimage);

          fs.chmodSync(tmpFirmwarePaths.xload, 0o644);
          fs.chmodSync(tmpFirmwarePaths.uboot, 0o644);
          fs.chmodSync(tmpFirmwarePaths.uimage, 0o644);
        } catch (copyError) {
          console.error('Failed to copy firmware files:', copyError);
          reject(copyError);
          return;
        }

        const logFile = path.join(tmpDir, 'install.log');
        fs.writeFileSync(logFile, '', { mode: 0o644 });

        const wrapperScript = path.join(tmpDir, 'install.sh');
        const scriptContent = `#!/bin/bash
exec > "${logFile}" 2>&1
"${binaryPath}" -f "${tmpFirmwarePaths.xload}" -f "${tmpFirmwarePaths.uboot}" -a 0x80100000 -f "${tmpFirmwarePaths.uimage}" -a 0x80A00000 -v -j 0x80100000
`;

        fs.writeFileSync(wrapperScript, scriptContent, { mode: 0o755 });

        console.log('Created wrapper script:', wrapperScript);
        console.log('Log file:', logFile);

        let lastSize = 0;
        let watchInterval;

        const watchLogFile = () => {
          if (!fs.existsSync(logFile)) {
            return;
          }

          const stats = fs.statSync(logFile);

          if (stats.size > lastSize) {
            const stream = fs.createReadStream(logFile, {
              start: lastSize,
              end: stats.size
            });

            let chunk = '';
            stream.on('data', (data) => {
              chunk += data.toString();
            });

            stream.on('end', () => {
              if (chunk && progressCallback) {
                console.log('New output:', chunk);

                if (chunk.includes('[+] scanning for USB device')) {
                  progressCallback({ stage: 'waiting', percent: 10, message: 'Scanning for USB device...' });
                } else if (chunk.includes('[+] successfully opened')) {
                  progressCallback({ stage: 'detected', percent: 20, message: 'Device detected!' });
                } else if (chunk.includes('[+] got ASIC ID')) {
                  progressCallback({ stage: 'xload', percent: 30, message: 'Reading device info...' });
                } else if (chunk.includes("uploading 'u-boot.bin'")) {
                  progressCallback({ stage: 'uboot', percent: 50, message: 'Uploading u-boot...' });
                } else if (chunk.includes("uploading 'uImage'")) {
                  progressCallback({ stage: 'kernel', percent: 60, message: 'Uploading kernel (this may take a minute)...' });
                } else if (chunk.includes('[+] sending jump command')) {
                  progressCallback({ stage: 'kernel', percent: 90, message: 'Finalizing installation...' });
                } else if (chunk.includes('[+] jumping to address')) {
                  progressCallback({ stage: 'complete', percent: 95, message: 'Device is booting...' });
                } else if (chunk.includes('[+] successfully transfered')) {
                  progressCallback({ stage: 'complete', percent: 100, message: 'Installation complete!' });
                }
              }
              lastSize = stats.size;
            });
          }
        };

        watchInterval = setInterval(watchLogFile, 200);

        const options = {
          name: 'NoLongerEvil Installer'
        };

        sudo.exec(`"${wrapperScript}"`, options, (error, stdout, stderr) => {
          clearInterval(watchInterval);

          console.log('Installation complete');

          let finalOutput = '';
          if (fs.existsSync(logFile)) {
            finalOutput = fs.readFileSync(logFile, 'utf8');
          }

          console.log('Final output:', finalOutput);
          console.log('Stdout:', stdout);
          console.log('Stderr:', stderr);

          try {
            if (fs.existsSync(tmpFirmwarePaths.xload)) fs.unlinkSync(tmpFirmwarePaths.xload);
            if (fs.existsSync(tmpFirmwarePaths.uboot)) fs.unlinkSync(tmpFirmwarePaths.uboot);
            if (fs.existsSync(tmpFirmwarePaths.uimage)) fs.unlinkSync(tmpFirmwarePaths.uimage);
            if (fs.existsSync(wrapperScript)) fs.unlinkSync(wrapperScript);
            if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }

          if (error) {
            console.error('Error:', error);
            reject(error);
            return;
          }

          const combinedOutput = finalOutput + stdout + stderr;

          const hasTransferred = combinedOutput.includes('[+] successfully transfered');
          const hasJump = combinedOutput.includes('[+] jumping to address');
          const hasSendJump = combinedOutput.includes('[+] sending jump command');

          if (hasTransferred || hasJump || hasSendJump) {
            let progress = {
              hasXload: combinedOutput.includes('x-load.bin'),
              hasUboot: combinedOutput.includes('u-boot.bin'),
              hasKernel: combinedOutput.includes('uImage'),
              hasJump: hasJump || hasTransferred
            };

            resolve({
              success: true,
              stdout: combinedOutput,
              stderr,
              progress
            });
          } else {
            resolve({
              success: false,
              error: combinedOutput || 'Installation failed',
              stdout: combinedOutput,
              stderr
            });
          }
        });

        return;
      }

      const childProcess = spawn(command, spawnArgs, spawnOptions);

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('omap_loader stdout:', output);

        if (progressCallback) {
          if (output.includes('x-load')) {
            progressCallback({ stage: 'xload', percent: 25, message: 'Flashing x-load...' });
          } else if (output.includes('u-boot')) {
            progressCallback({ stage: 'uboot', percent: 50, message: 'Flashing u-boot...' });
          } else if (output.includes('uImage') || output.includes('kernel')) {
            progressCallback({ stage: 'kernel', percent: 75, message: 'Flashing kernel...' });
          } else if (output.includes('jump') || output.includes('complete')) {
            progressCallback({ stage: 'complete', percent: 100, message: 'Installation complete!' });
          }
        }
      });

      childProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('omap_loader stderr:', output);
      });

      childProcess.on('close', (code) => {
        console.log('omap_loader exited with code:', code);

        if (spawnOptions._watchInterval) {
          clearInterval(spawnOptions._watchInterval);
        }

        let finalOutput = stdout;
        if (spawnOptions._logFile && fs.existsSync(spawnOptions._logFile)) {
          finalOutput = fs.readFileSync(spawnOptions._logFile, 'utf8');
          console.log('Final log file output:', finalOutput);

          try {
            if (fs.existsSync(spawnOptions._batchFile)) fs.unlinkSync(spawnOptions._batchFile);
            if (fs.existsSync(spawnOptions._logFile)) fs.unlinkSync(spawnOptions._logFile);
            if (fs.existsSync(spawnOptions._tmpDir)) fs.rmdirSync(spawnOptions._tmpDir);
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }
        } else {
          console.log('Final stdout:', stdout);
          console.log('Final stderr:', stderr);
        }

        if (code === 0) {
          resolve({
            success: true,
            stdout: finalOutput || stdout,
            stderr
          });
        } else {
          reject(new Error(`Installation failed with code ${code}\n${finalOutput || stderr}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  checkSystem,
  detectDevice,
  installFirmware,
  checkIsAdmin,
  OMAP_DFU_VENDOR_ID,
  OMAP_DFU_PRODUCT_ID
};
