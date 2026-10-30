import { app, BrowserWindow, WebContentsView, Menu, Tray, clipboard, dialog, ipcMain, screen, shell } from 'electron';
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedNavigation, desktopLoginCallback, loginLink, workbenchUrl } from './url-policy.mjs';
import { connectDesktop } from './native-layer.mjs';
import { clampWindowBounds } from './window-geometry.mjs';
import { createBrowserLogin, receiveBrowserLogin } from './browser-login.mjs';

const folder = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(folder, 'app-config.json'), 'utf8'));
const argument = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const target = workbenchUrl(config.url, argument('url'), app.isPackaged);
app.setName('RCAP Desktop');
const dataDir = path.resolve(argument('data-dir') ?? path.join(app.getPath('appData'), 'RCAP Desktop'));
mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);

let window;
let view;
let tray;
let quitting = false;
let opacity = 85;
let themeReady = false;
let desktopBounds;
let layer;
let saveBoundsTimer;
let completingLogin = false;
let authFeedbackKind = 'idle';
let browserLogin;
let pendingAuthorization;
let authPageReady = false;
const boundsFile = path.join(app.getPath('userData'), 'window-bounds.json');
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

function saveBounds() {
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = undefined;
  try {
    writeFileSync(`${boundsFile}.tmp`, JSON.stringify(desktopBounds));
    renameSync(`${boundsFile}.tmp`, boundsFile);
  } catch (error) {
    console.error('Window settings write failed:', error.code);
    status('无法保存窗口位置和大小，请检查磁盘空间或文件权限。');
  }
}

function authStatus(kind, message) {
  authFeedbackKind = kind;
  window.webContents.send('desktop:auth-status', { kind, message });
}

async function completeDesktopLogin(link) {
  if (new URL(link).hostname === 'authorize') {
    pendingAuthorization = receiveBrowserLogin(browserLogin, link);
    browserLogin = null;
    completingLogin = true;
    showWindow();
    if (authPageReady) {
      authStatus('pending', '正在恢复桌面登录…');
      view.webContents.send('desktop:authorize-token', pendingAuthorization);
      pendingAuthorization = null;
    } else {
      const loading = load();
      authStatus('pending', '正在恢复桌面登录…');
      await loading;
    }
    return;
  }
  const { code, state } = desktopLoginCallback(link, target.origin);
  if (new URL(view.webContents.getURL()).origin !== target.origin) await load();
  const pending = await view.webContents.executeJavaScriptInIsolatedWorld(1, [{ code: "localStorage.getItem('rcap-desktop-login-state')" }]);
  if (pending !== state) throw new Error('此链接不是当前桌面版发起的登录，请重新发送并打开最新邮件。');
  completingLogin = true;
  showWindow();
  const destination = new URL(target);
  destination.searchParams.set('code', code);
  const loading = load(destination.href);
  authStatus('pending', '正在完成桌面登录…');
  await loading;
}

async function startBrowserLogin() {
  browserLogin = createBrowserLogin(target.origin);
  await shell.openExternal(browserLogin.url);
  authStatus('pending', '请在已登录的网页中确认授权，无需发送邮件。');
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
  try { desktopBounds = clampWindowBounds(JSON.parse(readFileSync(boundsFile, 'utf8')), area); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  window = new BrowserWindow({
    title: '研究手札桌面工作台',
    ...desktopBounds,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, minimizable: false, minWidth: 900, minHeight: 560,
    show: false, skipTaskbar: true, alwaysOnTop: false, hasShadow: false,
    icon: path.join(folder, 'icon.ico'),
    webPreferences: { preload: path.join(folder, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  view = new WebContentsView({ webPreferences: { preload: path.join(folder, 'auth-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  view.setBackgroundColor('#00000000');
  window.contentView.addChildView(view);
  function fitView() {
    const [width, height] = window.getContentSize();
    view.setBounds({ x: 6, y: 42, width: width - 12, height: height - 48 });
  }
  fitView();
  window.on('resize', fitView);

  view.webContents.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) { themeReady = false; authPageReady = false; } });
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
    const destination = new URL(url);
    if (destination.origin === target.origin && destination.pathname === '/auth/desktop' && destination.searchParams.has('code')) {
      event.preventDefault();
      void completeDesktopLogin(url).catch((error) => authStatus('error', error.message));
      return;
    }
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

  ipcMain.on('desktop:auth-state', (event, state) => {
    if (event.sender !== view.webContents || event.senderFrame !== view.webContents.mainFrame || new URL(view.webContents.getURL()).origin !== target.origin) return;
    if (!state || typeof state.signedIn !== 'boolean' || (state.error !== null && typeof state.error !== 'string')) return;
    authPageReady = true;
    if (pendingAuthorization) {
      view.webContents.send('desktop:authorize-token', pendingAuthorization);
      pendingAuthorization = null;
      return;
    }
    if (state.error) authStatus('error', state.error);
    else if (state.signedIn) {
      authStatus('success', '已登录');
      if (completingLogin) void view.webContents.executeJavaScriptInIsolatedWorld(1, [{ code: "localStorage.removeItem('rcap-desktop-login-state')" }]);
    } else if (!completingLogin && authFeedbackKind !== 'error') authStatus('idle', '未登录');
    if (state.error || state.signedIn) completingLogin = false;
  });
  ipcMain.handle('desktop:browser-login', (event) => {
    if (event.sender !== view.webContents || event.senderFrame !== view.webContents.mainFrame || new URL(view.webContents.getURL()).origin !== target.origin) throw new Error('不允许此页面发起授权。');
    return startBrowserLogin();
  });

  const controls = {
    bounds: () => ({ ...desktopBounds, workArea: screen.getPrimaryDisplay().workArea }),
    setBounds: async (bounds) => {
      const area = screen.getPrimaryDisplay().workArea;
      desktopBounds = clampWindowBounds(bounds, area);
      await placeWindow();
      fitView();
      clearTimeout(saveBoundsTimer);
      saveBoundsTimer = setTimeout(saveBounds, 250);
      return desktopBounds;
    },
    fit: async () => {
      const area = screen.getPrimaryDisplay().workArea;
      desktopBounds = { x: area.x + 16, y: area.y + 16, width: area.width - 32, height: area.height - 32 };
      await placeWindow();
      fitView();
      saveBounds();
    },
    opacity: async (value) => {
      if (!Number.isFinite(value) || value < 60 || value > 100) throw new Error('背景不透明度须在 60% 到 100% 之间。');
      opacity = value;
      await updateOpacity();
    },
    browser: startBrowserLogin,
    login: () => {
      const text = loginLink(clipboard.readText(), target.origin, config.authOrigin);
      const url = new URL(text);
      return url.protocol === 'rcap-desktop:' || url.pathname === '/auth/desktop' ? completeDesktopLogin(text) : load(text);
    },
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
  if (app.isPackaged && !argument('data-dir') && !app.setAsDefaultProtocolClient('rcap-desktop')) {
    authStatus('error', '无法设置桌面登录入口，请使用“粘贴登录链接”。');
  }
}

if (process.platform !== 'win32') throw new Error('桌面版当前仅支持 Windows。');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    const link = argv.find((value) => value.startsWith('rcap-desktop://'));
    void ready.then(() => link ? completeDesktopLogin(link) : showWindow()).catch((error) => authStatus('error', error.message));
  });
  app.on('before-quit', () => { quitting = true; view?.webContents.session.flushStorageData(); if (saveBoundsTimer) saveBounds(); layer?.close(); });
  Menu.setApplicationMenu(null);
  const ready = app.whenReady().then(async () => {
    await createWindow();
    const link = process.argv.find((value) => value.startsWith('rcap-desktop://'));
    if (link) await completeDesktopLogin(link).catch((error) => authStatus('error', error.message));
  });
  ready.catch((error) => {
    console.error(error);
    dialog.showErrorBox('无法打开桌面工作台', error.message);
    app.quit();
  });
}
