// Sandboxed Electron preload scripts require CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rcapDesktopAuth', {
  report: (state) => ipcRenderer.send('desktop:auth-state', state),
});
