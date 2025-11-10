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
    icon: path.join(__dirname, '../build/icon.png'),
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
  const execPromise = util.promisify(exec);

  try {
    if (process.platform === 'darwin') {
      const brewPath = process.arch === 'arm64' ? '/opt/homebrew/bin/brew' : '/usr/local/bin/brew';
      await execPromise(`${brewPath} install libusb`);
      return { success: true };
    }
    return { success: false, error: 'Only supported on macOS' };
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
