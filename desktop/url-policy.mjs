export function workbenchUrl(configured, override, packaged) {
  const url = new URL(override ?? configured);
  if (override && (packaged || url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname))) {
    throw new Error('开发地址只允许本机 HTTP 服务。');
  }
  if (!override && url.protocol !== 'https:') throw new Error('工作台地址必须使用 HTTPS。');
  return url;
}

export function allowedNavigation(url, appOrigin, authOrigin) {
  return url.origin === appOrigin || (url.origin === authOrigin && url.pathname === '/auth/v1/verify');
}

export function loginLink(text, appOrigin, authOrigin) {
  let url;
  try { url = new URL(text.trim()); }
  catch { throw new Error('请先复制邮箱中的登录链接。'); }
  const redirect = url.searchParams.get('redirect_to');
  if (!allowedNavigation(url, appOrigin, authOrigin) || (redirect && new URL(redirect).origin !== appOrigin)) {
    throw new Error('请复制当前工作台的邮箱登录链接。');
  }
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (!url.searchParams.has('token') && !url.searchParams.has('token_hash') && !url.searchParams.has('code') && !fragment.has('access_token')) {
    throw new Error('链接中没有登录凭据，请复制邮箱中的完整链接。');
  }
  return url.href;
}
