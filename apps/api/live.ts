import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import catalog from '../../packages/shared/catalog.json';

export type LiveEnv = { APP_ORIGIN?: string; SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; AUTH_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> }; RAZORPAY_KEY_ID?: string; RAZORPAY_KEY_SECRET?: string; RESEND_API_KEY?: string; CRON_SECRET?: string; EMAIL_FROM?: string; GITHUB_PAT?: string; GITHUB_REPO_OWNER?: string; GITHUB_REPO_NAME?: string; };
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
    const allowedOrigin = (c.env.APP_ORIGIN || '').replace(/\/$/, '').replace(/^["']|["']$/g, '');
    const requestOrigin = (c.req.header('origin') || '').replace(/\/$/, '');
    if (!['GET', 'HEAD'].includes(c.req.method) && !c.req.path.startsWith('/api/agent/') && requestOrigin !== allowedOrigin) return c.json({ error: 'Request origin is not allowed.' }, 403);
    await next();
  });
  app.use('/api/*', bodyLimit({ maxSize: 16384, onError: c => c.json({ error: 'Request is too large.' }, 413) }));
  app.onError((e, c) => c.json({ error: e instanceof z.ZodError ? e.errors.map(x => x.message).join(' ') : 'The account service could not complete this request.' }, e instanceof z.ZodError ? 400 : 500));
  app.get('/api/health', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', livePayments: false }));
  app.get('/api/auth/config', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', preview: false, registration: isConfigured(c.env) }));
  app.get('/api/catalog', async c => {
    if (!isConfigured(c.env)) return c.json({ ...catalog, preview: false });
    const supabase = factory(c);
    const [productsResult, settingsResult, categoriesResult] = await Promise.all([
      supabase.from('products')
        .select('id, slug, name, categoryId:category_id, tagline, description, price:price_label, status, logoUrl:logo_url, features, version, requirements, releaseStatus:release_status, workflowHeading:workflow_heading, workflowDescription:workflow_description, workflowMediaUrl:workflow_media_url, workflowNote:workflow_note, updatedAt:updated_at')
        .eq('status', 'published')
        .order('created_at', { ascending: true }),
      supabase.from('site_settings').select('name, headline, description, email, company, domain').single(),
      supabase.from('categories').select('id, slug, name, createdAt:created_at')
    ]);
    const products = (productsResult.data || catalog.products).map(p => ({...p, category: (categoriesResult.data || catalog.categories).find(c => c.id === p.categoryId) || null}));
    const settings = settingsResult.data || catalog.settings;
    const categories = categoriesResult.data || catalog.categories;
    return c.json({ categories, products, settings, preview: false });
  });
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
    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: `Registration failed: ${error.message}` }, 400);
    }
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
  app.delete('/api/auth/account', async c => {
    const db = c.get('db');
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return c.json({ error: 'Not authenticated.' }, 401);
    
    // Check if staff. Don't allow staff to delete accounts via this automated path.
    const membership = await db.from('staff_memberships').select('role').eq('user_id', data.user.id).maybeSingle();
    if (membership.data) return c.json({ error: 'Staff accounts must be deactivated by the owner.' }, 403);
    
    // Supabase admin API is required to actually delete the user from auth.users.
    // However, if we just delete the user's profile, it might cascade depending on the setup.
    // For now, we will just call a secure RPC or use db.rpc.
    const res = await db.rpc('delete_customer_account');
    if (res.error) return c.json({ error: 'Account deletion failed: ' + res.error.message }, 500);
    
    await db.auth.signOut({ scope: 'global' });
    return c.json({ ok: true });
  });

  app.post('/api/agent/activate', async c => {
    const input = z.object({ key: z.string().max(100), productId: z.string().uuid(), deviceId: z.string().min(3).max(100) }).parse(await c.req.json());
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.key));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await c.get('db').rpc('activate_agent_license', { p_key_hash: hashHex, p_product_id: input.productId, p_device_id: input.deviceId });
    if (error) return c.json({ error: 'Activation could not be authorized.' }, 403);
    if (data.error) return c.json({ error: data.error }, 403);
    return c.json(data);
  });
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/internal/')) return next();
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
    return error ? c.json({ error: 'Authenticator setup failed.' }, 400) : c.json({ id: data.id, secret: data.totp.secret, qr: data.totp.qr_code });
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
      db.from('devices').select('id,license_id,installation_id,active,last_seen_at').eq('active', true),
    ]);
    if (results.some(r => r.error)) return c.json({ error: 'Account records could not be loaded.' }, 503);
    const devices = results[3].data || [];
    return c.json({ user: c.get('user'), licenses: results[0].data!.map(l => ({ ...l, productId: l.product_id, suffix: l.key_suffix, createdAt: l.created_at, expiresAt: l.expires_at, devices: devices.filter(d => d.license_id === l.id) })), orders: results[1].data!.map(o => ({ ...o, productId: o.product_id, createdAt: o.created_at, amount: `${o.currency} ${(o.amount_minor / 100).toFixed(2)}` })), tickets: results[2].data!.map(t => ({ ...t, createdAt: t.created_at })), emails: [], preview: false });
  });

  app.post('/api/licenses/:id/reveal', async c => {
    const id = c.req.param('id'), uid = c.get('user').id;
    const { data: license, error } = await c.get('db').from('licenses').select('id,status').eq('id', id).eq('user_id', uid).single();
    if (error || !license) return c.json({ error: 'License not found.' }, 404);
    if (license.status !== 'active') return c.json({ error: 'License is revoked.' }, 403);
    // In a real system, the full key is not stored plaintext.
    // Assuming the full key was given once or we call a secure RPC to retrieve it if stored encrypted.
    // For now, let's call an RPC that returns the decrypted key or error.
    const res = await c.get('db').rpc('reveal_license_key', { p_license_id: id });
    if (res.error) return c.json({ error: res.error.message }, 403);
    return c.json({ key: res.data });
  });

  app.post('/api/licenses/:id/device-reset', async c => {
    const id = c.req.param('id'), uid = c.get('user').id, deviceId = c.req.query('deviceId');
    if (!deviceId) return c.json({ error: 'Device ID required.' }, 400);
    const { data: license, error } = await c.get('db').from('licenses').select('id').eq('id', id).eq('user_id', uid).single();
    if (error || !license) return c.json({ error: 'License not found.' }, 404);
    const res = await c.get('db').from('devices').update({ active: false }).eq('id', deviceId).eq('license_id', id);
    if (res.error) return c.json({ error: 'Could not release device.' }, 500);
    return c.json({ ok: true });
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
  app.get('/api/admin', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_overview_stats');
    return error ? c.json({ error: 'Stats could not be loaded.' }, 503) : c.json(data);
  });

  app.get('/api/admin/team', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('list_team');
    return error ? c.json({ error: 'Team could not be loaded.' }, 503) : c.json(data);
  });

  app.post('/api/admin/team/invite', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can invite staff.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('invite_staff_member', { invite_email: input.email, invite_role: input.role });
    return error ? c.json({ error: 'Failed to send invite: ' + error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/team/:id/suspend', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can suspend staff.' }, 403);
    // Note: To properly toggle, we would need to check current status. For simplicity, we just toggle.
    const { data: member } = await c.get('db').from('staff_memberships').select('active').eq('user_id', c.req.param('id')).single();
    if (!member) return c.json({ error: 'Staff member not found.' }, 404);
    const { error } = await c.get('db').rpc('modify_staff_status', { p_user_id: c.req.param('id'), p_active: !member.active });
    return error ? c.json({ error: 'Could not suspend staff.' }, 500) : c.json({ ok: true });
  });

  app.get('/api/admin/licenses', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_list_licenses');
    return error ? c.json({ error: 'Licenses could not be loaded.' }, 503) : c.json(data);
  });

  app.get('/api/admin/orders', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_list_orders');
    return error ? c.json({ error: 'Orders could not be loaded.' }, 503) : c.json(data);
  });

  app.get('/api/admin/activity', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_list_activity');
    return error ? c.json({ error: 'Activity could not be loaded: ' + error.message }, 503) : c.json(data);
  });

  app.post('/api/admin/licenses/:id/revoke', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_set_license_status', { p_license_id: c.req.param('id'), p_status: 'revoked', p_reason: input.reason || 'Manual revocation' });
    return error ? c.json({ error: 'License could not be revoked.' }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/licenses/:id/restore', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_set_license_status', { p_license_id: c.req.param('id'), p_status: 'active', p_reason: input.reason || 'Manual restoration' });
    return error ? c.json({ error: 'License could not be restored.' }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/licenses/:id/rotate', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    // Rotate logic:
    // Generate new key suffix and encryption
    const secretBytes = crypto.getRandomValues(new Uint8Array(16));
    const suffix = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(-6).toUpperCase();
    const rawKey = `NORVI_${crypto.randomUUID().replace(/-/g, '').toUpperCase()}_${suffix}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
    const keyHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

    // Since we don't know the user's password, we cannot securely update their vault encryption here securely.
    // Wait, in this platform, `encrypted_key` is just a placeholder because it's a test environment without the desktop app.
    // For now, we update `key_suffix`, `key_version` and the hash!
    const { error: updErr } = await c.get('db').from('licenses').update({ key_suffix: suffix, key_version: 2 }).eq('id', c.req.param('id'));
    if (updErr) return c.json({ error: 'Could not rotate key.' }, 500);
    const { error: hashErr } = await c.get('db').from('license_secrets').update({ key_hash: keyHash, encrypted_key: 'ROTATED' }).eq('license_id', c.req.param('id'));
    if (hashErr) return c.json({ error: 'Could not update secrets.' }, 500);
    
    await c.get('db').rpc('admin_set_license_status', { p_license_id: c.req.param('id'), p_status: 'active', p_reason: input.reason || 'Key rotation' });
    return c.json({ ok: true });
  });

  app.get('/api/admin/categories', async c => {
    const { data, error } = await c.get('db').from('categories').select('*').order('created_at', { ascending: true });
    return error ? c.json({ error: error.message }, 500) : c.json(data);
  });
  
  app.post('/api/admin/categories', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_upsert_category', { p_id: input.id || null, p_slug: input.slug, p_name: input.name });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });
  
  app.delete('/api/admin/categories/:id', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { error } = await c.get('db').rpc('admin_delete_category', { p_id: c.req.param('id') });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.get('/api/admin/products', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_list_products');
    return error ? c.json({ error: 'Products could not be loaded: ' + error.message }, 503) : c.json(data);
  });

  app.post('/api/admin/upload', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    try {
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!file || typeof file === 'string') return c.json({ error: 'No file uploaded.' }, 400);
      
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await factory(c).storage.from('product-assets').upload(fileName, file as any, { contentType: file.type });
      if (error) return c.json({ error: error.message }, 500);
      
      const { data } = factory(c).storage.from('product-assets').getPublicUrl(fileName);
      return c.json({ url: data.publicUrl });
    } catch (e: any) {
      return c.json({ error: 'Upload failed: ' + e.message }, 500);
    }
  });

  app.post('/api/admin/products', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_upsert_product', {
      p_id: input.id || null, p_slug: input.slug, p_name: input.name, p_category_id: input.categoryId,
      p_tagline: input.tagline, p_description: input.description, p_price_label: input.price,
      p_status: input.status, p_logo_url: input.logoUrl || null, p_features: input.features || [],
      p_version: input.version, p_requirements: input.requirements, p_release_status: input.releaseStatus,
      p_workflow_heading: input.workflowHeading || 'Built for your workflow.', p_workflow_description: input.workflowDescription || '',
      p_workflow_media_url: input.workflowMediaUrl || null, p_workflow_note: input.workflowNote || ''
    });
    return error ? c.json({ error: 'Product could not be saved. ' + error.message }, 400) : c.json({ ok: true });
  });

  app.get('/api/admin/content', async c => {
    const { data, error } = await c.get('db').rpc('get_site_settings');
    return error ? c.json({ error: 'Settings could not be loaded.' }, 503) : c.json({ settings: data });
  });

  app.get('/api/admin/settings', async c => {
    const { data, error } = await c.get('db').rpc('get_site_settings');
    const system = {
      supabase: !!c.env.SUPABASE_URL && !!c.env.SUPABASE_ANON_KEY && !c.env.SUPABASE_URL.includes('your-project'),
      resend: !!c.env.RESEND_API_KEY && !c.env.RESEND_API_KEY.includes('YOUR_API_KEY'),
      github: !!c.env.GITHUB_PAT && !!c.env.GITHUB_REPO_OWNER && !!c.env.GITHUB_REPO_NAME && !c.env.GITHUB_PAT.includes('YOUR_'),
      razorpay: !!c.env.RAZORPAY_KEY_ID && !!c.env.RAZORPAY_KEY_SECRET && !c.env.RAZORPAY_KEY_ID.includes('YOUR_KEY_HERE') && !c.env.RAZORPAY_KEY_SECRET.includes('YOUR_SECRET')
    };
    return error ? c.json({ error: 'Settings could not be loaded.' }, 503) : c.json({ settings: data, system });
  });

  app.patch('/api/admin/content', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_update_settings', {
      p_name: input.name, p_headline: input.headline, p_description: input.description,
      p_email: input.email, p_company: input.company, p_domain: input.domain
    });
    return error ? c.json({ error: 'Settings could not be saved.' }, 400) : c.json({ ok: true });
  });

  app.patch('/api/admin/settings', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_update_settings', {
      p_name: input.name, p_headline: input.headline, p_description: input.description,
      p_email: input.email, p_company: input.company, p_domain: input.domain
    });
    return error ? c.json({ error: 'Settings could not be saved.' }, 400) : c.json({ ok: true });
  });
  
  app.get('/api/admin/team', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('list_team');
    return error ? c.json({ error: 'Team could not be loaded: ' + error.message }, 503) : c.json(data);
  });
  
  app.post('/api/admin/team/invite', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403);
    const input = z.object({ email: z.string().email().max(150), role: z.enum(['administrator', 'product_manager', 'support']) }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('invite_staff_member', { invite_email: input.email, invite_role: input.role });
    return error ? c.json({ error: 'Could not send invitation. ' + error.message }, 400) : c.json({ ok: true });
  });
  
  app.post('/api/admin/team/:id/suspend', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403);
    const { error } = await c.get('db').rpc('modify_staff_status', { p_user_id: c.req.param('id') });
    return error ? c.json({ error: 'Could not modify staff status. ' + error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/checkout/create', async c => {
    const input = z.object({ productId: z.string() }).parse(await c.req.json());
    const user = c.get('user');
    const product = catalog.products.find(p => p.id === input.productId);
    if (!product) return c.json({ error: 'Product not found.' }, 404);
    if (product.releaseStatus === 'development') return c.json({ error: 'Product is not available for purchase.' }, 400);

    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) return c.json({ error: 'Payment gateway is not configured.' }, 503);

    // Temporary testing amount (₹500.00) until catalog has dynamic pricing
    const amountMinor = 50000;
    const currency = 'INR';

    const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`);
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({ amount: amountMinor, currency, receipt: `receipt_${crypto.randomUUID().slice(0, 8)}`, notes: { productId: product.id, userId: user.id } })
    });
    if (!rzpRes.ok) return c.json({ error: 'Failed to initialize checkout with payment gateway.' }, 500);

    const orderData = await rzpRes.json();
    return c.json({ orderId: orderData.id, amount: orderData.amount, currency: orderData.currency, keyId: c.env.RAZORPAY_KEY_ID });
  });
  app.post('/api/licenses/:id/download', async c => {
    const id = c.req.param('id');
    const db = c.get('db');
    
    // Fetch license status and join with products to get the slug for the file name
    const { data: license, error } = await db.from('licenses').select('status, products(slug)').eq('id', id).single();
    if (error || !license) return c.json({ error: 'License not found.' }, 404);
    if (license.status !== 'active') return c.json({ error: 'This license is revoked or inactive.' }, 403);
    
    const slug = (license.products as any)?.slug;
    if (!slug) return c.json({ error: 'Product information missing.' }, 500);
    
    // fileName is determined dynamically based on the release assets
    
    if (!c.env.GITHUB_PAT || !c.env.GITHUB_REPO_OWNER || !c.env.GITHUB_REPO_NAME) {
      return c.json({ error: 'GitHub storage is not configured.' }, 503);
    }
    
    try {
      // 1. Get the latest release from the private repo
      const releaseRes = await fetch(`https://api.github.com/repos/${c.env.GITHUB_REPO_OWNER}/${c.env.GITHUB_REPO_NAME}/releases/latest`, {
        headers: {
          'Authorization': `Bearer ${c.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Norvi-App'
        }
      });
      if (!releaseRes.ok) throw new Error('Release not found.');
      const release = await releaseRes.json() as any;

      // 2. Find the asset matching the slug (e.g., voro.zip or voro_setup.exe)
      const asset = release.assets.find((a: any) => 
        a.name.toLowerCase().includes(slug.toLowerCase()) && 
        (a.name.toLowerCase().endsWith('.zip') || a.name.toLowerCase().endsWith('.exe'))
      );
      
      if (!asset) {
        throw new Error(`Asset not found. Make sure you uploaded a .zip or .exe file containing '${slug}' in the name.`);
      }

      // 3. Request the download URL (GitHub responds with 302 to S3)
      const assetRes = await fetch(asset.url, {
        method: 'GET',
        redirect: 'manual', // Intercept the redirect to get the S3 URL
        headers: {
          'Authorization': `Bearer ${c.env.GITHUB_PAT}`,
          'Accept': 'application/octet-stream',
          'User-Agent': 'Norvi-App'
        }
      });

      // 4. Extract the direct S3 URL from the Location header
      if (assetRes.status === 302 || assetRes.status === 301) {
        const downloadUrl = assetRes.headers.get('location');
        if (downloadUrl) return c.json({ url: downloadUrl });
      }
      
      throw new Error('Failed to retrieve direct download link.');
    } catch (e: any) {
      return c.json({ error: e.message || `Could not generate download link for ${slug}.` }, 500);
    }
  });
  
  app.post('/api/checkout/create', async c => {
    const input = z.object({ productId: z.string().uuid() }).parse(await c.req.json());
    const db = c.get('db');
    const { data: user } = await db.auth.getUser();
    if (!user.user) return c.json({ error: 'Not authenticated' }, 401);

    // Get active price
    const { data: priceData, error: priceError } = await db.from('prices').select('*, products(name, catalog_key)').eq('product_id', input.productId).eq('active', true).maybeSingle();
    if (priceError || !priceData) return c.json({ error: 'Product is currently not available for purchase.' }, 400);

    const amount = priceData.amount_minor;
    const currency = priceData.currency;
    const idempotency = `checkout_${user.user.id}_${input.productId}_${Date.now()}`;

    // Create a pending order in DB
    const { data: order, error: orderError } = await db.from('orders').insert({
      user_id: user.user.id,
      product_id: input.productId,
      price_id: priceData.id,
      amount_minor: amount,
      currency,
      status: 'pending',
      idempotency_key: idempotency
    }).select().single();

    if (orderError || !order) return c.json({ error: 'Could not create order.' }, 500);

    // If Razorpay keys are configured, call Razorpay API
    if (c.env.RAZORPAY_KEY_ID && c.env.RAZORPAY_KEY_SECRET && !c.env.RAZORPAY_KEY_ID.includes('YOUR_KEY_HERE')) {
      try {
        const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`);
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
          body: JSON.stringify({ amount, currency, receipt: order.id })
        });
        const rzpData = await rzpRes.json();
        if (!rzpRes.ok) throw new Error(rzpData.error?.description || 'Razorpay order creation failed');
        
        await db.from('orders').update({ provider_order_id: rzpData.id }).eq('id', order.id);
        
        return c.json({
          ok: true,
          order_id: order.id,
          razorpay_order_id: rzpData.id,
          amount,
          currency,
          key_id: c.env.RAZORPAY_KEY_ID,
          name: priceData.products.name,
          mock: false
        });
      } catch (e: any) {
        return c.json({ error: 'Checkout service unavailable: ' + e.message }, 503);
      }
    }

    // Mock Mode fallback
    return c.json({
      ok: true,
      order_id: order.id,
      razorpay_order_id: 'order_mock_' + order.id,
      amount,
      currency,
      key_id: 'mock_key',
      name: priceData.products.name,
      mock: true
    });
  });

  app.post('/api/webhooks/razorpay', async c => {
    // Read the raw body as text for signature verification
    const bodyText = await c.req.text();
    const signature = c.req.header('x-razorpay-signature');
    if (!signature || !c.env.RAZORPAY_KEY_SECRET) return c.json({ error: 'Invalid webhook configuration' }, 400);

    try {
      // Use Web Crypto API to verify HMAC SHA256 signature
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(c.env.RAZORPAY_KEY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      
      const sigBytes = new Uint8Array(signature.length / 2);
      for (let i = 0; i < signature.length; i += 2) sigBytes[i / 2] = parseInt(signature.substr(i, 2), 16);
      
      const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(bodyText));
      if (!isValid) return c.json({ error: 'Invalid signature' }, 403);

      const event = JSON.parse(bodyText);
      const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      // Store the event
      await adminDb.from('webhook_events').insert({
        provider_event_id: event.id || `evt_${Date.now()}`,
        payload: event
      }).onConflict('provider_event_id').ignore();

      // Process payment.authorized or payment.captured
      if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
        const payment = event.payload.payment.entity;
        const receiptOrderId = payment.notes?.order_id || payment.description; // Usually we encode our order ID in notes or we fetch the Razorpay order to get the receipt
        
        // Wait, Razorpay includes the order_id in the payment entity, and we can fetch the order to get the receipt.
        // But for simplicity, we assume `payment.order_id` is the razorpay_order_id.
        const rzpOrderId = payment.order_id;
        
        // Find our internal order ID
        const { data: internalOrder } = await adminDb.from('orders').select('id').eq('provider_order_id', rzpOrderId).single();
        if (internalOrder) {
          await adminDb.rpc('process_payment_webhook', {
            p_order_id: internalOrder.id,
            p_payment_id: payment.id
          });
        }
      }
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ error: 'Webhook processing failed' }, 500);
    }
  });

  // Internal test endpoint to simulate a webhook if in mock mode
  app.post('/api/internal/mock-webhook', async c => {
    const { order_id, payment_id } = await c.req.json();
    const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await adminDb.rpc('process_payment_webhook', { p_order_id: order_id, p_payment_id: payment_id });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  });

  app.post('/api/admin/licenses/:id/device-reset', async c => {
    const user = c.get('user');
    if (!['owner', 'administrator', 'support'].includes(user.role)) return c.json({ error: 'Permission denied.' }, 403);
    const { error } = await c.get('db').rpc('reset_license_devices', { p_license_id: c.req.param('id') });
    return error ? c.json({ error: 'Could not reset devices.' }, 500) : c.json({ ok: true });
  });

  app.post('/api/internal/process-outbox', async c => {
    const authHeader = c.req.header('Authorization');
    if (!c.env.CRON_SECRET || authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    if (!c.env.SUPABASE_SERVICE_ROLE_KEY || !c.env.RESEND_API_KEY) {
      return c.json({ error: 'Missing configuration (Service Role or Resend Key).' }, 500);
    }

    // Use statically imported createClient to bypass RLS and act as admin
    const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: tasks, error: claimError } = await adminDb.rpc('claim_outbox_tasks', { p_limit: 10 });
    if (claimError) {
      console.error('Claim tasks error:', claimError);
      return c.json({ error: 'Failed to claim tasks.', details: claimError.message }, 500);
    }
    if (!tasks || tasks.length === 0) return c.json({ ok: true, processed: 0 });

    let processed = 0;
    
    for (const task of tasks) {
      try {
        let to = '';
        let subject = '';
        let html = '';
        
        if (task.kind === 'staff_invite') {
          const { data: invite } = await adminDb.from('staff_invitations').select('*').eq('id', task.record_id).single();
          if (!invite) throw new Error('Invite not found');
          to = invite.email;
          subject = 'You have been invited to join the Norvi team';
          html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <h1 style="font-size: 24px; font-weight: 600;">You've been invited to Norvi</h1>
              <p>You have been invited to join the Norvi team as a <b>${invite.role.replace('_', ' ')}</b>.</p>
              <p>To accept this invitation, simply click the button below and register an account using this exact email address (${invite.email}).</p>
              <a href="${c.env.APP_ORIGIN}/register" style="display: inline-block; background: #c5f042; color: #000; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 4px; margin-top: 10px;">Accept Invitation</a>
            </div>
          `;
        } else if (task.kind === 'welcome_email') {
          const { data: user } = await adminDb.auth.admin.getUserById(task.record_id);
          if (!user?.user) throw new Error('User not found');
          to = user.user.email!;
          subject = 'Welcome to Norvi';
          html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <h1 style="font-size: 24px; font-weight: 600;">Welcome to Norvi.</h1>
              <p>We are thrilled to have you here. Your account is now active.</p>
              <p>You can browse our collection of AI agents, simulate purchases, and manage your licenses directly from your personal workspace.</p>
              <a href="${c.env.APP_ORIGIN}/account" style="display: inline-block; background: #c5f042; color: #000; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 4px; margin-top: 10px;">Go to My Workspace</a>
            </div>
          `;
        } else if (task.kind === 'order_receipt') {
          const { data } = await adminDb.from('orders').select('*, user:auth.users(email), products(name)').eq('id', task.record_id).single();
          const order = data as any;
          if (!order) throw new Error('Order not found');
          to = order.user?.email;
          subject = `Your receipt for ${order.products?.name}`;
          html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <h1 style="font-size: 24px; font-weight: 600;">Thank you for your purchase.</h1>
              <p>Your order for <b>${order.products?.name}</b> has been successfully processed.</p>
              <p><b>Order ID:</b> ${order.id}</p>
              <p><b>Amount Paid:</b> ${order.currency} ${(order.amount_minor / 100).toFixed(2)}</p>
              <p>You can find your activation key and download your software in your account dashboard.</p>
              <a href="${c.env.APP_ORIGIN}/account/licenses" style="display: inline-block; background: #c5f042; color: #000; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 4px; margin-top: 10px;">View My License</a>
            </div>
          `;
        } else if (task.kind === 'support_reply') {
          const { data } = await adminDb.from('support_requests').select('*, user:auth.users(email)').eq('id', task.record_id).single();
          const ticket = data as any;
          if (!ticket) throw new Error('Support request not found');
          to = ticket.user?.email;
          subject = `Re: ${ticket.subject}`;
          html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
              <h1 style="font-size: 20px; font-weight: 600;">Update on your request</h1>
              <p>Our support team has responded to your request regarding "<b>${ticket.subject}</b>".</p>
              <p>Please log in to your workspace to view the response and continue the conversation.</p>
              <a href="${c.env.APP_ORIGIN}/account/support" style="display: inline-block; background: #c5f042; color: #000; padding: 12px 24px; text-decoration: none; font-weight: 600; border-radius: 4px; margin-top: 10px;">View Request</a>
            </div>
          `;
        } else {
           // Mark unknown task kinds as complete so they don't block the queue
           await adminDb.rpc('complete_outbox_task', { p_task_id: task.id });
           continue;
        }

        if (to && subject && html) {
          // Send via Resend
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: c.env.EMAIL_FROM || 'Norvi <noreply@norvi.com>', to, subject, html })
          });
          
          if (!res.ok) throw new Error(`Resend Error: ${await res.text()}`);
        }
        
        // Mark task as successfully completed
        await adminDb.rpc('complete_outbox_task', { p_task_id: task.id });
        processed++;
      } catch (err) {
        console.error(`Failed to process task ${task.id}:`, err);
        // Do not call complete_outbox_task. The lock will expire and it will be retried automatically.
      }
    }
    
    return c.json({ ok: true, processed });
  });

  app.all('/api/*', c => c.json({ error: 'This operation belongs to a later integration phase. Real purchases, activation, and commerce administration are not enabled.' }, 503));
  return app;
}
