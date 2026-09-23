import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import catalog from '../../packages/shared/catalog.json';

export type LiveEnv = { APP_ORIGIN?: string; SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; AUTH_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> } };
type Identity = { id: string; email: string; name: string; role: string; status: string; createdAt: string; lastLogin: string | null };
type AppEnv = { Bindings: LiveEnv; Variables: { db: SupabaseClient; user: Identity; mfaRequired: boolean } };
type Factory = (c: Context<AppEnv>) => SupabaseClient;
const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
const password = z.string().min(12, 'Use at least 12 characters.').max(128);
const email = z.object({ email: z.string().trim().email().max(254) });
export function isConfigured(env: LiveEnv) {
  try { const origin = new URL(env.APP_ORIGIN || ''); const provider = new URL(env.SUPABASE_URL || '');
    return !!env.SUPABASE_ANON_KEY && provider.protocol === 'https:' && origin.origin === env.APP_ORIGIN && (origin.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(origin.hostname));
  } catch { return false; }
}
const factory: Factory = c => createServerClient(c.env.SUPABASE_URL!, c.env.SUPABASE_ANON_KEY!, {
  cookieOptions: { name: 'norvi_auth', path: '/', httpOnly: true, sameSite: 'lax', secure: c.env.APP_ORIGIN!.startsWith('https://') },
  cookies: {
    getAll: () => Object.entries(getCookie(c)).map(([name, value]) => ({ name, value })),
    setAll: cookies => { for (const { name, value, options } of cookies) setCookie(c, name, value, { ...options, httpOnly: true, secure: c.env.APP_ORIGIN!.startsWith('https://'), sameSite: 'Lax', path: '/' }); },
  },
});
// Per-request clients; all database access uses the user's JWT, never a service-role key.
export function createLiveApp(makeClient: Factory = factory, options: { upstreamRateLimit?: 'netlify' } = {}) {
  const app = new Hono<AppEnv>();
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff'); c.header('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD'].includes(c.req.method) && c.req.header('origin') !== c.env.APP_ORIGIN) return c.json({ error: 'Request origin is not allowed.' }, 403);
    await next();
  });
  app.use('/api/*', bodyLimit({ maxSize: 16384, onError: c => c.json({ error: 'Request is too large.' }, 413) }));
  app.onError((e, c) => c.json({ error: e instanceof z.ZodError ? e.errors.map(x => x.message).join(' ') : 'The account service could not complete this request.' }, e instanceof z.ZodError ? 400 : 500));
  app.get('/api/health', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', livePayments: false }));
  app.get('/api/auth/config', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', preview: false, registration: isConfigured(c.env) }));
  app.get('/api/catalog', c => c.json({ ...catalog, preview: false }));
  app.all('/api/preview/*', c => c.json({ error: 'Preview actions are disabled in account mode.' }, 404));
  app.use('/api/*', async (c, next) => {
    if (!isConfigured(c.env)) return c.json({ error: 'Supabase account services need to be configured.' }, 503);
    c.set('db', makeClient(c)); await next();
  });
  app.use('/api/auth/*', async (c, next) => {
    // Only the Netlify entry point opts in: its exported config protects every API path.
    // This is a deployment contract, never a client header or environment toggle.
    if (c.req.method !== 'GET' && c.env.APP_ORIGIN!.startsWith('https://') && options.upstreamRateLimit !== 'netlify') {
      if (!c.env.AUTH_RATE_LIMITER) return c.json({ error: 'Authentication protection is not configured.' }, 503);
      if (!(await c.env.AUTH_RATE_LIMITER.limit({ key: c.req.header('CF-Connecting-IP') || 'unknown' })).success) return c.json({ error: 'Too many attempts. Please try again shortly.' }, 429);
    }
    await next();
  });
  app.post('/api/auth/register', async c => {
    const input = credentials.extend({ password, name: z.string().trim().min(2).max(80) }).parse(await c.req.json());
    const { data, error } = await c.get('db').auth.signUp({ email: input.email, password: input.password, options: { data: { name: input.name } } });
    if (error) return c.json({ error: 'Registration could not be completed. Check your details or try again later.' }, 400);
    if (data.session) { await c.get('db').auth.signOut(); return c.json({ error: 'Email confirmation must be enabled before registration is available.' }, 503); }
    return c.json({ message: 'If this address can be registered, check your email for a confirmation link.' });
  });
  app.post('/api/auth/login', async c => {
    const input = credentials.parse(await c.req.json());
    const { data, error } = await c.get('db').auth.signInWithPassword(input);
    if (error || !data.user?.email_confirmed_at) { if (data.session) await c.get('db').auth.signOut(); return c.json({ error: 'Sign-in failed. Check your details and verify your email.' }, 401); }
    return c.json({ ok: true });
  });
  app.post('/api/auth/reset', async c => {
    const input = email.parse(await c.req.json()); await c.get('db').auth.resetPasswordForEmail(input.email);
    return c.json({ message: 'If this account exists, a password reset email will arrive shortly.' });
  });
  app.post('/api/auth/resend', async c => {
    const input = email.parse(await c.req.json()); await c.get('db').auth.resend({ type: 'signup', email: input.email });
    return c.json({ message: 'If verification is needed, check your inbox for a new link.' });
  });
  // A confirmation button prevents email scanners from consuming tokens through GET requests.
  app.post('/api/auth/confirm', async c => {
    const input = z.object({ token_hash: z.string().min(10).max(256), type: z.literal('email') }).parse(await c.req.json());
    const { error } = await c.get('db').auth.verifyOtp(input);
    return error ? c.json({ error: 'This confirmation link is invalid or expired.' }, 400) : c.json({ ok: true });
  });
  app.post('/api/auth/recover', async c => {
    const input = z.object({ token_hash: z.string().min(10).max(256), password }).parse(await c.req.json()); const db = c.get('db');
    const { error } = await db.auth.verifyOtp({ token_hash: input.token_hash, type: 'recovery' });
    if (error) return c.json({ error: 'This recovery link is invalid or expired. Request another reset email.' }, 400);
    const result = await db.auth.updateUser({ password: input.password }); await db.auth.signOut({ scope: 'global' });
    return result.error ? c.json({ error: 'Password could not be changed. Request a new reset link or contact support if MFA recovery is required.' }, 400) : c.json({ ok: true });
  });
  app.post('/api/auth/logout', async c => {
    const { error } = await c.get('db').auth.signOut({ scope: 'local' });
    return error ? c.json({ error: 'Sign-out could not be completed. Please retry.' }, 503) : c.json({ ok: true });
  });
  app.use('/api/*', async (c, next) => {
    const db = c.get('db'); const { data, error } = await db.auth.getUser();
    if (error || !data.user?.email_confirmed_at) return c.json({ error: 'Sign in with a verified account to continue.' }, 401);
    const [profile, membership, assurance] = await Promise.all([
      db.from('profiles').select('id,display_name,suspended,created_at').eq('id', data.user.id).single(),
      db.from('staff_memberships').select('role,active').eq('user_id', data.user.id).maybeSingle(), db.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (profile.error || membership.error || assurance.error) return c.json({ error: 'Account setup is incomplete or unavailable. Contact the owner.' }, 503);
    if (profile.data.suspended || (membership.data && !membership.data.active)) return c.json({ error: 'Account access is suspended.' }, 403);
    const role = membership.data?.role || 'customer';
    c.set('user', { id: data.user.id, email: data.user.email || '', name: profile.data.display_name, role, status: 'active', createdAt: profile.data.created_at, lastLogin: data.user.last_sign_in_at || null });
    c.set('mfaRequired', (role !== 'customer' || assurance.data.nextLevel === 'aal2') && assurance.data.currentLevel !== 'aal2'); await next();
  });
  app.get('/api/me', c => c.json({ user: c.get('user'), preview: false, mfaRequired: c.get('mfaRequired') }));
  app.get('/api/auth/mfa', async c => {
    const { data, error } = await c.get('db').auth.mfa.listFactors();
    return error ? c.json({ error: 'Could not load authentication factors.' }, 503) : c.json({ factors: data.totp.map(x => ({ id: x.id, name: x.friendly_name, status: x.status })), required: c.get('mfaRequired') });
  });
  app.post('/api/auth/mfa/enroll', async c => {
    const db = c.get('db'); const factors = await db.auth.mfa.listFactors();
    if (factors.error) return c.json({ error: 'Could not load factors.' }, 503);
    if (factors.data.totp.some(f => f.status === 'verified')) return c.json({ error: 'An authenticator is already enrolled. Verify it below.' }, 409);
    for (const factor of factors.data.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) {
      if ((await db.auth.mfa.unenroll({ factorId: factor.id })).error) return c.json({ error: 'Could not restart authenticator setup.' }, 503);
    }
    const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', issuer: 'NORVI', friendlyName: 'NORVI authenticator' });
    return error ? c.json({ error: 'Authenticator setup failed.' }, 400) : c.json({ id: data.id, secret: data.totp.secret });
  });
  app.post('/api/auth/mfa/verify', async c => {
    const input = z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).parse(await c.req.json());
    const { error } = await c.get('db').auth.mfa.challengeAndVerify(input);
    return error ? c.json({ error: 'The verification code is invalid or expired.' }, 400) : c.json({ ok: true });
  });
  app.use('/api/*', async (c, next) => {
    if (c.get('mfaRequired')) return c.json({ error: 'Complete authenticator verification in Account security.', code: 'MFA_REQUIRED' }, 403);
    await next();
  });
  app.patch('/api/me', async c => {
    const input = z.object({ name: z.string().trim().min(2).max(80) }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('update_my_profile', { new_name: input.name });
    return error ? c.json({ error: 'Profile could not be saved.' }, 400) : c.json({ ok: true });
  });
  app.get('/api/account', async c => {
    const db = c.get('db'), uid = c.get('user').id;
    const results = await Promise.all([
      db.from('licenses').select('id,product_id,status,key_suffix,created_at,expires_at').eq('user_id', uid),
      db.from('orders').select('id,product_id,status,amount_minor,currency,created_at').eq('user_id', uid),
      db.from('support_requests').select('id,subject,message,status,created_at').eq('user_id', uid),
    ]);
    if (results.some(r => r.error)) return c.json({ error: 'Account records could not be loaded.' }, 503);
    return c.json({ user: c.get('user'), licenses: results[0].data!.map(l => ({ ...l, productId: l.product_id, suffix: l.key_suffix, createdAt: l.created_at, expiresAt: l.expires_at })), orders: results[1].data!.map(o => ({ ...o, productId: o.product_id, createdAt: o.created_at, amount: `${o.currency} ${(o.amount_minor / 100).toFixed(2)}` })), tickets: results[2].data!.map(t => ({ ...t, createdAt: t.created_at })), emails: [], preview: false });
  });
  app.post('/api/support', async c => {
    const input = z.object({ subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(3000) }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('create_support_request', { request_subject: input.subject, request_message: input.message });
    return error ? c.json({ error: 'Support request could not be saved.' }, 400) : c.json({ ok: true });
  });
  app.get('/api/admin/customers', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Your role cannot access customers.' }, 403);
    const page = z.coerce.number().int().min(0).max(100000).parse(c.req.query('page') || 0);
    const { data, error } = await c.get('db').rpc('list_customers', { page_number: page });
    return error ? c.json({ error: 'Customers could not be loaded.' }, 503) : c.json({ items: data, page, pageSize: 50 });
  });
  app.all('/api/*', c => c.json({ error: 'This operation belongs to a later integration phase. Real purchases, activation, and commerce administration are not enabled.' }, 503));
  return app;
}
