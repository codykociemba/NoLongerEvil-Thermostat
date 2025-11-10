const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkSystem: () => ipcRenderer.invoke('check-system'),
  detectDevice: () => ipcRenderer.invoke('detect-device'),
  installFirmware: (options) => ipcRenderer.invoke('install-firmware', options),
  installLibusb: () => ipcRenderer.invoke('install-libusb'),
  installWindowsDriver: () => ipcRenderer.invoke('install-windows-driver'),
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
  requestSudo: () => ipcRenderer.invoke('request-sudo'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onInstallationProgress: (callback) => {
    ipcRenderer.on('installation-progress', (event, progress) => callback(progress));
  },
  removeInstallationProgressListener: () => {
    ipcRenderer.removeAllListeners('installation-progress');
  },
});
