import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

export async function connectDesktop(handle, script) {
  const worker = spawn(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-WindowHandle', handle, '-Action', 'Serve',
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let sequence = 1;
  let errors = '';
  let closing = false;
  let failure = null;
  const ready = new Promise((resolve, reject) => pending.set(0, { resolve, reject }));
  worker.stderr.on('data', (data) => { errors += data; });
  createInterface({ input: worker.stdout }).on('line', (line) => {
    const message = JSON.parse(line);
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.result);
  });
  function fail(error) {
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }
  worker.on('error', fail);
  worker.stdin.on('error', fail);
  worker.on('exit', (code) => { if (!closing) fail(new Error(`桌面控制进程已退出 (${code})。${errors}`)); });
  await ready;
  return {
    request(action, bounds) {
      if (failure) return Promise.reject(failure);
      const id = sequence++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.stdin.write(`${JSON.stringify({ id, action, bounds })}\n`);
      });
    },
    close() { closing = true; worker.stdin.end(); },
  };
}
