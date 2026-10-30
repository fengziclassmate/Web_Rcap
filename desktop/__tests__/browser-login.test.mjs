import { describe, expect, it } from 'vitest';
import { createPublicKey, publicEncrypt } from 'node:crypto';
import { createBrowserLogin, receiveBrowserLogin } from '../browser-login.mjs';

describe('browser desktop authorization', () => {
  it('delivers only encrypted one-time credentials bound to the current desktop request', () => {
    const pending = createBrowserLogin('https://web-rcap.vercel.app');
    const payload = publicEncrypt({ key: createPublicKey(pending.privateKey), oaepHash: 'sha256' }, Buffer.from('one-time-hash')).toString('base64url');
    const link = `rcap-desktop://authorize?state=${pending.state}&payload=${payload}`;
    expect(receiveBrowserLogin(pending, link)).toBe('one-time-hash');
    expect(link).not.toContain('one-time-hash');
    expect(() => receiveBrowserLogin(pending, link.replace(pending.state, 'wrong'))).toThrow('授权请求已失效');
    expect(() => receiveBrowserLogin({ ...pending, expiresAt: 0 }, link)).toThrow('授权请求已失效');
    expect(() => receiveBrowserLogin(null, link)).toThrow('授权请求已失效');
  });
});
