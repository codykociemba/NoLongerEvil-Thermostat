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
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', relativePath);
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
    try {
      fs.chmodSync(binaryPath, '755');
    } catch (error) {
      // Ignore chmod errors in read-only locations (e.g., macOS App Translocation)
      console.log('Could not chmod binary (may be in read-only location):', error.message);
    }
  } else {
    const dllPath = getResourcePath(path.join('binaries', 'libusb-1.0.dll'));
    if (!fs.existsSync(dllPath)) {
      throw new Error(`libusb DLL not found at ${dllPath}`);
    }
  }

  return binaryPath;
}

function getFirmwarePaths(generation = 'gen2', customFiles = null) {
  const firmwareDir = getResourcePath('firmware');

  const defaultPaths = {
    xload: path.join(firmwareDir, `x-load-${generation}.bin`),
    uboot: path.join(firmwareDir, 'u-boot.bin'),
    uimage: path.join(firmwareDir, 'uImage'),
  };

  if (!customFiles) {
    return defaultPaths;
  }

  return {
    xload: customFiles.xload || defaultPaths.xload,
    uboot: customFiles.uboot || defaultPaths.uboot,
    uimage: customFiles.uimage || defaultPaths.uimage,
  };
}


async function checkLibusb() {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return true;
  }

  try {
    require('usb');
    return true;
  } catch (err) {
    console.error('USB module load error:', err);
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
      needsWindowsDriver = !driverCheck.installed;
      hasWindowsDriver = driverCheck.installed;
    } catch (error) {
      console.error('Error checking Windows driver:', error);
      needsWindowsDriver = true;
      hasWindowsDriver = false;
    }
  }

  try {
    const binaryPath = getBinaryPath();
    const gen1Paths = getFirmwarePaths('gen1');
    const gen2Paths = getFirmwarePaths('gen2');

    const missingFiles = [];
    if (!fs.existsSync(binaryPath)) missingFiles.push('omap_loader binary');
    if (!fs.existsSync(gen1Paths.xload)) missingFiles.push('x-load-gen1.bin');
    if (!fs.existsSync(gen2Paths.xload)) missingFiles.push('x-load-gen2.bin');
    if (!fs.existsSync(gen1Paths.uboot) || !fs.existsSync(gen2Paths.uboot)) missingFiles.push('u-boot.bin');
    if (!fs.existsSync(gen1Paths.uimage) || !fs.existsSync(gen2Paths.uimage)) missingFiles.push('uImage');

    const hasRequiredFiles = missingFiles.length === 0;

    return {
      platform,
      arch,
      hasLibusb,
      needsLibusb,
      isAdmin,
      needsAdmin,
      needsWindowsDriver,
      hasWindowsDriver,
      hasRequiredFiles,
      missingFiles,
      binaryPath,
      firmwarePaths: {
        gen1: gen1Paths,
        gen2: gen2Paths
      }
    };
  } catch (error) {
    console.error('System check error:', error);
    return {
      platform,
      arch,
      hasLibusb,
      needsLibusb,
      isAdmin,
      needsAdmin,
      error: error.message
    };
  }
}

async function detectDevice() {
  const usb = require('usb');

  try {
    const devices = usb.getDeviceList();
    const omapDevices = devices.filter(device =>
      device.deviceDescriptor.idVendor === OMAP_DFU_VENDOR_ID &&
      device.deviceDescriptor.idProduct === OMAP_DFU_PRODUCT_ID
    );

    return {
      success: true,
      devices: omapDevices.map(device => ({
        busNumber: device.busNumber,
        deviceAddress: device.deviceAddress,
        deviceDescriptor: device.deviceDescriptor
      }))
    };
  } catch (error) {
    console.error('Device detection error:', error);
    return { success: false, error: error.message };
  }
}

async function installFirmware(progressCallback, generation = 'gen2', customFiles = null) {
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
          progressCallback({
            stage: 'driver',
            percent: 5,
            message: 'Installing device driver...'
          });
        }

        await installWinUSBDriver();

        if (progressCallback) {
          progressCallback({
            stage: 'driver',
            percent: 10,
            message: 'Device driver installed successfully.'
          });
        }
      }
    } catch (error) {
      console.error('Windows driver installation error:', error);
      throw new Error(`Failed to install Windows driver: ${error.message}`);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const binaryPath = getBinaryPath();
      const firmwarePaths = getFirmwarePaths(generation, customFiles);

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

      // Windows: create batch file and tail log (unchanged)
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

        spawnOptions.shell = true;
        spawnOptions.windowsHide = false;

        command = `"${batchFile}"`;
        spawnArgs = [];

        let lastSize = 0;
        let watchInterval;

        const watchLogFile = () => {
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
                progressCallback({ stage: 'xload', percent: 35, message: 'Reading device information...' });
              } else if (newContent.includes('x-load.bin')) {
                progressCallback({ stage: 'xload', percent: 45, message: 'Transferring first stage bootloader...' });
              } else if (newContent.includes('u-boot.bin')) {
                progressCallback({ stage: 'uboot', percent: 65, message: 'Transferring second stage bootloader...' });
              } else if (newContent.includes('uImage')) {
                progressCallback({ stage: 'kernel', percent: 85, message: 'Transferring Linux kernel...' });
              } else if (newContent.includes('[+] successfully transfered')) {
                progressCallback({ stage: 'complete', percent: 100, message: 'Installation complete!' });
              }
            }

            lastSize = stats.size;
          }
        };

        watchInterval = setInterval(watchLogFile, 200);

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

        let lastSize = 0;
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

        const watchInterval = setInterval(watchLogFile, 200);

        const options = {
          name: 'NoLongerEvil Installer'
        };

        const sudoCommand =
          `/bin/bash -c "exec > \\"${logFile}\\" 2>&1; ` +
          `\\"${binaryPath}\\" -f \\"${tmpFirmwarePaths.xload}\\" -f \\"${tmpFirmwarePaths.uboot}\\" ` +
          `-a 0x80100000 -f \\"${tmpFirmwarePaths.uimage}\\" -a 0x80A00000 -v -j 0x80100000"`;

        sudo.exec(sudoCommand, options, (error, stdout, stderr) => {
          clearInterval(watchInterval);

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
            const progress = {
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
        console.log('stdout:', output);

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
        console.error('stderr:', output);
      });

      childProcess.on('close', (code) => {
        const finalOutput = stdout + stderr;
        console.log(`omap_loader process exited with code ${code}`);

        if (code === 0) {
          const hasTransferred = finalOutput.includes('[+] successfully transfered');
          const hasJump = finalOutput.includes('[+] jumping to address');
          const hasSendJump = finalOutput.includes('[+] sending jump command');

          if (hasTransferred || hasJump || hasSendJump) {
            const progress = {
              hasXload: finalOutput.includes('x-load.bin'),
              hasUboot: finalOutput.includes('u-boot.bin'),
              hasKernel: finalOutput.includes('uImage'),
              hasJump: hasJump || hasTransferred
            };

          resolve({
            success: true,
              stdout: finalOutput,
              stderr,
              progress
            });
          } else {
            resolve({
              success: false,
              error: finalOutput || 'Installation failed',
              stdout: finalOutput,
            stderr
          });
          }
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
