const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { checkSystem, installFirmware, detectDevice } = require('./usb-handler');
const { installWinUSBDriver } = require('./windows-driver');

let mainWindow;

function createWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowConfig = {
    width: Math.min(1000, width),
    height: Math.min(900, height - 100),
    minWidth: 800,
    minHeight: 700,
    center: true,
    title: 'No Longer Evil Thermostat Setup',
    icon: path.join(__dirname, '../build/appicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0f172a',
  };

  if (process.platform === 'darwin') {
    windowConfig.titleBarStyle = 'hidden';
    windowConfig.trafficLightPosition = { x: 15, y: 15 };
  }

  mainWindow = new BrowserWindow(windowConfig);

  mainWindow.setMenuBarVisibility(false);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('check-system', async () => {
  try {
    return await checkSystem();
  } catch (error) {
    console.error('System check error:', error);
    return {
      success: false,
      error: error.message,
      platform: process.platform,
      arch: process.arch
    };
  }
});

ipcMain.handle('detect-device', async () => {
  try {
    return await detectDevice();
  } catch (error) {
    console.error('Device detection error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-firmware', async (event, options) => {
  try {
    const result = await installFirmware((progress) => {
      mainWindow.webContents.send('installation-progress', progress);
    });
    return result;
  } catch (error) {
    console.error('Installation error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-libusb', async () => {
  const { exec } = require('child_process');
  const util = require('util');
  const fs = require('fs');
  const execPromise = util.promisify(exec);

  try {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Only supported on macOS' };
    }

    // Find Homebrew installation
    const possibleBrewPaths = [
      '/opt/homebrew/bin/brew', // Apple Silicon
      '/usr/local/bin/brew',    // Intel
    ];

    let brewPath = null;
    for (const path of possibleBrewPaths) {
      if (fs.existsSync(path)) {
        brewPath = path;
        break;
      }
    }

    // If not found in standard locations, try to find via which
    if (!brewPath) {
      try {
        const { stdout } = await execPromise('which brew');
        brewPath = stdout.trim();
      } catch (e) {
        // which brew failed, brew not found
      }
    }

    // If Homebrew not found, install it
    if (!brewPath) {
      try {
        // Install Homebrew using official install script
        await execPromise('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');

        // Check standard locations again
        for (const path of possibleBrewPaths) {
          if (fs.existsSync(path)) {
            brewPath = path;
            break;
          }
        }

        if (!brewPath) {
          return {
            success: false,
            error: 'Homebrew installation completed but could not locate brew executable. Please restart the application.'
          };
        }
      } catch (installError) {
        return {
          success: false,
          error: `Failed to install Homebrew: ${installError.message}. Please install manually from https://brew.sh`
        };
      }
    }

    // Install libusb and pkg-config using found brew path
    await execPromise(`${brewPath} install libusb pkg-config`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-platform-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.getSystemVersion(),
  };
});

ipcMain.handle('request-sudo', async () => {
  if (process.platform === 'win32') {
    return { success: true };
  }

  return { success: true };
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-windows-driver', async () => {
  try {
    if (process.platform !== 'win32') {
      return { success: true, message: 'Not on Windows, driver installation not needed' };
    }

    const { checkIsAdmin } = require('./usb-handler');
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      return {
        success: false,
        error: 'Administrator privileges are required to install the USB driver. Please run this application as Administrator.'
      };
    }

    const result = await installWinUSBDriver();
    return result;
  } catch (error) {
    console.error('Windows driver installation error:', error);
    return { success: false, error: error.message };
  }
});
