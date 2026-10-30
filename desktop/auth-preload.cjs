// Sandboxed Electron preload scripts require CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rcapDesktopAuth', {
  openBrowserLogin: () => ipcRenderer.invoke('desktop:browser-login'),
  onAuthorization: (callback) => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('desktop:authorize-token', listener);
    return () => ipcRenderer.removeListener('desktop:authorize-token', listener);
  },
  report: (state) => ipcRenderer.send('desktop:auth-state', state),
});
