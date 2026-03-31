const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Existing channels ──────────────────────────────────────────────────────
  checkSystem: () => ipcRenderer.invoke('check-system'),
  detectDevice: () => ipcRenderer.invoke('detect-device'),
  installFirmware: (options) => ipcRenderer.invoke('install-firmware', options),
  installLibusb: () => ipcRenderer.invoke('install-libusb'),
  installWindowsDriver: () => ipcRenderer.invoke('install-windows-driver'),
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
  requestSudo: () => ipcRenderer.invoke('request-sudo'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  selectFirmwareFile: (fileType) => ipcRenderer.invoke('select-firmware-file', fileType),

  onInstallationProgress: (callback) => {
    ipcRenderer.on('installation-progress', (event, progress) => callback(progress));
  },
  removeInstallationProgressListener: () => {
    ipcRenderer.removeAllListeners('installation-progress');
  },

  // ── Wizard: discovery ─────────────────────────────────────────────────────
  discoverHomeAssistant: () => ipcRenderer.invoke('discover-home-assistant'),
  discoverNest: () => ipcRenderer.invoke('discover-nest'),
  cancelDiscovery: () => ipcRenderer.invoke('cancel-discovery'),

  // ── Wizard: configure ─────────────────────────────────────────────────────
  // opts: { nestIp, cloudregisterurl, sshMode, newPassword }
  configureNest: (opts) => ipcRenderer.invoke('configure-nest', opts),

  // ── Push event listeners (return cleanup function for useEffect) ──────────
  onDiscoveryProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('discovery-progress', handler);
    return () => ipcRenderer.removeListener('discovery-progress', handler);
  },

  onConfigProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('config-progress', handler);
    return () => ipcRenderer.removeListener('config-progress', handler);
  },
});
