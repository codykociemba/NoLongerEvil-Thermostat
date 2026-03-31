const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');

// Load .env in development so NLE_DEBUG_SKIP_FLASH and similar flags work
if (process.env.NODE_ENV === 'development') {
  try { require('dotenv').config(); } catch {}
}
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
  if (process.env.NLE_DEBUG_SKIP_FLASH === 'true') {
    return {
      platform: process.platform,
      arch: process.arch,
      hasLibusb: true,
      needsLibusb: false,
      hasWindowsDriver: true,
      needsWindowsDriver: false,
      isAdmin: true,
      missingFiles: [],
    };
  }
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

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

ipcMain.handle('install-firmware', async (event, options) => {
  try {
    if (process.env.NLE_DEBUG_SKIP_FLASH === 'true') {
      const steps = [
        { stage: 'waiting', message: 'Detecting device...', percent: 0 },
        { stage: 'xload', message: 'Sending x-load bootloader...', percent: 33 },
        { stage: 'kernel', message: 'Flashing firmware...', percent: 66 },
        { stage: 'complete', message: 'Complete', percent: 100 },
      ];
      for (const step of steps) {
        sendToWindow('installation-progress', step);
        await new Promise(r => setTimeout(r, 600));
      }
      return { success: true, debug: true };
    }

    const generation = options?.generation || 'gen2';
    const customFiles = options?.customFiles || null;
    const result = await installFirmware((progress) => {
      sendToWindow('installation-progress', progress);
    }, generation, customFiles);
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

// ── Wizard: Home Assistant discovery ────────────────────────────────────────

ipcMain.handle('discover-home-assistant', async () => {
  try {
    const { discoverHA } = require('./ha-discovery');
    return await discoverHA((progress) => sendToWindow('discovery-progress', progress));
  } catch (error) {
    console.error('HA discovery error:', error);
    return { success: false, error: error.message };
  }
});

// ── Wizard: Nest discovery ───────────────────────────────────────────────────

ipcMain.handle('discover-nest', async () => {
  try {
    const { discoverNest } = require('./nest-discovery');
    return await discoverNest((progress) => {
      console.log('[nest-discovery]', JSON.stringify(progress));
      sendToWindow('discovery-progress', progress);
    });
  } catch (error) {
    console.error('Nest discovery error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-discovery', async () => {
  try {
    const { cancelHA } = require('./ha-discovery');
    cancelHA();
  } catch {}
  try {
    const { cancelNest } = require('./nest-discovery');
    cancelNest();
  } catch {}
  return { success: true };
});

// ── Wizard: Configure Nest (SSH + nleapi, single orchestrated call) ──────────
//
// SSH operation order: connect → serial → update URL → verify URL → SSH config last
// Disabling SSH before verifying the URL would leave the device misconfigured.

ipcMain.handle('configure-nest', async (event, opts) => {
  // opts: { nestIp, cloudregisterurl, sshMode, newPassword }
  // cloudregisterurl is null for hosted mode (no URL change needed)
  // sshMode is 'disable' | 'password' | 'keep'
  console.log('[configure-nest] starting', { nestIp: opts.nestIp, cloudregisterurl: opts.cloudregisterurl, sshMode: opts.sshMode });
  const { connectSSH, runCommand, changePassword, disableSSH } = require('./ssh-handler');
  const { configureNest, configureViaSetupWindow } = require('./nest-configure');

  let conn = null;

  try {
    // Step 1: Connect via SSH
    console.log('[configure-nest] connecting SSH...');
    sendToWindow('config-progress', { step: 'ssh_connect', status: 'active', message: 'Connecting via SSH...' });
    try {
      conn = await connectSSH(opts.nestIp);
    } catch (sshError) {
      // SSH unavailable — fall back to Phase 0 first-boot setup window
      console.log('[configure-nest] SSH failed:', sshError.message, '— trying setup window');
      sendToWindow('config-progress', { step: 'ssh_connect', status: 'skipped', message: `SSH unavailable (${sshError.message}) — trying first-boot window` });
      sendToWindow('config-progress', { step: 'serial', status: 'active', message: 'Trying first-boot setup window...' });

      const windowResult = await configureViaSetupWindow(opts.nestIp, opts.cloudregisterurl);

      sendToWindow('config-progress', { step: 'serial', status: 'done', message: `Serial: ${windowResult.serial} (via setup window)` });
      if (opts.cloudregisterurl) {
        sendToWindow('config-progress', { step: 'url', status: 'done', message: 'Server URL updated and verified (via setup window)' });
      }
      // SSH config cannot be performed without SSH
      if (opts.sshMode !== 'keep') {
        sendToWindow('config-progress', { step: 'ssh_config', status: 'skipped', message: 'SSH config skipped — SSH was unavailable' });
      }

      return { success: true, serial: windowResult.serial, cloudregisterurl: windowResult.cloudregisterurl };
    }

    console.log('[configure-nest] SSH connected');
    sendToWindow('config-progress', { step: 'ssh_connect', status: 'done', message: 'Connected via SSH' });

    // Step 2: Read serial (hostname = device serial)
    console.log('[configure-nest] reading serial...');
    sendToWindow('config-progress', { step: 'serial', status: 'active', message: 'Reading device serial...' });
    const serial = await runCommand(conn, 'hostname');
    console.log('[configure-nest] serial:', serial);
    sendToWindow('config-progress', { step: 'serial', status: 'done', message: `Serial: ${serial}` });

    // Step 3: Update cloudregisterurl (self-hosted only)
    let confirmedUrl = null;
    if (opts.cloudregisterurl) {
      console.log('[configure-nest] updating URL...');
      sendToWindow('config-progress', { step: 'url', status: 'active', message: 'Updating server URL...' });
      const result = await configureNest(opts.nestIp, serial, opts.cloudregisterurl);
      confirmedUrl = result.cloudregisterurl;
      console.log('[configure-nest] URL updated:', confirmedUrl);
      sendToWindow('config-progress', { step: 'url', status: 'done', message: 'Server URL updated and verified' });
    }

    // Step 4: SSH configuration — ALWAYS last (after URL is verified)
    if (opts.sshMode === 'disable') {
      console.log('[configure-nest] disabling SSH...');
      sendToWindow('config-progress', { step: 'ssh_config', status: 'active', message: 'Disabling SSH access...' });
      await disableSSH(conn);
      console.log('[configure-nest] SSH disabled');
      sendToWindow('config-progress', { step: 'ssh_config', status: 'done', message: 'SSH disabled' });
    } else if (opts.sshMode === 'password' && opts.newPassword) {
      console.log('[configure-nest] changing password...');
      sendToWindow('config-progress', { step: 'ssh_config', status: 'active', message: 'Updating SSH password...' });
      await changePassword(conn, opts.newPassword);
      console.log('[configure-nest] password changed');
      sendToWindow('config-progress', { step: 'ssh_config', status: 'done', message: 'SSH password updated' });
    } else {
      console.log('[configure-nest] skipping SSH config (mode:', opts.sshMode, ')');
      sendToWindow('config-progress', { step: 'ssh_config', status: 'skipped', message: 'SSH settings unchanged' });
    }

    console.log('[configure-nest] done, serial:', serial);
    return { success: true, serial, cloudregisterurl: confirmedUrl };
  } catch (error) {
    console.error('[configure-nest] error:', error.message);
    sendToWindow('config-progress', { step: 'error', status: 'error', message: error.message });
    return { success: false, error: error.message };
  } finally {
    if (conn) conn.end();
  }
});

// ── Firmware file selection ──────────────────────────────────────────────────

ipcMain.handle('select-firmware-file', async (event, fileType) => {
  try {
    const filters = [
      { name: 'Binary Files', extensions: ['bin'] }
    ];

    // For uImage, also allow files without extension
    if (fileType === 'uimage') {
      filters.unshift({ name: 'uImage', extensions: ['*'] });
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Select ${fileType} firmware file`,
      properties: ['openFile'],
      filters: filters
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    console.error('File selection error:', error);
    return { success: false, error: error.message };
  }
});
