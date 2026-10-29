import { cp, mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('请在 Windows 下打包桌面版。');
const folder = path.dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
const output = path.resolve(folder, '..', 'build', 'desktop', `RCAP-Desktop-${version}`);
const appFolder = path.join(output, 'resources', 'app');
await mkdir(output, { recursive: true });
await cp(path.join(folder, 'node_modules', 'electron', 'dist'), output, { recursive: true });
await mkdir(appFolder, { recursive: true });
for (const file of ['package.json', 'main.mjs', 'native-layer.mjs', 'preload.cjs', 'frame.html', 'frame.css', 'frame.js', 'theme.css', 'desktop-layer.ps1', 'url-policy.mjs', 'app-config.json', 'icon.ico']) {
  await cp(path.join(folder, file), path.join(appFolder, file));
}
await rename(path.join(output, 'electron.exe'), path.join(output, 'RCAP-Desktop.exe'));
console.log(`桌面版已生成：${path.join(output, 'RCAP-Desktop.exe')}`);
