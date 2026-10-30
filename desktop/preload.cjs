// Sandboxed Electron preload scripts require CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopControls', {
  bounds: () => ipcRenderer.invoke('desktop:bounds'),
  setBounds: (bounds) => ipcRenderer.invoke('desktop:setBounds', bounds),
  fit: () => ipcRenderer.invoke('desktop:fit'),
  setOpacity: (value) => ipcRenderer.invoke('desktop:opacity', value),
  setCardOpacity: (value) => ipcRenderer.invoke('desktop:cardOpacity', value),
  onAppearance: (callback) => { ipcRenderer.on('desktop:appearance', (_event, value) => callback(value)); },
  openBrowser: () => ipcRenderer.invoke('desktop:browser'),
  pasteLogin: () => ipcRenderer.invoke('desktop:login'),
  retry: () => ipcRenderer.invoke('desktop:retry'),
  hide: () => ipcRenderer.invoke('desktop:hide'),
  show: () => ipcRenderer.invoke('desktop:show'),
  quit: () => ipcRenderer.invoke('desktop:quit'),
  onStatus: (callback) => { ipcRenderer.on('desktop:status', (_event, message) => callback(message)); },
  onAuthStatus: (callback) => { ipcRenderer.on('desktop:auth-status', (_event, message) => callback(message)); },
});
