import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { sign } from 'hono/jwt';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import catalog from '../../packages/shared/catalog.json';

export type LiveEnv = { APP_ORIGIN?: string; SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; AUTH_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> }; RAZORPAY_KEY_ID?: string; RAZORPAY_KEY_SECRET?: string; RAZORPAY_WEBHOOK_SECRET?: string; RESEND_API_KEY?: string; CRON_SECRET?: string; LICENSE_ENCRYPTION_KEY?: string; EMAIL_FROM?: string; GITHUB_PAT?: string; GITHUB_REPO_OWNER?: string; GITHUB_REPO_NAME?: string; norvi_sales_and_orders?: string; norvi_downloads?: string; norvi_team_and_security?: string; norvi_system_alerts?: string; };
type Identity = { id: string; email: string; name: string; role: string; status: string; createdAt: string; lastLogin: string | null };
type AppEnv = { Bindings: LiveEnv; Variables: { db: SupabaseClient; user: Identity; mfaRequired: boolean } };
type Factory = (c: Context<AppEnv>) => SupabaseClient;
const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
const password = z.string().min(12, 'Use at least 12 characters.').max(128);
const licenseSecret = (env: LiveEnv) => env.LICENSE_ENCRYPTION_KEY || env.CRON_SECRET;
const defaultPermissions: Record<string, string[]> = { owner: ['*'], administrator: ['', '/products', '/categories', '/customers', '/licenses', '/orders', '/payments', '/support', '/subscriptions', '/announcements', '/content', '/activity'], product_manager: ['', '/products', '/categories', '/announcements', '/content'], support: ['', '/customers', '/licenses', '/orders', '/payments', '/support', '/announcements'] };

async function sendDiscordLog(webhookUrl: string | undefined, content: string) {
  if (!webhookUrl) return;
  try { await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }); } catch (e) { console.error('Discord log failed', e); }
}
const fireLog = (c: any, webhookUrl: string | undefined, content: string) => {
  const p = sendDiscordLog(webhookUrl, content);
  try { if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') c.executionCtx.waitUntil(p); } catch(e) {}
};
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
    if (!['GET', 'HEAD'].includes(c.req.method) && !c.req.path.startsWith('/api/agent/') && !c.req.path.startsWith('/api/agent-auth/') && !c.req.path.startsWith('/api/webhooks/') && !c.req.path.startsWith('/api/internal/') && requestOrigin !== allowedOrigin) return c.json({ error: 'Request origin is not allowed.' }, 403);
    await next();
  });
  const regularBodyLimit = bodyLimit({ maxSize: 16384, onError: c => c.json({ error: 'Request is too large.' }, 413) });
  const uploadBodyLimit = bodyLimit({ maxSize: 10 * 1024 * 1024, onError: c => c.json({ error: 'Upload must be smaller than 10 MB.' }, 413) });
  app.use('/api/*', (c, next) => c.req.path === '/api/admin/upload' ? uploadBodyLimit(c, next) : regularBodyLimit(c, next));
  app.onError((e, c) => c.json({ error: e instanceof z.ZodError ? e.errors.map(x => x.message).join(' ') : 'The account service could not complete this request.' }, e instanceof z.ZodError ? 400 : 500));
  app.get('/api/health', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', livePayments: false }));
  app.get('/api/auth/config', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', preview: false, registration: isConfigured(c.env) }));
  app.get('/api/catalog', async c => {
    if (!isConfigured(c.env)) return c.json({ ...catalog, preview: false });
    const supabase = factory(c);
    const [productsResult, settingsResult, categoriesResult] = await Promise.all([
      supabase.from('products')
        .select('id, slug, name, categoryId:category_id, tagline, description, price:price_label, price1m:price_1m, price3m:price_3m, price_lifetime:price_lifetime, status, logoUrl:logo_url, features, version, requirements, releaseStatus:release_status, workflowHeading:workflow_heading, workflowDescription:workflow_description, workflowMediaUrl:workflow_media_url, workflowNote:workflow_note, aiUsage:ai_usage, deviceAllowance:device_allowance, is_on_sale')
        .eq('status', 'published')
        .order('created_at', { ascending: true }),
      supabase.from('site_settings').select('name, headline, description, email, company, domain, maintenance_mode, permissions, banner_text, sale_active, sale_percentage, socialInstagram:social_instagram, socialYoutube:social_youtube, socialFacebook:social_facebook, socialTwitter:social_twitter').single(),
      supabase.from('categories').select('id, slug, name, createdAt:created_at')
    ]);
    const products = (productsResult.data || catalog.products).map(p => ({...p, category: (categoriesResult.data || catalog.categories).find(c => c.id === p.categoryId) || null}));
    const settings = settingsResult.data ? { ...settingsResult.data, maintenanceMode: settingsResult.data.maintenance_mode, bannerText: settingsResult.data.banner_text, saleActive: settingsResult.data.sale_active, salePercentage: settingsResult.data.sale_percentage, permissions: (Object.keys(settingsResult.data.permissions || {}).length > 0) ? settingsResult.data.permissions : defaultPermissions } : catalog.settings;
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

  // Phase 10: Desktop Agent Auth & Hardware Registration
  app.post('/api/agent-auth/login', async c => {
    const input = z.object({ email: z.string().email(), password: z.string() }).parse(await c.req.json());
    // Use the admin or service client? No, regular client is fine for login
    const { data, error } = await c.get('db').auth.signInWithPassword({ email: input.email, password: input.password });
    if (error || !data.session) return c.json({ error: 'Sign-in failed. Check your email and password.' }, 401);
    
    // Return the access token that the agent will use as a Bearer token
    return c.json({ ok: true, access_token: data.session.access_token });
  });


  app.post('/api/agent-auth/check-updates', async c => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Missing or invalid token.' }, 401);
    const token = authHeader.split(' ')[1];
    
    // Verify JWT Lease (HMAC SHA-256)
    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'Encryption secret not configured' }, 503);
    
    try {
        const parts = token.split('.');
        if (parts.length !== 2) throw new Error("Invalid token format");
        const signatureData = parts[0];
        const signature = parts[1];
        
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
        
        // Reconstruct base64
        let sigBase64 = signature.replace(/-/g, "+").replace(/_/g, "/");
        sigBase64 += '='.repeat((4 - sigBase64.length % 4) % 4);
        const sigBuffer = Uint8Array.from(atob(sigBase64), c => c.charCodeAt(0));
        
        const isValid = await crypto.subtle.verify("HMAC", key, sigBuffer, encoder.encode(signatureData));
        if (!isValid) throw new Error("Invalid signature");
        
        let payloadBase64 = signatureData.split('.')[1];
        payloadBase64 += '='.repeat((4 - payloadBase64.length % 4) % 4);
        const payload = JSON.parse(atob(payloadBase64));
        
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            return c.json({ error: 'License lease has expired. Please authenticate again.' }, 403);
        }
        
        const input = z.object({
            productSlug: z.string(),
            currentVersion: z.string().optional()
        }).parse(await c.req.json());
        
        const slug = input.productSlug;
        
        if (!c.env.GITHUB_PAT || !c.env.GITHUB_REPO_OWNER || !c.env.GITHUB_REPO_NAME) {
            return c.json({ error: 'GitHub storage is not configured.' }, 503);
        }
        
        const releaseRes = await fetch(`https://api.github.com/repos/${c.env.GITHUB_REPO_OWNER}/${c.env.GITHUB_REPO_NAME}/releases?per_page=30`, {
          headers: {
            'Authorization': `Bearer ${c.env.GITHUB_PAT}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Norvi-App'
          }
        });
        if (!releaseRes.ok) throw new Error('Releases not found.');
        const releases = await releaseRes.json() as any[];
        const release = releases.find((r: any) => r.tag_name && r.tag_name.toLowerCase().startsWith(slug.toLowerCase() + '-'));
        if (!release) throw new Error(`No release tag found starting with ${slug}-`);
        
        const asset = release.assets.find((a: any) => 
          a.name.toLowerCase().includes(slug.toLowerCase()) && 
          (a.name.toLowerCase().endsWith('.zip') || a.name.toLowerCase().endsWith('.exe'))
        );
        if (!asset) throw new Error('Release binary not found.');
        
        // Extract version from tag (e.g. voro-v1.3.0 -> 1.3.0)
        let latestVersion = release.tag_name.replace(slug.toLowerCase() + '-', '').replace('v', '');
        
        // Intercept download redirect
        const assetRes = await fetch(asset.url, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'Authorization': `Bearer ${c.env.GITHUB_PAT}`,
            'Accept': 'application/octet-stream',
            'User-Agent': 'Norvi-App'
          }
        });
        
        let downloadUrl = '';
        if (assetRes.status === 302 || assetRes.status === 301) {
            downloadUrl = assetRes.headers.get('location') || '';
        }
        
        return c.json({
            latest_version: latestVersion,
            download_url: downloadUrl,
            release_notes: release.body || 'No release notes provided.'
        });
        
    } catch (e: any) {
        return c.json({ error: e.message || 'Updates failed.' }, 401);
    }
  });

  app.post('/api/agent-auth/activate', async c => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Missing or invalid token.' }, 401);
    const token = authHeader.split(' ')[1];
    
    const db = c.get('db');
    // Important: we manually set the session using the Bearer token because the browser cookie logic won't capture it
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return c.json({ error: 'Invalid or expired session.' }, 401);
    
    const input = z.object({
      licenseKey: z.string(),
      deviceId: z.string(),
      productSlug: z.string()
    }).parse(await c.req.json());
    
    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'Encryption secret not configured' }, 503);
    
    // We must manually pass the Authorization header to RPC if we want it to run as the user, OR set the session
    const userClient = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Get product ID
    const { data: product } = await userClient.from('products').select('id').eq('slug', input.productSlug).single();
    if (!product) return c.json({ error: 'Product not found.' }, 404);
    
    // Check hash
    // We need to import crypto or use WebCrypto, wait, pgp_sym_encrypt hashes are just SHA256 hex!
    // But we can let the frontend hash it, OR we hash it here using standard WebCrypto.
    const encoder = new TextEncoder();
    const data = encoder.encode(input.licenseKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const { data: result, error } = await userClient.rpc('activate_agent_license', {
      p_key_hash: keyHash,
      p_product_id: product.id,
      p_device_id: input.deviceId
    });
    
    if (error || !result || result.error) return c.json({ error: error?.message || result?.error || 'Activation failed.' }, 403);
    
    // Generate the cryptographic lease JWT for the agent
    // Since we are in edge runtime/Cloudflare, we'll use a simple HMAC JWT
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    
    // Lease valid for 7 days, or until trial expires
    let exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
    if (result.expires_at) {
      const trialExp = Math.floor(new Date(result.expires_at).getTime() / 1000);
      if (trialExp < exp) exp = trialExp;
    }
    
    const payload = btoa(JSON.stringify({
      license_id: result.license_id,
      device_id: input.deviceId,
      exp: exp,
      product: input.productSlug
    })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    
    const signatureData = header + "." + payload;
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureData));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    
    const lease = signatureData + "." + signature;
    
    return c.json({ ok: true, lease, expires_at: result.expires_at });
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
    if (error || data.error) {
      fireLog(c, c.env.norvi_team_and_security, `🚨 **[Security Alert: Failed Activation]**\n**Reason:** ${error?.message || data.error}\n**Product ID:** ${input.productId}\n**Device ID:** ${input.deviceId}`);
      return c.json({ error: error?.message || data.error || 'Activation could not be authorized.' }, 403);
    }

    const now = Math.floor(Date.now() / 1000);
    const leaseExp = now + (7 * 24 * 60 * 60); // 7-day offline grace period
    const jwt = await sign({
      sub: input.deviceId,
      iat: now,
      exp: leaseExp,
      license_id: data.license_id,
      product_id: input.productId,
      version: data.version,
      status: 'active'
    }, c.env.CRON_SECRET!);

    return c.json({ ok: true, lease: jwt, expires_at: new Date(leaseExp * 1000).toISOString() });
  });
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/internal/') || c.req.path.startsWith('/api/webhooks/')) return next();
    const db = c.get('db'); const { data, error } = await db.auth.getUser();
    if (error || !data.user?.email_confirmed_at) return c.json({ error: 'Sign in with a verified account to continue.' }, 401);
    const [profile, membership, assurance] = await Promise.all([
      db.from('profiles').select('id,display_name,suspended,created_at').eq('id', data.user.id).single(),
      db.from('staff_memberships').select('role,active').eq('user_id', data.user.id).maybeSingle(), db.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (profile.error || membership.error || assurance.error) return c.json({ error: 'Account setup is incomplete or unavailable. Contact the owner.' }, 503);
    if (profile.data.suspended || (membership.data && !membership.data.active)) return c.json({ error: 'Account access is suspended.' }, 403);
    const role = membership.data?.role || 'customer';
    let userObj: any = { id: data.user.id, email: data.user.email || '', name: profile.data.display_name, role, status: 'active', createdAt: profile.data.created_at, lastLogin: data.user.last_sign_in_at || null };

    const imp = getCookie(c, 'norvi_impersonate');
    if (imp && role === 'owner') {
      const [impProfile, impMembership] = await Promise.all([
        db.from('profiles').select('id,display_name,created_at').eq('id', imp).single(),
        db.from('staff_memberships').select('role').eq('user_id', imp).maybeSingle()
      ]);
      if (impProfile.data) {
        userObj = { id: imp, email: 'impersonated@hidden', name: impProfile.data.display_name, role: impMembership.data?.role || 'customer', status: 'active', createdAt: impProfile.data.created_at, lastLogin: null, isImpersonated: true };
      }
    }
    
    c.set('user', userObj);
    c.set('mfaRequired', (userObj.role !== 'customer' || assurance.data.nextLevel === 'aal2') && assurance.data.currentLevel !== 'aal2'); await next();
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
  app.use('/api/admin/*', async (c, next) => {
    const user = c.get('user');
    if (user.role === 'customer') return c.json({ error: 'Staff permission required.' }, 403);
    if (user.role === 'owner') return next();
    const first = c.req.path.slice('/api/admin'.length).split('/').filter(Boolean)[0] || '';
    const section = first === 'analytics' ? '' : '/' + first;
    const settings = await c.get('db').rpc('get_site_settings');
    const permissions = settings.data?.permissions || defaultPermissions;
    if (!(permissions[user.role] || []).includes(section)) return c.json({ error: 'Your role cannot access this section.' }, 403);
    await next();
  });
  app.use('/api/admin/*', async (c, next) => {
    await next();
    if (['POST', 'PATCH', 'DELETE'].includes(c.req.method) && c.get('user') && c.get('db')) {
      const db = c.get('db');
      const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
      // Fire and forget
      db.rpc('log_action', {
        p_action: c.req.method + ' ' + c.req.path.replace('/api/admin', ''),
        p_target_id: c.req.path,
        p_reason: 'Status: ' + c.res.status,
        p_metadata: { status: c.res.status, method: c.req.method },
        p_ip_address: ip
      });
    }
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
      db.from('announcements').select('id,message,created_at').eq('audience', 'customer').order('created_at', { ascending: false })
    ]);
    if (results.some(r => r.error)) return c.json({ error: 'Account records could not be loaded.' }, 503);
    const devices = results[3].data || [];
    return c.json({ user: c.get('user'), licenses: results[0].data!.map(l => ({ ...l, productId: l.product_id, suffix: l.key_suffix, createdAt: l.created_at, expiresAt: l.expires_at, devices: devices.filter(d => d.license_id === l.id) })), orders: results[1].data!.map(o => ({ ...o, productId: o.product_id, createdAt: o.created_at, amount: `${o.currency} ${(o.amount_minor / 100).toFixed(2)}` })), tickets: results[2].data!.map(t => ({ ...t, createdAt: t.created_at })), announcements: (results[4].data || []).map(a => ({ ...a, createdAt: a.created_at })), emails: [], preview: false });
  });

  app.post('/api/licenses/:id/reveal', async c => {
    const id = c.req.param('id'), user = c.get('user');
    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
    
    // Bypass RLS using service role client so Owner can view other users' licenses.
    // The RPC function below will enforce proper authorization.
    const serviceDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: license, error } = await serviceDb.from('licenses').select('id,status,user_id').eq('id', id).single();
    
    if (error || !license) return c.json({ error: 'License not found.' }, 404);
    if (license.user_id !== user.id && user.role !== 'owner') return c.json({ error: 'Permission denied.' }, 403);
    if (license.status !== 'active') return c.json({ error: 'License is revoked.' }, 403);
    
    const res = await c.get('db').rpc('reveal_license_key', { p_license_id: id, p_encryption_secret: secret });
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
    const { data, error } = await c.get('db').rpc('admin_list_customers');
    return error ? c.json({ error: 'Customers could not be loaded.' }, 503) : c.json(data);
  });
  app.post('/api/admin/customers/:id/suspend', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { suspended } = z.object({ suspended: z.boolean() }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('admin_set_customer_status', { p_customer_id: c.req.param('id'), p_suspended: suspended });
    return error ? c.json({ error: 'Status could not be updated.' }, 400) : c.json({ ok: true });
  });
  app.post('/api/admin/licenses/gift', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { email, productSlug, duration } = z.object({ email: z.string().email(), productSlug: z.string(), duration: z.string().optional().default('lifetime') }).parse(await c.req.json());
      const secret = licenseSecret(c.env);
      if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
      const { error, data } = await c.get('db').rpc('admin_gift_license', { p_email: email, p_product_slug: productSlug, p_encryption_secret: secret, p_duration: duration });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true, licenseId: data });
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


  app.post('/api/admin/impersonate', async c => { 
    if (c.get('user').role !== 'owner') return c.json({ error: 'Permission denied.' }, 403); 
    const { id } = await c.req.json(); 
    setCookie(c, 'norvi_impersonate', id, { path: '/' }); 
    return c.json({ ok: true }); 
  });
  
  app.delete('/api/admin/impersonate', c => { 
    deleteCookie(c, 'norvi_impersonate', { path: '/' }); 
    return c.json({ ok: true }); 
  });

  app.post('/api/admin/team/invite', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can invite staff.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('invite_staff_member', { invite_email: input.email, invite_role: input.role });
    return error ? c.json({ error: 'Failed to send invite: ' + error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/team/:id/suspend', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can suspend staff.' }, 403);
    const { error } = await c.get('db').rpc('admin_toggle_staff_status', { p_user_id: c.req.param('id') });
    return error ? c.json({ error: 'Could not suspend staff.' }, 500) : c.json({ ok: true });
  });

  app.post('/api/admin/team/:id/role', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can change roles.' }, 403);
    const { role } = z.object({ role: z.enum(['administrator', 'product_manager', 'support']) }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('admin_update_staff_role', { p_user_id: c.req.param('id'), p_role: role });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.delete('/api/admin/team/invite/:id', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { error } = await c.get('db').rpc('admin_delete_invitation', { p_invitation_id: c.req.param('id') });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/team/invite/:id/resend', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can resend invitations.' }, 403);
    const { error } = await c.get('db').rpc('admin_resend_invitation', { p_invitation_id: c.req.param('id') });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
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

  app.get('/api/admin/billing', async c => {
    // Return empty for now as subscriptions are not implemented
    return c.json({ items: [] });
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
    if (!error) fireLog(c, c.env.norvi_team_and_security, `🔒 **[Security Alert: License Revoked]**\n**License ID:** ${c.req.param('id')}\n**Admin:** ${c.get('user').email}\n**Reason:** ${input.reason || 'Manual revocation'}`);
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
    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
    const { data: res, error } = await c.get('db').rpc('admin_rotate_license_key', { p_license_id: c.req.param('id'), p_reason: input.reason || 'Key rotation', p_encryption_secret: secret });
    if (error || (res && res.error)) return c.json({ error: error?.message || res.error }, 500);
    
    fireLog(c, c.env.norvi_team_and_security, `🔄 **[Security Alert: Key Rotated]**\n**License ID:** ${c.req.param('id')}\n**Admin:** ${c.get('user').email}\n**Reason:** ${input.reason || 'Key rotation'}`);
    return c.json({ ok: true, version: res.version });
  });

  app.get('/api/admin/analytics', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_analytics');
    return error ? c.json({ error: 'Analytics could not be loaded.' }, 503) : c.json(data);
  });

  app.get('/api/admin/categories', async c => {
    const { data, error } = await c.get('db').from('categories').select('*').order('created_at', { ascending: true });
    return error ? c.json({ error: error.message }, 500) : c.json({ items: data, categories: data });
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
      
      const allowedTypes: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };
      const ext = allowedTypes[file.type];
      if (!ext) return c.json({ error: 'Upload a PNG, JPG, WebP, GIF, MP4, or WebM file.' }, 400);
      if (file.size > 10 * 1024 * 1024) return c.json({ error: 'Upload must be smaller than 10 MB.' }, 413);
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error } = await c.get('db').storage.from('product-assets').upload(fileName, file as any, { contentType: file.type, upsert: false });
      if (error) return c.json({ error: error.message }, 500);
      
      const { data } = c.get('db').storage.from('product-assets').getPublicUrl(fileName);
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
      p_workflow_media_url: input.workflowMediaUrl || null, p_workflow_note: input.workflowNote || '',
        p_price_1m: parseFloat(input.price_1m) || 0,
        p_price_3m: parseFloat(input.price_3m) || 0,
        p_price_lifetime: parseFloat(input.price_lifetime) || 999,
        p_ai_usage: input.aiUsage || null,
        p_device_allowance: input.deviceAllowance || null
      });
    return error ? c.json({ error: 'Product could not be saved. ' + error.message }, 400) : c.json({ ok: true });
  });

  app.get('/api/admin/announcements/:audience', async c => {
    const { data, error } = await c.get('db').rpc('list_announcements', { p_audience: c.req.param('audience') });
    return error ? c.json({ error: error.message }, 400) : c.json({ items: data });
  });

  app.post('/api/admin/announcements', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Permission denied.' }, 403);
    const { message, audience } = z.object({ message: z.string().min(1), audience: z.enum(['customer', 'team']) }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('admin_create_announcement', { p_message: message, p_audience: audience });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.delete('/api/admin/announcements/:id', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Permission denied.' }, 403);
    const { error } = await c.get('db').rpc('admin_delete_announcement', { p_id: c.req.param('id') });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
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
    const { error } = await c.get('db').rpc('admin_update_content', { p_headline: input.headline, p_description: input.description });
    return error ? c.json({ error: 'Settings could not be saved.' }, 400) : c.json({ ok: true });
  });

  app.patch('/api/admin/settings', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_update_settings', {
      p_name: input.name, p_headline: input.headline, p_description: input.description,
      p_email: input.email, p_company: input.company, p_domain: input.domain,
        p_social_instagram: input.socialInstagram, p_social_youtube: input.socialYoutube, p_social_facebook: input.socialFacebook, p_social_twitter: input.socialTwitter
    });
    if (error) return c.json({ error: 'Settings could not be saved: ' + error.message }, 400);
    if (c.get('user').role === 'owner' && typeof input.maintenanceMode === 'boolean') {
      const advanced = await c.get('db').rpc('admin_update_advanced_settings', { p_maintenance_mode: input.maintenanceMode, p_permissions: input.permissions || {} });
      if (advanced.error) return c.json({ error: 'Advanced settings could not be saved: ' + advanced.error.message }, 400);
    }
    return c.json({ ok: true });
  });

  app.patch('/api/admin/permissions', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403);
    const permissions = z.record(z.array(z.string().max(80)).max(30)).parse(await c.req.json());
    const current = await c.get('db').rpc('get_site_settings');
    if (current.error) return c.json({ error: 'Settings could not be loaded.' }, 503);
    const { error } = await c.get('db').rpc('admin_update_advanced_settings', { p_maintenance_mode: !!current.data?.maintenanceMode, p_permissions: permissions });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });
  
  app.post('/api/licenses/:id/download', async c => {
    const id = c.req.param('id');
    const db = c.get('db');
    const { data: settings } = await db.rpc('get_site_settings');
    if (settings?.maintenance_mode) return c.json({ error: 'Downloads are temporarily disabled for maintenance.' }, 503);
    
    // Fetch license status and join with products to get the slug for the file name
    const { data: license, error } = await db.from('licenses').select('status, products(slug)').eq('id', id).single();
    if (error || !license) return c.json({ error: 'License not found.' }, 404);
    if (license.status !== 'active') {
      fireLog(c, c.env.norvi_team_and_security, `🚨 **[Security Alert: Blocked Download]**\n**User:** ${c.get('user').email}\n**Reason:** License is ${license.status}\n**Product:** ${(license.products as any)?.slug || 'unknown'}`);
      return c.json({ error: 'This license is revoked or inactive.' }, 403);
    }
    
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
        if (downloadUrl) {
          fireLog(c, c.env.norvi_downloads, `⬇️ **[Agent Download]**\n**User:** ${c.get('user').email}\n**Product:** ${slug}\n**License ID:** ${id}`);
          return c.json({ url: downloadUrl });
        }
      }
      
      throw new Error('Failed to retrieve direct download link.');
    } catch (e: any) {
      return c.json({ error: e.message || `Could not generate download link for ${slug}.` }, 500);
    }
  });
  
  app.post('/api/store/trial/create', async c => {
    const db = c.get('db');
    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
    const input = z.object({ productSlug: z.string() }).parse(await c.req.json());
    const { data: licenseId, error } = await db.rpc('claim_free_trial', { p_product_slug: input.productSlug, p_encryption_secret: secret });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ ok: true, licenseId });
  });

  
    app.post('/api/checkout/validate-code', async c => {
      const { code, productId, duration } = await c.req.json();
      if (!code || !productId) return c.json({ valid: false });
      const { data } = await c.get('db').rpc('validate_promo_code', { p_code: code, p_product_id: productId, p_duration: duration || 'lifetime' });
      if (data && data.type) {
        return c.json({ valid: true, type: data.type, discount: data.discount });
      }
      return c.json({ valid: false });
    });

    app.post('/api/checkout/create', async c => {
    const db = c.get('db');
    const { data: settings } = await db.rpc('get_site_settings');
    if (settings?.maintenance_mode) return c.json({ error: 'Store is temporarily closed for maintenance. Please check back later.' }, 503);
    const input = z.object({ 
          productId: z.string().uuid(),
          duration: z.string().optional().default('lifetime'),
          renewalLicenseId: z.string().uuid().optional().nullable(),
          referralCode: z.string().optional().nullable()
        }).parse(await c.req.json());
      
      if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET || c.env.RAZORPAY_KEY_ID.includes('YOUR_KEY_HERE')) {
        return c.json({ error: 'Payment gateway is not configured.' }, 503);
      }
      
      const { data: checkout, error: checkoutError } = await db.rpc('create_checkout_order', { 
          p_product_id: input.productId,
          p_duration: input.duration,
          p_renewal_for_license_id: input.renewalLicenseId || null,
          p_referral_code: input.referralCode || null
        });
    if (checkoutError || !checkout?.order_id) return c.json({ error: checkoutError?.message || 'Could not create order.' }, 400);
    const amount = checkout.amount;
      const currency = checkout.currency;
      
      // 100% Free Bypass Logic
      if (amount === 0) {
        try {
          const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
          const secret = licenseSecret(c.env);
          
          // Removed redundant update so process_payment_webhook can generate the license
          
          const { data: res, error } = await adminDb.rpc('process_payment_webhook', {
            p_order_id: checkout.order_id,
            p_payment_id: 'free_' + checkout.order_id,
            p_encryption_secret: secret
          });
          
          if (!error && res && res.ok) {
            fireLog(c, c.env.norvi_sales_and_orders, `🚀 **[100% Free Checkout]**
**Order ID:** ${checkout.order_id}
License generated successfully.`);
            return c.json({ ok: true, order_id: checkout.order_id, skipped_payment: true });
          }
          return c.json({ error: 'Failed to generate free license. Reason: ' + (error ? error.message : JSON.stringify(res)) }, 500);
        } catch (e: any) {
          return c.json({ error: 'Internal bypass error: ' + e.message }, 500);
        }
      }
      
      try {
          const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`);
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
          body: JSON.stringify({ amount, currency, receipt: checkout.order_id, notes: { order_id: checkout.order_id } })
        });
        const rzpData = await rzpRes.json();
        if (!rzpRes.ok) return c.json({ error: rzpData.error?.description || 'Razorpay order creation failed' }, 400);
        
        const attached = await db.rpc('attach_checkout_provider_order', { p_order_id: checkout.order_id, p_provider_order_id: rzpData.id });
        if (attached.error) return c.json({ error: 'Could not attach the payment order.' }, 400);
        
        return c.json({
          ok: true,
          order_id: checkout.order_id,
          razorpay_order_id: rzpData.id,
          amount,
          currency,
          key_id: c.env.RAZORPAY_KEY_ID,
          name: checkout.name,
          mock: false
        });
    } catch (e: any) {
      return c.json({ error: 'Checkout service unavailable: ' + e.message }, 503);
    }
  });

  app.post('/api/checkout/verify', async c => {
      const input = await c.req.json();
      const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = input;
      
      const secret = c.env.RAZORPAY_WEBHOOK_SECRET;
      const keySecret = c.env.RAZORPAY_KEY_SECRET;
      
      if (!keySecret) return c.json({ error: 'Razorpay secret not configured' }, 503);
      
      // Verify Razorpay Signature (razorpay_order_id + "|" + razorpay_payment_id)
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(keySecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(`${razorpay_order_id}|${razorpay_payment_id}`));
      const expectedSig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (expectedSig !== razorpay_signature) {
        return c.json({ error: 'Invalid payment signature.' }, 403);
      }
      
      const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
      const encSecret = licenseSecret(c.env);
      if (!encSecret) return c.json({ error: 'License encryption is not configured.' }, 503);
      
      const { data: res, error } = await adminDb.rpc('process_payment_webhook', {
        p_order_id: orderId,
        p_payment_id: razorpay_payment_id,
        p_encryption_secret: encSecret
      });
      
      if (error) return c.json({ error: error.message }, 400);
      
      if (res && res.ok && res.license_id) {
         fireLog(c, c.env.norvi_sales_and_orders, `?? **[New Sale (Verified)]**
**Order ID:** ${orderId}
**Payment ID:** ${razorpay_payment_id}
License generated successfully.`);
      }
      
      return c.json({ ok: true });
    });

    app.post('/api/webhooks/razorpay', async c => {
    // Read the raw body as text for signature verification
    const bodyText = await c.req.text();
    const signature = c.req.header('x-razorpay-signature');
    if (!signature || !c.env.RAZORPAY_WEBHOOK_SECRET) return c.json({ error: 'Invalid webhook configuration' }, 400);

    try {
      // Use Web Crypto API to verify HMAC SHA256 signature
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(c.env.RAZORPAY_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      
      const sigBytes = new Uint8Array(signature.length / 2);
      for (let i = 0; i < signature.length; i += 2) sigBytes[i / 2] = parseInt(signature.substr(i, 2), 16);
      
      const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(bodyText));
      if (!isValid) return c.json({ error: 'Invalid signature' }, 403);

      const event = JSON.parse(bodyText);
      const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      // Store the event
      const stored = await adminDb.rpc('record_webhook_event', { p_provider_event_id: event.id || `evt_${Date.now()}`, p_payload: event });
      if (stored.error) return c.json({ error: 'Webhook could not be recorded.' }, 503);
      if (!stored.data) return c.json({ ok: true, duplicate: true });

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
          const secret = licenseSecret(c.env);
          if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
          const { data: res, error } = await adminDb.rpc('process_payment_webhook', {
            p_order_id: internalOrder.id,
            p_payment_id: payment.id,
            p_encryption_secret: secret
          });
          if (!error && res && res.ok) {
            fireLog(c, c.env.norvi_sales_and_orders, `🎉 **[New Sale (Razorpay)]**\n**Order ID:** ${internalOrder.id}\n**Payment ID:** ${payment.id}\nLicense generated successfully.`);
          }
        }
      }
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ error: 'Webhook processing failed' }, 500);
    }
  });

      app.post('/api/admin/licenses/:id/delete', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { error } = await c.get('db').rpc('admin_delete_license', { p_license_id: c.req.param('id') });
      if (!error) fireLog(c, c.env.norvi_team_and_security, `\ud83d\udde1\ufe0f **[Security Alert: License Deleted]**\n**License ID:** ${c.req.param('id')}\n**Admin:** ${c.get('user').email}`);
      return error ? c.json({ error: 'License could not be deleted.' }, 400) : c.json({ ok: true });
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

  
    app.get('/api/partner/stats', async c => {
      const { data, error } = await c.get('db').rpc('get_partner_stats');
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.post('/api/partner/join', async c => {
      const { code } = z.object({ code: z.string() }).parse(await c.req.json());
      const { data, error } = await c.get('db').rpc('join_partner_program', { p_code: code });
      return error ? c.json({ error: error.message }, 400) : c.json(data);
    });

    app.post('/api/partner/payout', async c => {
      const { upi } = z.object({ upi: z.string() }).parse(await c.req.json());
      const { data, error } = await c.get('db').rpc('request_payout', { p_upi_id: upi });
      return error ? c.json({ error: error.message }, 400) : c.json(data);
    });

    app.get('/api/admin/affiliates', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { data, error } = await c.get('db').rpc('admin_list_affiliates');
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.post('/api/admin/affiliates/:id/status', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { status } = await c.req.json();
      const { error } = await c.get('db').rpc('admin_update_affiliate_status', { p_affiliate_id: c.req.param('id'), p_status: status });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

    app.post('/api/admin/affiliates/:id/delete', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { error } = await c.get('db').rpc('admin_delete_affiliate', { p_affiliate_id: c.req.param('id') });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

    app.get('/api/admin/payouts', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { data, error } = await c.get('db').rpc('admin_list_payouts');
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.post('/api/admin/payouts/:id/mark-paid', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { error } = await c.get('db').rpc('admin_mark_payout_paid', { p_payout_id: c.req.param('id') });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

  
    app.get('/api/admin/ai/settings', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { data, error } = await c.get('db').rpc('admin_get_ai_settings');
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.post('/api/admin/ai/settings', async c => {
      if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can update AI keys.' }, 403);
      const { api_key, model, system_prompt } = await c.req.json();
      const cleanKey = (api_key || '').trim();
      let cleanModel = (model || '').trim();
      
      const { error } = await c.get('db').rpc('admin_update_ai_settings', { p_api_key: cleanKey, p_model: cleanModel, p_system_prompt: system_prompt });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

    app.get('/api/admin/ai/kb', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { data, error } = await c.get('db').rpc('admin_list_kb');
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.post('/api/admin/ai/kb', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { title, content } = await c.req.json();
      const db = c.get('db');
      const { data: kbId, error } = await db.rpc('admin_add_kb', { p_title: title, p_content: content });
      if (error) return c.json({ error: error.message }, 400);

      // Async Vectorization
      (async () => {
        try {
          const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
          const { data: settings } = await adminDb.from('ai_settings').select('*').eq('id', 1).single();
          if (settings && settings.api_key) {
             const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${settings.api_key.trim()}`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ model: 'models/gemini-embedding-2', content: { parts: [{ text: `Title: ${title}\nContent: ${content}` }] } })
             });
             const data = await res.json();
             if (data.embedding?.values) {
               await db.rpc('admin_update_kb_embedding', { p_id: kbId, p_embedding: `[${data.embedding.values.join(',')}]` });
             }
          }
        } catch(e) { console.error('Vectorization failed:', e); }
      })();

      return c.json({ id: kbId });
    });

    app.delete('/api/admin/ai/kb/:id', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { error } = await c.get('db').rpc('admin_delete_kb', { p_id: c.req.param('id') });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

  
    app.post('/api/chat', async c => {
      const { message, history } = await c.req.json();
      const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data: settings } = await adminDb.from('ai_settings').select('*').eq('id', 1).single();
      if (!settings || !settings.api_key) return c.json({ error: 'AI Agent is currently offline.' }, 503);

      try {
        // 1. Embed user message
        const embedRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${settings.api_key.trim()}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'models/gemini-embedding-2', content: { parts: [{ text: message }] } })
        });
        const embedData = await embedRes.json();
        const queryVector = embedData.embedding?.values;
        if (!queryVector) throw new Error('Failed to generate embedding: ' + (embedData.error?.message || JSON.stringify(embedData)));

        // 2. Search KB
        const { data: matches } = await adminDb.rpc('match_kb_articles', { query_embedding: `[${queryVector.join(',')}]`, match_threshold: 0.5, match_count: 4 });
        
        // 3. Construct Prompt
        const contextStr = (matches || []).map((m: any) => `Document: ${m.title}\n${m.content}`).join('\n\n');
        const systemInstruction = `${settings.system_prompt}\n\nHere is the exact company knowledge base. ONLY use this information to answer. If the answer is not here, politely say you don't know:\n\n${contextStr}`;

        const formattedHistory = (history || []).map((h: any) => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        }));
        formattedHistory.push({ role: 'user', parts: [{ text: message }] });

        // 4. Stream response from Gemini
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settings.model.trim()}:streamGenerateContent?key=${settings.api_key}&alt=sse`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system_instruction: { parts: [{ text: systemInstruction }] }, contents: formattedHistory })
        });

        if (!geminiRes.ok) throw new Error((await geminiRes.json()).error?.message || 'Chat failed');

        // Parse SSE stream and send raw text chunks to frontend
        return new Response(new ReadableStream({
          async start(controller) {
            const reader = geminiRes.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) { controller.close(); return; }
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                   try {
                     const data = JSON.parse(line.slice(6));
                     const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                     if (text) controller.enqueue(new TextEncoder().encode(text));
                   } catch(e) {}
                }
              }
            }
            controller.close();
          }
        }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      } catch (err: any) {
        return c.json({ error: err.message }, 500);
      }
    });

  
    app.get('/api/admin/marketing/stats', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { data, error } = await c.get('db').rpc('admin_get_audience_stats');
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.get('/api/admin/marketing/history', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { data, error } = await c.get('db').rpc('admin_list_broadcasts');
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

  
    app.post('/api/admin/marketing/send', async c => {
      const user = c.get('user');
      if (!['owner', 'administrator', 'product_manager'].includes(user.role)) return c.json({ error: 'Permission denied.' }, 403);
      
      const { audience, subject, htmlBody } = await c.req.json();
      const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data: emails, error: emailError } = await c.get('db').rpc('admin_get_audience_emails', { p_audience: audience });
      if (emailError) return c.json({ error: emailError.message }, 400);
      if (!emails || emails.length === 0) return c.json({ error: 'No users found in this audience segment.' }, 400);

      if (!c.env.RESEND_API_KEY || !c.env.EMAIL_FROM) return c.json({ error: 'Resend API key or EMAIL_FROM not configured in .env' }, 503);

      const addresses = emails.map((row: any) => row.email);
      
      // Async dispatch queue
      const dispatchPromise = (async () => {
        let sentCount = 0;
        try {
          const chunkSize = 100; // Resend batch limit
          for (let i = 0; i < addresses.length; i += chunkSize) {
            const chunk = addresses.slice(i, i + chunkSize);
            const batchPayload = chunk.map((email: string) => ({
              from: c.env.EMAIL_FROM,
              to: [email],
              subject: subject,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px 20px; color: #1a1a1a;">
                  <div style="margin-bottom: 30px;">
                    <h1 style="font-size: 26px; font-weight: 700; margin: 0 0 10px 0; letter-spacing: -0.5px;">${subject}</h1>
                  </div>
                  <div style="line-height: 1.6; font-size: 16px; color: #333;">
                    ${htmlBody}
                  </div>
                  <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid #eaeaea; font-size: 13px; color: #888; text-align: center;">
                    <p style="margin: 0 0 10px 0;"><strong>NORVI</strong> &mdash; All your AI agents in one place.</p>
                    <p style="margin: 0;">You are receiving this email because you are a registered user.</p>
                  </div>
                </div>
              `
            }));
            
            await fetch('https://api.resend.com/emails/batch', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(batchPayload)
            });
            sentCount += chunk.length;
          }
          
          await adminDb.from('broadcasts').insert([{
            subject, html_body: htmlBody, audience, sent_count: sentCount
          }]);
        } catch (e) {
          console.error('Broadcast failed:', e);
        }
      })();
      
      try { if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') c.executionCtx.waitUntil(dispatchPromise); } catch(e) {}

      return c.json({ ok: true, queued: addresses.length });
    });


    app.get('/api/admin/coupons', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied' }, 403);
      const { data, error } = await c.get('db').rpc('admin_list_coupons');
      return error ? c.json({ error: error.message }, 400) : c.json(data);
    });

    app.post('/api/admin/coupons', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied' }, 403);
      const input = await c.req.json();
      const { error } = await c.get('db').rpc('admin_upsert_coupon', { 
        p_id: input.id || null, p_code: input.code, p_discount: input.discount, 
        p_product_id: input.productId || null, p_duration: input.duration || null, p_expires_at: input.expiresAt || null 
      });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

    app.delete('/api/admin/products/:id', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { error } = await c.get('db').rpc('admin_delete_product', { p_product_id: c.req.param('id') });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

    app.post('/api/admin/promotions', async c => {
      const user = c.get('user');
      if (!['owner', 'administrator', 'product_manager'].includes(user.role)) return c.json({ error: 'Permission denied.' }, 403);
      const input = await c.req.json();
      const { error } = await c.get('db').rpc('admin_update_promotions', {
        p_banner_text: input.bannerText || '',
        p_sale_active: !!input.saleActive,
        p_sale_percentage: input.salePercentage || 0,
        p_sale_product_ids: input.saleProductIds || []
      });
      return error ? c.json({ error: 'Failed to update promotions: ' + error.message }, 400) : c.json({ ok: true });
    });

    app.delete('/api/admin/coupons/:id', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied' }, 403);
      const { error } = await c.get('db').rpc('admin_delete_coupon', { p_id: c.req.param('id') });
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

  app.all('/api/*', c => c.json({ error: 'This operation belongs to a later integration phase. Real purchases, activation, and commerce administration are not enabled.' }, 503));
  return app;
}
