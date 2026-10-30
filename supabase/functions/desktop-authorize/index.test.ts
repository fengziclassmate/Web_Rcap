import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, privateDecrypt } from 'node:crypto';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), generateLink: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ isAuthRetryableFetchError: () => false, createClient: (_url: string, key: string) => key === 'service-secret' ? { auth: { admin: { generateLink: mocks.generateLink } } } : { auth: { getUser: mocks.getUser } } }));
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
let handler: (request: Request) => Promise<Response>;
const owner = { id: 'owner', email: 'owner@example.com', email_confirmed_at: '2026-10-30T00:00:00Z' };
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubGlobal('Deno', { env: { get: (name: string) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service-secret' : name === 'SUPABASE_URL' ? 'https://example.supabase.co' : 'public-key' }, serve: (callback: typeof handler) => { handler = callback; } });
  mocks.getUser.mockResolvedValue({ data: { user: owner }, error: null });
  mocks.generateLink.mockResolvedValue({ data: { user: owner, properties: { hashed_token: 'a'.repeat(64) } }, error: null });
  await import('./index');
});
function request(overrides: HeadersInit = {}) {
  return new Request('https://example.supabase.co/functions/v1/desktop-authorize', { method: 'POST', headers: { origin: 'https://web-rcap.vercel.app', authorization: 'Bearer test-session', ...overrides }, body: JSON.stringify({ publicKey: publicKey.export({ format: 'jwk' }), email: 'untrusted@example.com' }) });
}
describe('authenticated desktop authorization endpoint', () => {
  it('pins authorization to the verified caller and returns only an encrypted credential', async () => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(privateDecrypt({ key: privateKey, oaepHash: 'sha256' }, Buffer.from(body.payload, 'base64url')).toString()).toBe('a'.repeat(64));
    expect(mocks.generateLink).toHaveBeenCalledExactlyOnceWith({ type: 'magiclink', email: owner.email });
    expect(JSON.stringify(body)).not.toContain('service-secret');
    expect(JSON.stringify(body)).not.toContain('a'.repeat(64));
  });
  it('rejects a foreign origin', async () => {
    expect((await handler(request({ origin: 'https://other.example' }))).status).toBe(403);
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it('requires an authenticated session', async () => {
    expect((await handler(request({ authorization: '' }))).status).toBe(401);
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it('requires a verified email', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...owner, email_confirmed_at: null } }, error: null });
    expect((await handler(request())).status).toBe(403);
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });
  it('refuses a credential for a different account', async () => {
    mocks.generateLink.mockResolvedValue({ data: { user: { ...owner, id: 'someone-else' }, properties: { hashed_token: 'secret' } }, error: null });
    expect((await handler(request())).status).toBe(403);
  });
});
