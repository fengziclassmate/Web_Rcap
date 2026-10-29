import { describe, expect, it } from 'vitest';
import { allowedNavigation, desktopLoginCallback, loginLink, workbenchUrl } from '../url-policy.mjs';

const app = 'https://web-rcap.vercel.app';
const auth = 'https://eihdfjdqywmfnmhqojut.supabase.co';

describe('desktop URL boundary', () => {
  it('accepts only desktop authorization code callbacks, without session tokens', () => {
    expect(desktopLoginCallback('rcap-desktop://auth?code=test-code&state=test-state', app)).toEqual({ code: 'test-code', state: 'test-state' });
    expect(desktopLoginCallback(`${app}/auth/desktop?code=test-code&state=test-state`, app)).toEqual({ code: 'test-code', state: 'test-state' });
    expect(() => desktopLoginCallback('rcap-desktop://other?code=test&state=test', app)).toThrow();
    expect(() => desktopLoginCallback('rcap-desktop://auth#access_token=test', app)).toThrow();
    expect(() => desktopLoginCallback('https://other.example/auth/desktop?code=test&state=test', app)).toThrow();
  });
  it('accepts the configured HTTPS app and a local development server', () => {
    expect(workbenchUrl(app, undefined, true).origin).toBe(app);
    expect(workbenchUrl(app, 'http://127.0.0.1:3116', false).origin).toBe('http://127.0.0.1:3116');
    expect(() => workbenchUrl(app, 'http://127.0.0.1:3116', true)).toThrow();
    expect(() => workbenchUrl(app, 'https://unrelated.example', false)).toThrow();
    expect(() => workbenchUrl('http://unrelated.example', undefined, true)).toThrow();
  });

  it('keeps navigation in the app or the configured email verification endpoint', () => {
    expect(allowedNavigation(new URL(`${app}/workbench`), app, auth)).toBe(true);
    expect(allowedNavigation(new URL(`${auth}/auth/v1/verify`), app, auth)).toBe(true);
    expect(allowedNavigation(new URL(`${auth}/storage/v1/object/public/other/page.html`), app, auth)).toBe(false);
    expect(allowedNavigation(new URL('javascript:alert(1)'), app, auth)).toBe(false);
  });

  it('accepts the original email link and app callbacks without logging their credentials', () => {
    const email = `${auth}/auth/v1/verify?token=local-test-token&type=magiclink&redirect_to=${encodeURIComponent(app)}`;
    expect(loginLink(email, app, auth)).toBe(email);
    expect(loginLink(`${app}/#access_token=local-test&refresh_token=local-test-refresh`, app, auth)).toContain('#access_token=');
    expect(loginLink(`${app}/?code=local-test-code`, app, auth)).toContain('?code=');
  });

  it('rejects unrelated or credential-free clipboard content', () => {
    expect(() => loginLink('普通文本', app, auth)).toThrow('请先复制邮箱中的登录链接');
    expect(() => loginLink(`${app}/`, app, auth)).toThrow('没有登录凭据');
    expect(() => loginLink('https://other.example/#access_token=local-test', app, auth)).toThrow('当前工作台');
    expect(() => loginLink(`${auth}/auth/v1/verify?token=local-test&redirect_to=https://other.example`, app, auth)).toThrow('当前工作台');
  });
});
