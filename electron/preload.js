const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  track: (options) => ipcRenderer.invoke('track', options),
  checkIp: (options) => ipcRenderer.invoke('check-ip', options),
});
