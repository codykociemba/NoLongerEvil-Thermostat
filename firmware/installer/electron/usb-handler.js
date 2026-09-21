const path = require('path');
const fs = require('fs');

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
    rootfs: customFiles.rootfs || null,
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
    const gen1Paths = getFirmwarePaths('gen1');
    const gen2Paths = getFirmwarePaths('gen2');

    const missingFiles = [];
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
  // Windows driver check (keep existing logic)
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

        try {
          await installWinUSBDriver();

          if (progressCallback) {
            progressCallback({
              stage: 'driver',
              percent: 10,
              message: 'Device driver installed successfully.'
            });
          }
        } catch (driverInstallError) {
          // Check if driver is actually already working despite install error
          const recheckDriver = await checkDriverInstalled();
          if (recheckDriver.installed) {
            console.log('Driver installation reported error but driver is already functional, proceeding...');
            if (progressCallback) {
              progressCallback({
                stage: 'driver',
                percent: 10,
                message: 'Driver already installed and functional.'
              });
            }
          } else {
            throw driverInstallError;
          }
        }
      } else {
        console.log('WinUSB driver already installed for DFU device');
      }
    } catch (error) {
      console.error('Windows driver installation error:', error);
      throw new Error(`Failed to install Windows driver: ${error.message}`);
    }
  }

  // Use new native OMAP loader implementation
  try {
    const firmwarePaths = getFirmwarePaths(generation, customFiles);

    // Import the compiled TypeScript module (will be in dist-electron after build)
    let flashOmap;
    try {
      // Try compiled version first (production)
      flashOmap = require('../dist-electron/omapLoaderUsb').flashOmap;
    } catch (e) {
      // Fall back to requiring TypeScript directly (development with ts-node)
      try {
        require('ts-node/register');
        flashOmap = require('./omapLoaderUsb').flashOmap;
      } catch (tsError) {
        throw new Error('Failed to load OMAP loader module. Make sure TypeScript is compiled: ' + tsError.message);
      }
    }

    // Build file list for flashOmap
    const files = [
      { path: firmwarePaths.xload }, // First file always at base address (0x40200000)
      { path: firmwarePaths.uboot, addr: 0x80100000 },
      { path: firmwarePaths.uimage, addr: 0x80A00000 }
    ];

    // Only flash the root filesystem when the user provided a custom rootfs file
    if (customFiles && customFiles.rootfs) {
      files.push({ path: firmwarePaths.rootfs, addr: 0x81000000 });
    }

    const jumpTarget = 0x80100000; // Jump to U-Boot

    // Progress callback adapter to match flashOmap's interface
    const onProgress = (stage, message) => {
      if (!progressCallback) return;

      console.log(`[${stage}] ${message}`);

      // Map progress messages to UI stages and percentages
      if (message.includes('Scanning for USB device') || message.includes('Waiting for device')) {
        progressCallback({ stage: 'waiting', percent: 15, message: 'Scanning for USB device...' });
      } else if (message.includes('Found device') || message.includes('Successfully found')) {
        progressCallback({ stage: 'detected', percent: 25, message: 'Device detected!' });
      } else if (message.includes('Got ASIC ID') || message.includes('Reading ASIC ID')) {
        progressCallback({ stage: 'xload', percent: 35, message: 'Reading device information...' });
      } else if (message.includes('first-stage') || message.includes('BootROM')) {
        progressCallback({ stage: 'xload', percent: 45, message: 'Transferring first stage bootloader...' });
      } else if (message.includes('u-boot')) {
        progressCallback({ stage: 'uboot', percent: 65, message: 'Transferring second stage bootloader...' });
      } else if (message.includes('uImage') || message.includes('kernel')) {
        progressCallback({ stage: 'kernel', percent: 75, message: 'Transferring Linux kernel...' });
      } else if (message.includes('rootfs')) {
        progressCallback({ stage: 'rootfs', percent: 85, message: 'Flashing Root FS......'});
      } else if (message.includes('Jump command sent') || message.includes('jumping to address')) {
        progressCallback({ stage: 'complete', percent: 95, message: 'Device is booting...' });
      } else if (message.includes('Successfully transferred') || message.includes('successfully transfered')) {
        progressCallback({ stage: 'complete', percent: 100, message: 'Installation complete!' });
      }
    };

    // Execute flash operation
    await flashOmap(files, {
      vendor: OMAP_DFU_VENDOR_ID,
      product: OMAP_DFU_PRODUCT_ID,
      jumpTarget,
      verbose: true,
      onProgress
    });

    // Success
    return {
      success: true,
      progress: {
        hasXload: true,
        hasUboot: true,
        hasKernel: true,
        hasJump: true
      }
    };

  } catch (error) {
    console.error('Firmware installation error:', error);
    throw error;
  }
}

module.exports = {
  checkSystem,
  detectDevice,
  installFirmware,
  checkIsAdmin,
  OMAP_DFU_VENDOR_ID,
  OMAP_DFU_PRODUCT_ID
};
