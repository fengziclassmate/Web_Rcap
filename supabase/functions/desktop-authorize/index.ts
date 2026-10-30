import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'https://web-rcap.vercel.app', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  const reply = (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers });
  if (origin !== 'https://web-rcap.vercel.app') return reply('不允许的授权来源。', 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply('请使用 POST 请求。', 405);
  const bearer = request.headers.get('authorization');
  if (!bearer?.match(/^Bearer\s+\S+$/i)) return reply('请先登录网页。', 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: bearer } } });
  const { data: { user }, error } = await caller.auth.getUser(bearer.replace(/^Bearer\s+/i, ''));
  if (error && (isAuthRetryableFetchError(error) || error.status === 429 || (error.status ?? 0) >= 500)) return reply('登录服务暂时不可用，请稍后重试。', 503);
  if (error || !user) return reply('网页登录已失效，请先重新登录网页。', 401);
  if (!user.email || !user.email_confirmed_at) return reply('请先完成邮箱验证。', 403);
  let key: CryptoKey;
  try {
    const text = await request.text();
    if (text.length > 4096) return reply('授权请求过长。', 400);
    const { publicKey } = JSON.parse(text);
    if (publicKey.kty !== 'RSA' || publicKey.d || publicKey.e !== 'AQAB' || typeof publicKey.n !== 'string' || publicKey.n.length < 342 || publicKey.n.length > 1024) return reply('授权公钥无效。', 400);
    key = await crypto.subtle.importKey('jwk', publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  } catch { return reply('授权请求无效，请从软件重新发起。', 400); }
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const generated = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email });
  if (generated.error) return reply('无法生成桌面授权，请稍后重试。', 503);
  if (generated.data.user.id !== user.id) return reply('授权账号不匹配。', 403);
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(generated.data.properties.hashed_token));
  const payload = btoa(String.fromCharCode(...new Uint8Array(encrypted))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return new Response(JSON.stringify({ payload }), { status: 200, headers });
});
