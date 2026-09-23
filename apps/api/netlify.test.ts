import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { config } from '../../netlify/functions/api';

const origin = 'https://norvi-agency.netlify.app';
const request = (path: string, body?: object, source = origin) => new Request(origin + '/api' + path, {
  method: body ? 'POST' : 'GET',
  headers: { origin: source, 'content-type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', origin);
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'test-only');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Netlify production entry point', () => {
  it('routes the original API path and uses real mode even if local preview is requested', async () => {
    vi.stubEnv('NORVI_MODE', 'preview');
    expect(await (await handler(request('/health'))).json()).toEqual({ mode: 'supabase', livePayments: false });
    expect(await (await handler(request('/auth/config'))).json()).toEqual({ mode: 'supabase', preview: false, registration: true });
    expect((await handler(request('/preview/session', { role: 'owner' }))).status).toBe(404);
    expect(config.path).toBe('/api/*');
    expect(config.rateLimit).toEqual({ windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] });
  });
  it('fails closed for missing configuration and cross-origin writes', async () => {
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await handler(request('/auth/login', {}, 'https://evil.invalid'))).status).toBe(403);
    vi.stubEnv('SUPABASE_ANON_KEY', '');
    expect((await handler(request('/auth/login', {}))).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
  it('preserves secure chunked session cookies through the Fetch adapter', async () => {
    const user = { id: '10000000-0000-4000-8000-000000000001', aud: 'authenticated', email: 'test@example.invalid', email_confirmed_at: '2026-09-23T00:00:00Z', app_metadata: {}, user_metadata: { padding: 'x'.repeat(4500) }, created_at: '2026-09-23T00:00:00Z' };
    const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aal: 'aal1' })).toString('base64url'), 'test-signature'].join('.');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user }), { headers: { 'content-type': 'application/json' } })));
    const response = await handler(request('/auth/login', { email: user.email, password: 'test-password-only' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(1);
    for (const cookie of cookies) {
      expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toContain('SameSite=Lax');
    }
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
