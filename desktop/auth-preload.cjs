// Sandboxed Electron preload scripts require CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
window.addEventListener('focusin', () => ipcRenderer.send('desktop:focus-content'), true);
window.addEventListener('pointerup', () => ipcRenderer.send('desktop:focus-content'), true);

contextBridge.exposeInMainWorld('rcapDesktopAuth', {
  openBrowserLogin: () => ipcRenderer.invoke('desktop:browser-login'),
  onAuthorization: (callback) => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('desktop:authorize-token', listener);
    return () => ipcRenderer.removeListener('desktop:authorize-token', listener);
  },
  report: (state) => ipcRenderer.send('desktop:auth-state', state),
  getAppearance: () => ipcRenderer.invoke('desktop:get-appearance'),
  applyAppearance: (value) => ipcRenderer.invoke('desktop:apply-appearance', value),
  onAppearanceChange: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('desktop:appearance-change', listener);
    return () => ipcRenderer.removeListener('desktop:appearance-change', listener);
  },
});
