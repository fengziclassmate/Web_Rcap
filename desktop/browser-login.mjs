import { generateKeyPairSync, privateDecrypt, randomUUID } from 'node:crypto';

export function createBrowserLogin(origin) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const state = randomUUID();
  const url = new URL('/auth/desktop/authorize', origin);
  url.searchParams.set('state', state);
  url.searchParams.set('key', Buffer.from(JSON.stringify(publicKey.export({ format: 'jwk' }))).toString('base64url'));
  return { url: url.href, state, privateKey, expiresAt: Date.now() + 5 * 60_000 };
}

export function receiveBrowserLogin(pending, link) {
  const url = new URL(link);
  if (url.protocol !== 'rcap-desktop:' || url.hostname !== 'authorize' || url.username || url.password || url.port || !['', '/'].includes(url.pathname)) throw new Error('网页授权链接无效。');
  if (!pending || Date.now() > pending.expiresAt || url.searchParams.get('state') !== pending.state) throw new Error('授权请求已失效，请从软件重新发起网页登录，无需发送邮件。');
  try {
    return privateDecrypt({ key: pending.privateKey, oaepHash: 'sha256' }, Buffer.from(url.searchParams.get('payload') ?? '', 'base64url')).toString('utf8');
  } catch { throw new Error('无法验证网页授权，请从软件重新发起。'); }
}
