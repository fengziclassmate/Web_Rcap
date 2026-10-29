import { app, BrowserWindow, WebContentsView, Menu, Tray, clipboard, dialog, ipcMain, screen, shell } from 'electron';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedNavigation, loginLink, workbenchUrl } from './url-policy.mjs';
import { connectDesktop } from './native-layer.mjs';

const folder = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(folder, 'app-config.json'), 'utf8'));
const argument = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const target = workbenchUrl(config.url, argument('url'), app.isPackaged);
app.setName('RCAP Desktop');
if (argument('data-dir')) {
  const dataDir = path.resolve(argument('data-dir'));
  mkdirSync(dataDir, { recursive: true });
  app.setPath('userData', dataDir);
}

let window;
let view;
let tray;
let quitting = false;
let opacity = 85;
let themeReady = false;
let desktopBounds;
let layer;
const theme = readFileSync(path.join(folder, 'theme.css'), 'utf8');

function placeWindow() {
  return layer.request('place', screen.dipToScreenRect(null, desktopBounds));
}

function showWindow() {
  void layer.request('show').catch((error) => status(error.message));
}

function status(message) {
  window.webContents.send('desktop:status', message);
}

async function updateOpacity() {
  if (!themeReady) return;
  await view.webContents.executeJavaScriptInIsolatedWorld(1, [{ code: `document.documentElement.style.setProperty('--desktop-opacity', '${opacity}%')` }]);
}

async function load(url = target.href) {
  status('');
  view.setVisible(true);
  try { await view.webContents.loadURL(url); }
  catch (error) {
    if (error.code === 'ERR_ABORTED') return; // A newer navigation or reload replaced this request.
    console.error('Workbench load failed:', error.code);
    view.setVisible(false);
    status('工作台加载失败，请检查网络后重新加载。');
  }
}

async function openExternal(url) {
  const parsed = new URL(url);
  if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error('不支持打开这种链接。');
  await shell.openExternal(parsed.href);
}

async function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  desktopBounds = { x: area.x + 16, y: area.y + 16, width: area.width - 32, height: area.height - 32 };
  window = new BrowserWindow({
    title: '研究手札桌面工作台',
    ...desktopBounds,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, minWidth: 900, minHeight: 560,
    show: false, skipTaskbar: true, alwaysOnTop: false, hasShadow: false,
    icon: path.join(folder, 'icon.ico'),
    webPreferences: { preload: path.join(folder, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  view = new WebContentsView({ webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
  view.setBackgroundColor('#00000000');
  window.contentView.addChildView(view);
  function fitView() {
    const [width, height] = window.getContentSize();
    view.setBounds({ x: 0, y: 36, width, height: height - 46 });
  }
  fitView();
  window.on('resize', fitView);

  view.webContents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) themeReady = false; });
  view.webContents.on('dom-ready', () => {
    themeReady = true;
    void view.webContents.insertCSS(theme).then(updateOpacity).catch((error) => {
      console.error(error);
      status('桌面样式加载失败，请重新加载。');
    });
  });
  view.webContents.on('render-process-gone', () => {
    view.setVisible(false);
    status('工作台已停止响应，请重新加载。');
  });
  function guardNavigation(event, url) {
    if (allowedNavigation(new URL(url), target.origin, config.authOrigin)) return;
    event.preventDefault();
    void openExternal(url).catch((error) => dialog.showErrorBox('打开链接失败', error.message));
  }
  view.webContents.on('will-navigate', guardNavigation);
  view.webContents.on('will-redirect', guardNavigation);
  view.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url).catch((error) => dialog.showErrorBox('打开链接失败', error.message));
    return { action: 'deny' };
  });
  view.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.on('close', (event) => { if (!quitting) { event.preventDefault(); void layer.request('hide').catch((error) => status(error.message)); } });
  window.on('closed', () => view.webContents.close());

  const controls = {
    bounds: () => desktopBounds,
    setBounds: async (bounds) => {
      if (!bounds || ['x', 'y', 'width', 'height'].some((key) => !Number.isFinite(bounds[key]))) throw new Error('窗口尺寸无效。');
      const area = screen.getPrimaryDisplay().workArea;
      const width = Math.round(Math.max(900, Math.min(area.width, bounds.width)));
      const height = Math.round(Math.max(560, Math.min(area.height, bounds.height)));
      desktopBounds = {
        width, height,
        x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, bounds.x))),
        y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height, bounds.y))),
      };
      await placeWindow();
      fitView();
      return desktopBounds;
    },
    fit: async () => {
      const area = screen.getPrimaryDisplay().workArea;
      desktopBounds = { x: area.x + 16, y: area.y + 16, width: area.width - 32, height: area.height - 32 };
      await placeWindow();
      fitView();
    },
    opacity: async (value) => {
      if (!Number.isFinite(value) || value < 60 || value > 100) throw new Error('背景不透明度须在 60% 到 100% 之间。');
      opacity = value;
      await updateOpacity();
    },
    browser: () => shell.openExternal(target.href),
    login: () => load(loginLink(clipboard.readText(), target.origin, config.authOrigin)),
    retry: () => load(),
    hide: () => layer.request('hide'),
    show: () => layer.request('show'),
    quit: () => app.quit(),
  };
  for (const [name, handler] of Object.entries(controls)) {
    ipcMain.handle(`desktop:${name}`, (event, value) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('不允许此页面控制桌面窗口。');
      return handler(value);
    });
  }

  await window.loadFile(path.join(folder, 'frame.html'));
  const handle = window.getNativeWindowHandle().readBigUInt64LE().toString();
  layer = await connectDesktop(handle, path.join(folder, 'desktop-layer.ps1'));
  window.showInactive();
  console.log('Attached to desktop:', JSON.stringify(await layer.request('attach')));
  tray = new Tray(path.join(folder, 'icon.ico'));
  tray.setToolTip('研究手札桌面工作台');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示工作台', click: showWindow },
    { label: '隐藏工作台', click: () => { void layer.request('hide').catch((error) => status(error.message)); } },
    { label: '在浏览器打开', click: () => { void shell.openExternal(target.href); } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
  tray.on('double-click', showWindow);
  await load();
}

if (process.platform !== 'win32') throw new Error('桌面版当前仅支持 Windows。');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (layer) showWindow(); });
  app.on('before-quit', () => { quitting = true; layer?.close(); });
  Menu.setApplicationMenu(null);
  app.whenReady().then(createWindow).catch((error) => {
    console.error(error);
    dialog.showErrorBox('无法打开桌面工作台', error.message);
    app.quit();
  });
}
