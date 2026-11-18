import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { sign } from 'hono/jwt';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import catalog from '../../packages/shared/catalog.json';
import { normalizeAgentAiPolicyPayload } from '../../packages/shared/agentAi';
import { createAgentAiHandler, DEFAULT_MAX_BODY_BYTES, type AgentAiClient, type AgentAiHandlerDeps } from '../../packages/shared/agentAiProxy';
import { createAgentSttHandler, DEFAULT_MAX_STT_BODY_BYTES, type AgentSttHandlerDeps } from '../../packages/shared/agentSttProxy';
import { seal, unseal } from './crypto';

let cachedAiKeys: Record<string, { key: string; expiresAt: number }> = {};

export function clearAiKeyCache() {
  cachedAiKeys = {};
}

async function deriveKeyHex(secretStr: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretStr));
  return Array.from(new Uint8Array(hashBuffer), x => x.toString(16).padStart(2, '0')).join('');
}

export async function getActiveAiKey(
  env: LiveEnv,
  provider = 'openrouter',
  clientFactory?: (url: string, key: string) => any,
  specificKeyId?: string | null
): Promise<string | null> {
  const now = Date.now();
  const cacheKey = specificKeyId ? `key:${specificKeyId}` : `provider:${provider}`;
  const cached = cachedAiKeys[cacheKey];
  if (cached && cached.expiresAt > now) {
    return cached.key;
  }

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_URL.includes('test-project') && !env.SUPABASE_URL.includes('your-project')) {
    try {
      const adminDb = clientFactory
        ? clientFactory(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
        : createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      
      let query = adminDb
        .from('admin_ai_keys')
        .select('encrypted_key');

      if (specificKeyId) {
        query = query.eq('id', specificKeyId);
      } else {
        query = query.eq('provider', provider).eq('is_active', true);
      }

      const res = await Promise.race([
        query.maybeSingle(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);

      const data = res?.data;
      if (data?.encrypted_key) {
        const secret = licenseSecret(env);
        if (secret) {
          const keyHex = await deriveKeyHex(secret);
          const decrypted = await unseal(data.encrypted_key, keyHex);
          if (decrypted) {
            cachedAiKeys[cacheKey] = { key: decrypted.trim(), expiresAt: now + 60_000 };
            return decrypted.trim();
          }
        }
      }
    } catch {
      // Fall through to environment variable or global active key
    }
  }

  // If a specific assigned key was not found or failed to decrypt, fallback to global active key
  if (specificKeyId) {
    return getActiveAiKey(env, provider, clientFactory, null);
  }

  if (provider === 'openrouter') {
    return env.OPENROUTER_API_KEY?.trim() || null;
  }
  if (provider === 'groq') {
    return env.GROQ_API_KEY?.trim() || null;
  }
  return null;
}

export type LiveEnv = { APP_ORIGIN?: string; SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; AUTH_RATE_LIMITER?: { limit: (input: { key: string }) => Promise<{ success: boolean }> }; RAZORPAY_KEY_ID?: string; RAZORPAY_KEY_SECRET?: string; RAZORPAY_WEBHOOK_SECRET?: string; RESEND_API_KEY?: string; CRON_SECRET?: string; LICENSE_ENCRYPTION_KEY?: string; OPENROUTER_API_KEY?: string; GROQ_API_KEY?: string; EMAIL_FROM?: string; GITHUB_PAT?: string; GITHUB_REPO_OWNER?: string; GITHUB_REPO_NAME?: string; norvi_sales_and_orders?: string; norvi_downloads?: string; norvi_team_and_security?: string; norvi_system_alerts?: string; norvi_contact?: string; norvi_support?: string; };
type Identity = { id: string; email: string; name: string; role: string; status: string; createdAt: string; lastLogin: string | null; isImpersonated?: boolean; realAdminRole?: string };
type AppEnv = { Bindings: LiveEnv; Variables: { db: SupabaseClient; user: Identity; mfaRequired: boolean } };
type Factory = (c: Context<AppEnv>) => SupabaseClient;
const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
const password = z.string().min(12, 'Use at least 12 characters.').max(128);
const licenseSecret = (env: LiveEnv) => env.LICENSE_ENCRYPTION_KEY || env.CRON_SECRET;
const defaultPermissions: Record<string, string[]> = { owner: ['*'], administrator: ['', '/products', '/releases', '/categories', '/customers', '/licenses', '/devices', '/orders', '/payments', '/support', '/subscriptions', '/announcements', '/content', '/activity'], product_manager: ['', '/products', '/releases', '/categories', '/announcements', '/content'], support: ['', '/customers', '/licenses', '/devices', '/orders', '/payments', '/support', '/announcements'] };

async function sendDiscordLog(webhookUrl: string | undefined, content: string) {
  const url = (webhookUrl || '').trim().replace(/^["']|["']$/g, '');
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
  } catch (e) {
    console.error('Discord log failed', e);
  }
}
const fireLog = async (c: any, webhookUrl: string | undefined, content: string) => {
  const p = sendDiscordLog(webhookUrl, content);
  try { if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') { c.executionCtx.waitUntil(p); return; } } catch(e) {}
  await p;
};

const logAdminAudit = async (c: any, action: string, targetId: string, reason?: string, metadata?: any) => {
  try {
    const user = c.get('user');
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const adminDb = (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
      ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
      : c.get('db');
    
    const enrichedMetadata = {
      ...(metadata || {}),
      actorEmail: user?.email || 'system',
      actorName: user?.name || 'Staff'
    };

    await adminDb.rpc('log_action', {
      p_action: action,
      p_target_id: targetId,
      p_reason: reason || null,
      p_metadata: enrichedMetadata,
      p_ip_address: ip
    });
  } catch (err) {
    console.error('logAdminAudit error:', err);
  }
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
const email = z.object({ email: z.string().trim().email().max(254) });
export function isConfigured(env: LiveEnv) {
  try { const origin = new URL(env.APP_ORIGIN || ''); const provider = new URL(env.SUPABASE_URL || '');
    return !!env.SUPABASE_ANON_KEY && provider.protocol === 'https:' && origin.origin === env.APP_ORIGIN && (origin.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(origin.hostname));
  } catch { return false; }
}
const factory: Factory = c => {
  let cookieCache = { ...getCookie(c) };
  return createServerClient(c.env.SUPABASE_URL!, c.env.SUPABASE_ANON_KEY!, {
    cookieOptions: { name: 'norvi_auth', path: '/', httpOnly: true, sameSite: 'lax', secure: c.env.APP_ORIGIN!.startsWith('https://') },
    cookies: {
      getAll: () => Object.entries(cookieCache).map(([name, value]) => ({ name, value })),
      setAll: cookies => {
        for (const { name, value, options } of cookies) {
          cookieCache[name] = value;
          setCookie(c, name, value, { ...options, httpOnly: true, secure: c.env.APP_ORIGIN!.startsWith('https://'), sameSite: 'Lax', path: '/' });
        }
      },
    },
  });
};
// Per-request clients; all database access uses the user's JWT, never a service-role key.
let liveCatalogCache: { data: any; expiresAt: number } | null = null;
export const invalidateLiveCatalogCache = () => { liveCatalogCache = null; };

export function createLiveApp(makeClient: Factory = factory, options: { upstreamRateLimit?: 'netlify'; agentAiDeps?: Partial<AgentAiHandlerDeps>; agentSttDeps?: Partial<AgentSttHandlerDeps> } = {}) {
  const app = new Hono<AppEnv>();
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff'); c.header('Referrer-Policy', 'no-referrer');
    const allowedOrigin = (c.env.APP_ORIGIN || '').replace(/\/$/, '').replace(/^["']|["']$/g, '');
    const requestOrigin = (c.req.header('origin') || '').replace(/\/$/, '');
    if (!['GET', 'HEAD'].includes(c.req.method) && c.req.path !== '/api/agent-ai' && !c.req.path.startsWith('/api/agent-ai/') && c.req.path !== '/api/agent-stt' && !c.req.path.startsWith('/api/agent-stt/') && !c.req.path.startsWith('/api/agent/') && !c.req.path.startsWith('/api/agent-auth/') && !c.req.path.startsWith('/api/webhooks/') && !c.req.path.startsWith('/api/internal/') && requestOrigin !== allowedOrigin) return c.json({ error: 'Request origin is not allowed.' }, 403);
    await next();
  });
  const regularBodyLimit = bodyLimit({ maxSize: 16384, onError: c => c.json({ error: 'Request is too large.' }, 413) });
  const uploadBodyLimit = bodyLimit({ maxSize: 50 * 1024 * 1024, onError: c => c.json({ error: 'Upload must be smaller than 50 MB.' }, 413) });
  const agentAiBodyLimit = bodyLimit({ maxSize: DEFAULT_MAX_BODY_BYTES, onError: c => c.json({ error: 'Request payload is too large.' }, 413) });
  app.use('/api/*', (c, next) => (c.req.path === '/api/admin/upload' || c.req.path === '/api/admin/promotional-content') ? uploadBodyLimit(c, next) : (c.req.path === '/api/agent-ai' || c.req.path.startsWith('/api/agent-ai/')) ? agentAiBodyLimit(c, next) : regularBodyLimit(c, next));
  app.onError((e, c) => c.json({ error: e instanceof z.ZodError ? e.errors.map(x => x.message).join(' ') : 'The account service could not complete this request.' }, e instanceof z.ZodError ? 400 : 500));
  app.get('/api/health', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', livePayments: false }));
  app.get('/api/auth/config', c => c.json({ mode: isConfigured(c.env) ? 'supabase' : 'unconfigured', preview: false, registration: isConfigured(c.env) }));
  app.get('/api/catalog', async c => {
    if (!isConfigured(c.env)) return c.json({ ...catalog, preview: false });

    // In-memory cache check (30-second TTL for instant near-0ms response)
    if (liveCatalogCache && Date.now() < liveCatalogCache.expiresAt) {
      c.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      return c.json(liveCatalogCache.data);
    }

    const supabase = (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
      ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
      : factory(c);
    const [productsResult, settingsResult, categoriesResult] = await Promise.all([
      supabase.from('products')
        .select('id, slug, name, categoryId:category_id, tagline, description, price:price_label, price1w:price_1w, price1m:price_1m, price3m:price_3m, price_lifetime:price_lifetime, status, logoUrl:logo_url, features, version, requirements, releaseStatus:release_status, workflowHeading:workflow_heading, workflowDescription:workflow_description, workflowMediaUrl:workflow_media_url, workflowNote:workflow_note, aiUsage:ai_usage, deviceAllowance:device_allowance, is_on_sale, trialActive:trial_active, extendedContent:extended_content')
        .in('status', ['published', 'archived'])
        .order('created_at', { ascending: true }),
      supabase.from('site_settings').select('name, headline, description, email, company, domain, maintenance_mode, permissions, banner_text, sale_active, sale_percentage, socialInstagram:social_instagram, socialYoutube:social_youtube, socialFacebook:social_facebook, socialTwitter:social_twitter').single(),
      supabase.from('categories').select('id, slug, name, createdAt:created_at')
    ]);
    const products = (productsResult.data || catalog.products).map(p => ({...p, extendedContent: (p as any).extendedContent || {}, subHeading: (p as any).subHeading || (p as any).extendedContent?.subHeading || undefined, category: (categoriesResult.data || catalog.categories).find(c => c.id === p.categoryId) || null}));
    const settings = settingsResult.data ? { ...settingsResult.data, maintenanceMode: settingsResult.data.maintenance_mode, bannerText: settingsResult.data.banner_text, saleActive: settingsResult.data.sale_active, salePercentage: settingsResult.data.sale_percentage, permissions: (Object.keys(settingsResult.data.permissions || {}).length > 0) ? settingsResult.data.permissions : defaultPermissions } : catalog.settings;
    const categories = categoriesResult.data || catalog.categories;

    const catalogData = { categories, products, settings, preview: false };
    liveCatalogCache = {
      data: catalogData,
      expiresAt: Date.now() + 30_000
    };
    c.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    return c.json(catalogData);
  });
  app.all('/api/preview/*', c => c.json({ error: 'Preview actions are disabled in account mode.' }, 404));
  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/contact' || c.req.path === '/api/agent-ai' || c.req.path.startsWith('/api/agent-ai/') || c.req.path === '/api/agent-stt' || c.req.path.startsWith('/api/agent-stt/')) return next();
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
        let signatureData = '';
        let signature = '';
        let payloadBase64Str = '';

        if (parts.length === 3) {
          signatureData = parts[0] + '.' + parts[1];
          payloadBase64Str = parts[1];
          signature = parts[2];
        } else if (parts.length === 2) {
          signatureData = parts[0];
          payloadBase64Str = parts[0].includes('.') ? parts[0].split('.')[1] : parts[0];
          signature = parts[1];
        } else {
          throw new Error("Invalid token format");
        }
        
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
        
        // Reconstruct base64
        let sigBase64 = signature.replace(/-/g, "+").replace(/_/g, "/");
        sigBase64 += '='.repeat((4 - sigBase64.length % 4) % 4);
        const sigBuffer = Uint8Array.from(atob(sigBase64), c => c.charCodeAt(0));
        
        const isValid = await crypto.subtle.verify("HMAC", key, sigBuffer, encoder.encode(signatureData));
        if (!isValid) throw new Error("Invalid signature");
        
        let payloadBase64 = (payloadBase64Str || signatureData.split('.')[1] || '');
        payloadBase64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
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
    
    // Lease valid for 24 hours, or until trial/plan expires
    const now = Math.floor(Date.now() / 1000);
    let exp = now + (24 * 60 * 60); // 24-hour daily validity
    if (result.expires_at) {
      const planExp = Math.floor(new Date(result.expires_at).getTime() / 1000);
      if (planExp < exp) exp = planExp;
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

  app.post('/api/agent-auth/verify', async c => {
    const authHeader = c.req.header('Authorization');
    const body = await c.req.json().catch(() => ({}));
    const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : body.lease;
    const deviceId = body.deviceId;
    const productSlug = body.productSlug;

    if (!token && !body.licenseKey) {
      return c.json({ error: 'Missing lease token or license key.' }, 400);
    }

    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'Encryption secret not configured' }, 503);

    const encoder = new TextEncoder();
    const serviceDb = (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
      ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
      : c.get('db');

    let licenseId: string | null = null;
    let targetDeviceId: string = deviceId || '';
    let tokenProduct: string = '';

    if (token) {
      try {
        const parts = token.split('.');
        let signatureData = '';
        let signature = '';
        let payloadBase64 = '';

        if (parts.length === 3) {
          signatureData = parts[0] + '.' + parts[1];
          payloadBase64 = parts[1];
          signature = parts[2];
        } else if (parts.length === 2) {
          signatureData = parts[0];
          payloadBase64 = parts[0].includes('.') ? parts[0].split('.')[1] : parts[0];
          signature = parts[1];
        } else {
          throw new Error('Invalid token format');
        }

        const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
        let sigBase64 = signature.replace(/-/g, "+").replace(/_/g, "/");
        sigBase64 += '='.repeat((4 - sigBase64.length % 4) % 4);
        const sigBuffer = Uint8Array.from(atob(sigBase64), ch => ch.charCodeAt(0));

        const isValid = await crypto.subtle.verify("HMAC", key, sigBuffer, encoder.encode(signatureData));
        if (!isValid) throw new Error('Invalid signature');

        payloadBase64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
        payloadBase64 += '='.repeat((4 - payloadBase64.length % 4) % 4);
        const payload = JSON.parse(atob(payloadBase64));

        licenseId = payload.license_id;
        if (typeof payload.product === 'string' && payload.product.trim()) tokenProduct = payload.product.trim();
        if (!targetDeviceId && payload.device_id) {
          targetDeviceId = payload.device_id;
        }
      } catch (err: any) {
        if (!body.licenseKey) {
          return c.json({ error: 'Invalid or forged lease token.', invalid_token: true }, 401);
        }
      }
    }

    if (!licenseId && body.licenseKey) {
      const data = encoder.encode(body.licenseKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: secretRow } = await serviceDb
        .from('license_secrets')
        .select('license_id')
        .eq('key_hash', keyHash)
        .single();

      if (secretRow) {
        licenseId = secretRow.license_id;
      }
    }

    if (!licenseId) {
      return c.json({ error: 'License could not be verified.', deactivated: true }, 403);
    }

    const { data: license, error: licErr } = await serviceDb
      .from('licenses')
      .select('id, product_id, status, expires_at, max_devices')
      .eq('id', licenseId)
      .single();

    if (licErr || !license) {
      return c.json({ error: 'License record not found.', deactivated: true }, 404);
    }

    if (license.status !== 'active') {
      return c.json({ error: 'This license has been deactivated or revoked.', deactivated: true }, 403);
    }

    const now = Math.floor(Date.now() / 1000);
    if (license.expires_at) {
      const expiresAtSec = Math.floor(new Date(license.expires_at).getTime() / 1000);
      if (expiresAtSec <= now) {
        return c.json({ error: 'This license has expired.', expired: true, expires_at: license.expires_at }, 403);
      }
    }

    if (targetDeviceId) {
      const { data: device } = await serviceDb
        .from('devices')
        .select('id, active')
        .eq('license_id', license.id)
        .eq('installation_id', targetDeviceId)
        .single();

      if (device && !device.active) {
        return c.json({ error: 'This device has been deactivated or blocked.', blocked: true }, 403);
      }

      if (device) {
        await serviceDb.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id);
      }
    }

    const { data: prodRow } = license.product_id
      ? await serviceDb.from('products').select('slug').eq('id', license.product_id).single()
      : { data: null };
    if (prodRow?.slug && productSlug && prodRow.slug !== productSlug) {
      return c.json({ error: 'License does not belong to this agent product.', deactivated: true }, 403);
    }
    const resolvedProductSlug = prodRow?.slug || productSlug || tokenProduct || '';

    let exp = now + (24 * 60 * 60); // 24 hours daily validity
    if (license.expires_at) {
      const planExp = Math.floor(new Date(license.expires_at).getTime() / 1000);
      if (planExp < exp) exp = planExp;
    }

    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const payload = btoa(JSON.stringify({
      license_id: license.id,
      device_id: targetDeviceId,
      exp: exp,
      product: resolvedProductSlug
    })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const signatureData = header + "." + payload;
    const signKey = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBuffer = await crypto.subtle.sign("HMAC", signKey, encoder.encode(signatureData));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const freshLease = signatureData + "." + signature;

    return c.json({
      ok: true,
      lease: freshLease,
      expires_at: license.expires_at || null,
      status: 'active'
    });
  });

  app.post('/api/auth/login', async c => {
    const input = credentials.parse(await c.req.json());
    const { data, error } = await c.get('db').auth.signInWithPassword(input);
    if (error || !data.user?.email_confirmed_at) { if (data.session) await c.get('db').auth.signOut(); return c.json({ error: 'Sign-in failed. Check your details and verify your email.' }, 401); }
    return c.json({ ok: true });
  });
  app.post('/api/auth/reset', async c => {
      const input = email.parse(await c.req.json()); await c.get('db').auth.resetPasswordForEmail(input.email, { redirectTo: `${c.env.APP_ORIGIN || 'https://nor-vi.in'}/update-password` });
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
      const input = z.object({ token_hash: z.string().optional(), code: z.string().optional(), password }).parse(await c.req.json()); const db = c.get('db');
      if (input.code) {
        const { error } = await db.auth.exchangeCodeForSession(input.code);
        if (error) return c.json({ error: 'This recovery link is invalid or expired. Request another reset email.' }, 400);
      } else if (input.token_hash) {
        const { error } = await db.auth.verifyOtp({ token_hash: input.token_hash, type: 'recovery' });
        if (error) return c.json({ error: 'This recovery link is invalid or expired. Request another reset email.' }, 400);
      } else {
        return c.json({ error: 'Missing recovery token.' }, 400);
      }
      const result = await db.auth.updateUser({ password: input.password }); await db.auth.signOut({ scope: 'global' });
      return result.error ? c.json({ error: 'TRUE_ERROR: ' + result.error.message + '' }, 400) : c.json({ ok: true });
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
    let leaseExp = now + (24 * 60 * 60); // 24-hour daily validity
    if (data.expires_at) {
      const planExp = Math.floor(new Date(data.expires_at).getTime() / 1000);
      if (planExp < leaseExp) leaseExp = planExp;
    }
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

  const handleAgentAi = (c: Context<AppEnv>) => {
    const serviceClientFactory = options.agentAiDeps?.createServiceClient;
    const proxyHandler = createAgentAiHandler({
      getEnv: (key) => (c.env as Record<string, string | undefined>)[key],
      createServiceClient: serviceClientFactory || ((supabaseUrl, serviceRoleKey) =>
        createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        }) as unknown as AgentAiClient
      ),
      awaitFinalize: true,
      resolveApiKey: async (provider, keyId) => {
        return getActiveAiKey(c.env, provider, serviceClientFactory, keyId);
      },
      ...(options.agentAiDeps ?? {}),
    });
    return proxyHandler(c.req.raw);
  };
  app.all('/api/agent-ai', handleAgentAi);
  app.all('/api/agent-ai/*', handleAgentAi);

  const handleAgentStt = (c: Context<AppEnv>) => {
    const proxyHandler = createAgentSttHandler({
      getEnv: (key) => (c.env as Record<string, string | undefined>)[key],
      createServiceClient: (supabaseUrl, serviceRoleKey) =>
        createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        }) as unknown as AgentAiClient,
      resolveApiKey: async (provider, specificKeyId) => {
        return getActiveAiKey(c.env, provider, options.agentAiDeps?.createServiceClient, specificKeyId);
      },
      awaitFinalize: true,
      ...(options.agentSttDeps ?? {}),
    });
    return proxyHandler(c.req.raw);
  };
  app.all('/api/agent-stt', handleAgentStt);
  app.all('/api/agent-stt/*', handleAgentStt);

  app.post('/api/contact', async c => {
    const input = z.object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
      email: z.string().trim().email('Valid email is required.').max(254),
      message: z.string().trim().min(3, 'Message must be at least 3 characters.').max(3000),
    }).parse(await c.req.json());

    if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const serviceDb = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
        await serviceDb.from('contact_inquiries').insert({
          name: input.name,
          email: input.email,
          message: input.message,
          status: 'open'
        });
      } catch (err) {
        console.warn('[Contact] Could not persist to contact_inquiries table:', err);
      }
    }

    const discordMsg = `📬 **[New Contact Inquiry]**\n**From:** ${input.name} (<${input.email}>)\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**Message:**\n${input.message}`;
    const targetWebhook = c.env.norvi_contact || c.env.norvi_team_and_security;
    await fireLog(c, targetWebhook, discordMsg);

    return c.json({ ok: true });
  });

  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/internal/') || c.req.path.startsWith('/api/webhooks/') || c.req.path === '/api/contact') return next();
    const db = c.get('db'); const { data, error } = await db.auth.getUser();
    if (error || !data.user?.email_confirmed_at) return c.json({ error: 'Sign in with a verified account to continue.' }, 401);
    const [profile, membership, assurance] = await Promise.all([
      db.from('profiles').select('id,display_name,suspended,created_at').eq('id', data.user.id).single(),
      db.from('staff_memberships').select('role,active').eq('user_id', data.user.id).maybeSingle(), db.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (profile.error || membership.error || assurance.error) return c.json({ error: 'Account setup is incomplete or unavailable. Contact the owner.' }, 503);
    if (profile.data.suspended || (membership.data && !membership.data.active)) return c.json({ error: 'Account access is suspended.' }, 403);
    
    // Auto-claim pending invitation on login for existing registered accounts
    if (!membership.data && data.user.email) {
      try {
        const adminDb = (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
          ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
          : db;
        const { data: pendingInvites } = await adminDb
          .from('staff_invitations')
          .select('*')
          .eq('status', 'pending');

        const userEmail = data.user.email ? data.user.email.trim().toLowerCase() : '';
        const pendingInvite = userEmail ? (pendingInvites || []).find(
          (i: any) => i.email && i.email.toLowerCase() === userEmail
        ) : null;

        if (pendingInvite) {
          await adminDb.from('staff_memberships').upsert({
            user_id: data.user.id,
            role: pendingInvite.role,
            active: true
          });
          await adminDb.from('staff_invitations').update({ status: 'accepted' }).eq('id', pendingInvite.id);
          membership.data = { role: pendingInvite.role, active: true };
        }
      } catch (err) {
        console.error('Error auto-claiming staff invitation:', err);
      }
    }

    const role = membership.data?.role || 'customer';
    let userObj: any = { id: data.user.id, email: data.user.email || '', name: profile.data.display_name, role, status: 'active', createdAt: profile.data.created_at, lastLogin: data.user.last_sign_in_at || null };

    const imp = getCookie(c, 'norvi_impersonate');
    if (imp && (role === 'owner' || role === 'administrator')) {
      const adminDb = (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
        ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
        : db;
      const [impProfile, impMembership, impUser] = await Promise.all([
        adminDb.from('profiles').select('id,display_name,created_at').eq('id', imp).single(),
        adminDb.from('staff_memberships').select('role').eq('user_id', imp).maybeSingle(),
        adminDb.auth?.admin ? adminDb.auth.admin.getUserById(imp).catch(() => ({ data: { user: null } })) : Promise.resolve({ data: { user: null } })
      ]);
      if (impProfile.data) {
        const customerEmail = impUser?.data?.user?.email || 'customer@norvi.agency';
        userObj = {
          id: imp,
          email: customerEmail,
          name: impProfile.data.display_name || customerEmail,
          role: impMembership.data?.role || 'customer',
          status: 'active',
          createdAt: impProfile.data.created_at,
          lastLogin: null,
          isImpersonated: true,
          realAdminRole: role
        };
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
    // Unconditionally allow stopping impersonation so admins are never trapped
    if (c.req.path.startsWith('/api/admin/impersonate') && (c.req.method === 'DELETE' || c.req.path.endsWith('/stop'))) {
      return next();
    }
    const user = c.get('user');
    const effectiveRole = user.realAdminRole || user.role;
    if (c.req.path === '/api/admin/impersonate' && ['owner', 'administrator'].includes(effectiveRole)) {
      return next();
    }
    if (user.role === 'customer') return c.json({ error: 'Staff permission required.' }, 403);
    if (user.role === 'owner') return next();
    const first = c.req.path.slice('/api/admin'.length).split('/').filter(Boolean)[0] || '';
    const section = first === 'analytics' ? '' : first === 'devices' ? '/licenses' : first === 'impersonate' ? '/customers' : '/' + first;
    const settings = await c.get('db').rpc('get_site_settings');
    const permissions = settings.data?.permissions || defaultPermissions;
    if (section === '/permissions') {
      if ((permissions[user.role] || []).includes('manage_role_permissions')) return next();
      return c.json({ error: 'Your role cannot modify role permissions.' }, 403);
    }
    if (!(permissions[user.role] || []).includes(section)) return c.json({ error: 'Your role cannot access this section.' }, 403);
    await next();
  });
  app.use('/api/admin/*', async (c, next) => {
    await next();
    if (['POST', 'PATCH', 'DELETE'].includes(c.req.method)) {
      invalidateLiveCatalogCache();
      if (c.get('user') && c.get('db')) {
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
    }
  });

  app.patch('/api/me', async c => {
    const input = z.object({ name: z.string().trim().min(2).max(80) }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('update_my_profile', { new_name: input.name });
    return error ? c.json({ error: 'Profile could not be saved.' }, 400) : c.json({ ok: true });
  });
  app.get('/api/account', async c => {
    const user = c.get('user'), uid = user.id;
    const db = (user.isImpersonated && c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
      ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
      : c.get('db');
    const results = await Promise.all([
      db.from('licenses').select('id,product_id,status,key_suffix,created_at,expires_at,max_devices').eq('user_id', uid),
      db.from('orders').select('id,product_id,status,amount_minor,currency,created_at,provider_payment_id').eq('user_id', uid),
      db.from('support_requests').select('id,subject,message,status,created_at').eq('user_id', uid),
      db.from('devices').select('id,license_id,installation_id,active,last_seen_at').eq('active', true),
      db.from('announcements').select('id,message,created_at').eq('audience', 'customer').order('created_at', { ascending: false })
    ]);
    if (results.some(r => r.error)) return c.json({ error: 'Account records could not be loaded.' }, 503);
    const devices = results[3].data || [];
    return c.json({
      user: c.get('user'),
      licenses: results[0].data!.map(l => ({
        ...l,
        productId: l.product_id,
        suffix: l.key_suffix,
        createdAt: l.created_at,
        expiresAt: l.expires_at,
        maxDevices: l.max_devices || 3,
        devices: devices.filter(d => d.license_id === l.id)
      })),
      orders: results[1].data!.map(o => ({
        ...o,
        productId: o.product_id,
        createdAt: o.created_at,
        amount: `${o.currency || 'INR'} ${(Number(o.amount_minor || 0) / 100).toFixed(2)}`,
        amountMinor: o.amount_minor,
        currency: o.currency || 'INR',
        providerPaymentId: o.provider_payment_id
      })),
      tickets: results[2].data!.map(t => ({ ...t, createdAt: t.created_at })),
      announcements: (results[4].data || []).map(a => ({ ...a, createdAt: a.created_at })),
      emails: [],
      preview: false
    });
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
    const res = await c.get('db').rpc('release_device', { p_device_id: deviceId, p_license_id: id });
    if (res.error) return c.json({ error: 'Could not release device.' }, 500);
    return c.json({ ok: true });
  });
  app.post('/api/support', async c => {
    const input = z.object({ subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(3000) }).parse(await c.req.json());
    const user = c.get('user');
    const { error } = await c.get('db').rpc('create_support_request', { request_subject: input.subject, request_message: input.message });
    if (!error) {
      const discordMsg = `🎫 **[New Customer Support Ticket]**\n**User:** ${user?.name || 'Customer'} (<${user?.email || 'unknown'}>)\n**Subject:** ${input.subject}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**Message:**\n${input.message}`;
      const targetWebhook = c.env.norvi_support || c.env.norvi_team_and_security;
      await fireLog(c, targetWebhook, discordMsg);
    }
    return error ? c.json({ error: 'Support request could not be saved.' }, 400) : c.json({ ok: true });
  });
  app.get('/api/admin/customers', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Your role cannot access customers.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_list_customers');
    return error ? c.json({ error: 'Customers could not be loaded.' }, 503) : c.json(data);
  });
  app.get('/api/admin/customers/:id/orders', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_get_customer_orders', { p_customer_id: c.req.param('id') });
    return error ? c.json({ error: 'Customer orders could not be loaded.' }, 503) : c.json(data);
  });

  app.post('/api/admin/customers/:id/suspend', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { suspended } = z.object({ suspended: z.boolean() }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('admin_set_customer_status', { p_customer_id: c.req.param('id'), p_suspended: suspended });
    return error ? c.json({ error: 'Status could not be updated.' }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/customers/:id/delete', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const customerId = c.req.param('id');
    const { data, error } = await c.get('db').rpc('admin_delete_customer', { p_customer_id: customerId });
    if (error || (data && !data.ok)) {
      return c.json({ error: error?.message || 'Failed to delete customer account.' }, 400);
    }
    if (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_')) {
      try {
        const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
        await adminDb.auth.admin.deleteUser(customerId);
      } catch {}
    }
    fireLog(c, c.env.norvi_team_and_security, `🗑️ **[Security Alert: Customer Account Deleted]**\n**Customer ID:** ${customerId}\n**Email:** ${data?.email || 'Unknown'}\n**Admin:** ${c.get('user').email}`);
    return c.json({ ok: true });
  });
  app.post('/api/admin/licenses/gift', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { email, productSlug, duration, sendEmail } = z.object({
        email: z.string().email(),
        productSlug: z.string(),
        duration: z.enum(['1_day', '1_week', '1_week_trial', '1_month', '1_month_trial', '3_months', 'lifetime']).optional().default('lifetime'),
        sendEmail: z.boolean().optional().default(false),
      }).parse(await c.req.json());
      const secret = licenseSecret(c.env);
      if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
      const { error, data } = await c.get('db').rpc('admin_gift_license', { p_email: email, p_product_slug: productSlug, p_encryption_secret: secret, p_duration: duration });
      if (error) return c.json({ error: error.message }, 400);

      if (sendEmail && data) {
        try {
          await c.get('db').from('outbox').insert({
            kind: 'order_receipt',
            record_id: data,
            idempotency_key: 'gift_email_' + data,
          });
        } catch {}
      }

      return c.json({ ok: true, licenseId: data });
  });
  app.get('/api/admin', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_overview_stats');
    return error ? c.json({ error: 'Stats could not be loaded.' }, 503) : c.json(data);
  });

  app.get('/api/admin/inquiries', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    // 1. Try calling the RPC function
    const { data: rpcData, error: rpcErr } = await c.get('db').rpc('admin_list_inquiries');
    if (!rpcErr && Array.isArray(rpcData)) {
      return c.json(rpcData);
    }

    // 2. Resilient fallback using serviceDb directly from tables
    try {
      if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_ROLE_KEY) {
        return c.json([]);
      }
      const serviceDb = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
      const [ticketsRes, contactRes, profilesRes] = await Promise.all([
        serviceDb.from('support_requests').select('*').order('created_at', { ascending: false }),
        Promise.resolve(serviceDb.from('contact_inquiries').select('*').order('created_at', { ascending: false })).catch(() => ({ data: [] as any[] })),
        serviceDb.from('profiles').select('id, display_name')
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.display_name]));

      let userMap = new Map<string, string>();
      try {
        const { data: usersData } = await serviceDb.auth.admin.listUsers({ perPage: 1000 });
        if (usersData?.users) {
          usersData.users.forEach((u: any) => userMap.set(u.id, u.email || ''));
        }
      } catch {}

      const tickets = (ticketsRes.data || []).map((t: any) => ({
        id: t.id,
        source: 'support_ticket',
        userId: t.user_id,
        name: profileMap.get(t.user_id) || 'Registered Customer',
        email: userMap.get(t.user_id) || 'Unknown',
        subject: t.subject || 'Support Ticket',
        message: t.message,
        status: t.status || 'open',
        createdAt: t.created_at,
        activeLicenses: 0
      }));

      const contacts = (((contactRes as any)?.data) || []).map((ci: any) => ({
        id: ci.id,
        source: 'contact_form',
        userId: null,
        name: ci.name,
        email: ci.email,
        subject: 'Website Contact Inquiry',
        message: ci.message,
        status: ci.status || 'open',
        createdAt: ci.created_at,
        activeLicenses: 0
      }));

      const combined = [...tickets, ...contacts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return c.json(combined);
    } catch (e: any) {
      return c.json({ error: e.message || 'Failed to load inquiries.' }, 500);
    }
  });

  app.post('/api/admin/inquiries/:id/status', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const id = c.req.param('id');
    const { source, status } = z.object({
      source: z.enum(['support_ticket', 'contact_form']),
      status: z.enum(['open', 'resolved'])
    }).parse(await c.req.json());

    // Try RPC first
    const { error: rpcErr } = await c.get('db').rpc('admin_set_inquiry_status', {
      p_id: id,
      p_source: source,
      p_status: status
    });
    if (!rpcErr) return c.json({ ok: true });

    // Fallback to serviceDb direct update
    try {
      if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY) {
        const serviceDb = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
        if (source === 'support_ticket') {
          await serviceDb.from('support_requests').update({ status }).eq('id', id);
        } else {
          await serviceDb.from('contact_inquiries').update({
            status,
            resolved_at: status === 'resolved' ? new Date().toISOString() : null
          }).eq('id', id);
        }
      }
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ error: e.message || 'Failed to update status.' }, 500);
    }
  });

  app.delete('/api/admin/inquiries/:id', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const id = c.req.param('id');
    let source = c.req.query('source');
    if (!source) {
      try {
        const body = await c.req.json();
        source = body?.source;
      } catch {}
    }

    // Try RPC first if source is specified
    if (source) {
      const { error: rpcErr } = await c.get('db').rpc('admin_delete_inquiry', {
        p_id: id,
        p_source: source
      });
      if (!rpcErr) return c.json({ ok: true });
    }

    // Fallback to serviceDb direct deletion
    try {
      if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY) {
        const serviceDb = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
        if (source === 'support_ticket') {
          await serviceDb.from('support_requests').delete().eq('id', id);
        } else if (source === 'contact_form') {
          await serviceDb.from('contact_inquiries').delete().eq('id', id);
        } else {
          await Promise.all([
            serviceDb.from('support_requests').delete().eq('id', id),
            serviceDb.from('contact_inquiries').delete().eq('id', id)
          ]);
        }
      }
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ error: e.message || 'Failed to delete inquiry.' }, 500);
    }
  });

  app.get('/api/admin/team', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('list_team');
    return error ? c.json({ error: 'Team could not be loaded.' }, 503) : c.json(data);
  });


  app.post('/api/admin/impersonate', async c => { 
    const effectiveRole = c.get('user').realAdminRole || c.get('user').role;
    if (!['owner', 'administrator'].includes(effectiveRole)) return c.json({ error: 'Permission denied.' }, 403); 
    const { id } = await c.req.json(); 
    setCookie(c, 'norvi_impersonate', id, { path: '/' }); 
    await logAdminAudit(c, 'security.impersonation_started', id, 'Started customer impersonation session', { impersonatedUserId: id });
    return c.json({ ok: true }); 
  });
  
  app.delete('/api/admin/impersonate', async c => { 
    deleteCookie(c, 'norvi_impersonate', { path: '/' }); 
    await logAdminAudit(c, 'security.impersonation_stopped', 'session', 'Ended customer impersonation session');
    return c.json({ ok: true }); 
  });

  app.post('/api/admin/impersonate/stop', async c => { 
    deleteCookie(c, 'norvi_impersonate', { path: '/' }); 
    await logAdminAudit(c, 'security.impersonation_stopped', 'session', 'Ended customer impersonation session');
    return c.json({ ok: true }); 
  });

  app.post('/api/admin/team/invite', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can invite staff.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('invite_staff_member', { invite_email: input.email, invite_role: input.role });
    if (!error) {
      await logAdminAudit(c, 'staff.invited', input.email, `Invited teammate with role ${input.role}`, { role: input.role, targetEmail: input.email });
    }
    return error ? c.json({ error: 'Failed to send invite: ' + error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/team/promote', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only the agency owner can directly promote team members.' }, 403);
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(['administrator', 'product_manager', 'support'])
    }).parse(await c.req.json());

    const cleanEmail = email.trim().toLowerCase();

    // 1. Try RPC admin_direct_promote_staff
    const rpcRes = await c.get('db').rpc('admin_direct_promote_staff', { p_email: cleanEmail, p_role: role });
    if (!rpcRes.error) {
      await logAdminAudit(c, 'staff.promoted_direct', cleanEmail, `Directly recruited to ${role}`, { role, targetEmail: cleanEmail });
      return c.json({ ok: true, member: rpcRes.data });
    }

    // 2. Direct database promotion via service role fallback
    const adminDb = (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
      ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
      : c.get('db');

    // Look up customer in customer list
    const { data: customerList } = await c.get('db').rpc('admin_list_customers');
    const target = (customerList?.items || []).find((u: any) => u.email?.toLowerCase() === cleanEmail);

    if (!target) {
      return c.json({ error: `No registered account found with email "${email}". The customer must register on the website first.` }, 400);
    }

    const { error: upsertErr } = await adminDb.from('staff_memberships').upsert({
      user_id: target.id,
      role,
      active: true
    });
    if (upsertErr) return c.json({ error: 'Failed to promote member: ' + upsertErr.message }, 500);

    // Accept pending invitations for this email
    await adminDb.from('staff_invitations').update({ status: 'accepted' }).eq('email', cleanEmail);
    await logAdminAudit(c, 'staff.promoted_direct', cleanEmail, `Directly recruited to ${role}`, { role, targetEmail: cleanEmail });

    return c.json({ ok: true });
  });

  app.post('/api/admin/team/:id/suspend', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can suspend staff.' }, 403);
    const { error } = await c.get('db').rpc('admin_toggle_staff_status', { p_user_id: c.req.param('id') });
    if (!error) {
      await logAdminAudit(c, 'staff.access_toggled', c.req.param('id'), 'Toggled staff access status');
    }
    return error ? c.json({ error: 'Could not suspend staff.' }, 500) : c.json({ ok: true });
  });

  app.post('/api/admin/team/:id/role', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can change roles.' }, 403);
    const { role } = z.object({ role: z.enum(['administrator', 'product_manager', 'support']) }).parse(await c.req.json());
    const { error } = await c.get('db').rpc('admin_update_staff_role', { p_user_id: c.req.param('id'), p_role: role });
    if (!error) {
      await logAdminAudit(c, 'staff.role_changed', c.req.param('id'), `Changed staff role to ${role}`, { newRole: role });
    }
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.delete('/api/admin/team/invite/:id', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { error } = await c.get('db').rpc('admin_delete_invitation', { p_invitation_id: c.req.param('id') });
    if (!error) {
      await logAdminAudit(c, 'staff.invite_cancelled', c.req.param('id'), 'Cancelled staff invitation');
    }
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/team/invite/:id/resend', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Only owners can resend invitations.' }, 403);
    const { error } = await c.get('db').rpc('admin_resend_invitation', { p_invitation_id: c.req.param('id') });
    if (!error) {
      await logAdminAudit(c, 'staff.invite_resent', c.req.param('id'), 'Resent staff invitation email');
    }
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

  app.get('/api/admin/licenses/:id/telemetry', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_get_license_telemetry', { p_license_id: c.req.param('id') });
    if (error || (data && data.error)) return c.json({ error: error?.message || data?.error || 'Failed to load telemetry.' }, 400);
    return c.json(data);
  });

  app.post('/api/admin/devices/:id/ban', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = z.object({
      duration: z.enum(['24h', '7d', '1m', 'lifetime']),
      reason: z.string().max(250).optional()
    }).parse(await c.req.json());

    const { data, error } = await c.get('db').rpc('admin_ban_device', {
      p_device_id: c.req.param('id'),
      p_duration: input.duration,
      p_reason: input.reason || 'Admin ban'
    });

    if (error || (data && !data.ok)) {
      return c.json({ error: error?.message || data?.error || 'Failed to ban device.' }, 400);
    }

    fireLog(c, c.env.norvi_team_and_security, `🚫 **[Security Alert: Device Banned]**\n**Device ID:** ${c.req.param('id')}\n**HWID:** ${data.installation_id || 'Unknown'}\n**Duration:** ${input.duration}\n**Admin:** ${c.get('user').email}\n**Reason:** ${input.reason || 'Admin ban'}`);
    return c.json({ ok: true, device: data });
  });

  app.post('/api/admin/devices/:id/unban', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_unban_device', {
      p_device_id: c.req.param('id')
    });

    if (error || (data && !data.ok)) {
      return c.json({ error: error?.message || data?.error || 'Failed to unban device.' }, 400);
    }

    fireLog(c, c.env.norvi_team_and_security, `✅ **[Security Alert: Device Unbanned]**\n**Device ID:** ${c.req.param('id')}\n**HWID:** ${data.installation_id || 'Unknown'}\n**Admin:** ${c.get('user').email}`);
    return c.json({ ok: true, device: data });
  });

  app.post('/api/admin/devices/:id/remove', async c => {
    if (!['owner', 'administrator', 'support'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_remove_device', {
      p_device_id: c.req.param('id')
    });

    if (error || (data && !data.ok)) {
      return c.json({ error: error?.message || data?.error || 'Failed to remove device.' }, 400);
    }

    fireLog(c, c.env.norvi_team_and_security, `🗑️ **[Device Unlinked]**\n**Device ID:** ${c.req.param('id')}\n**HWID:** ${data.installation_id || 'Unknown'}\n**Admin:** ${c.get('user').email}`);
    return c.json({ ok: true, device: data });
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

  
    app.get('/api/admin/promotional-content', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { data, error } = await c.get('db').from('partner_promotional_content').select('*').order('created_at', { ascending: false });
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.post('/api/admin/promotional-content', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      try {
        const cType = c.req.header('content-type') || '';
        if (cType.includes('application/json')) {
          const jsonBody = await c.req.json();
          if (!jsonBody.title) return c.json({ error: 'Title is required.' }, 400);
          if (!jsonBody.media_url) return c.json({ error: 'Media URL is required.' }, 400);
          const { error: insertError } = await c.get('db').from('partner_promotional_content').insert({
            title: jsonBody.title,
            description: jsonBody.description || '',
            media_url: jsonBody.media_url,
            media_type: jsonBody.media_type || 'image'
          });
          return insertError ? c.json({ error: insertError.message }, 500) : c.json({ ok: true });
        }

        const body = await c.req.parseBody();
        const file = body['file'];
        const title = body['title'] as string;
        const description = body['description'] as string;
        
        if (!title) return c.json({ error: 'Title is required.' }, 400);
        if (!file || typeof file === 'string') return c.json({ error: 'No file uploaded.' }, 400);
        
        const allowedTypes: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };
        const ext = allowedTypes[file.type];
        if (!ext) return c.json({ error: 'Upload a PNG, JPG, WebP, GIF, MP4, or WebM file.' }, 400);
        if (file.size > 50 * 1024 * 1024) return c.json({ error: 'Upload must be smaller than 50 MB.' }, 413);
        
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await c.get('db').storage.from('promotions').upload(fileName, file as any, { contentType: file.type, upsert: false });
        if (uploadError) return c.json({ error: uploadError.message }, 500);
        
        const { data: urlData } = c.get('db').storage.from('promotions').getPublicUrl(fileName);
        const media_type = file.type.startsWith('video/') ? 'video' : 'image';
        
        const { error: insertError } = await c.get('db').from('partner_promotional_content').insert({
          title, description, media_url: urlData.publicUrl, media_type
        });
        
        return insertError ? c.json({ error: insertError.message }, 500) : c.json({ ok: true });
      } catch (e: any) {
        return c.json({ error: 'Upload failed: ' + e.message }, 500);
      }
    });

    app.delete('/api/admin/promotional-content/:id', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { error } = await c.get('db').from('partner_promotional_content').delete().eq('id', c.req.param('id'));
      return error ? c.json({ error: error.message }, 503) : c.json({ ok: true });
    });

    app.post('/api/admin/upload-ticket', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      try {
        const { fileType, fileName: clientFileName, bucket: requestedBucket } = await c.req.json();
        const allowedTypes: Record<string, string> = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/webp': 'webp',
          'image/gif': 'gif',
          'video/mp4': 'mp4',
          'video/webm': 'webm'
        };
        let ext = allowedTypes[(fileType || '').toLowerCase()];
        if (!ext && clientFileName) {
          const match = clientFileName.toLowerCase().match(/\.(mp4|webm|png|jpg|jpeg|webp|gif)$/);
          if (match) ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        }
        if (!ext) return c.json({ error: 'Upload a PNG, JPG, WebP, GIF, MP4, or WebM file.' }, 400);

        const bucket = requestedBucket === 'promotions' ? 'promotions' : 'product-assets';
        const storageFileName = `${crypto.randomUUID()}.${ext}`;

        const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data, error } = await adminDb.storage.from(bucket).createSignedUploadUrl(storageFileName, { upsert: true });
        if (error || !data) return c.json({ error: error?.message || 'Failed to generate upload ticket.' }, 500);

        const { data: publicUrlData } = adminDb.storage.from(bucket).getPublicUrl(storageFileName);
        return c.json({
          signedUrl: data.signedUrl,
          token: data.token,
          path: data.path,
          publicUrl: publicUrlData.publicUrl
        });
      } catch (e: any) {
        return c.json({ error: 'Failed to create upload ticket: ' + e.message }, 500);
      }
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
      if (file.size > 50 * 1024 * 1024) return c.json({ error: 'Upload must be smaller than 50 MB.' }, 413);
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error } = await c.get('db').storage.from('product-assets').upload(fileName, file as any, { contentType: file.type, upsert: false });
      if (error) return c.json({ error: error.message }, 500);
      
      const { data } = c.get('db').storage.from('product-assets').getPublicUrl(fileName);
      return c.json({ url: data.publicUrl });
    } catch (e: any) {
      return c.json({ error: 'Upload failed: ' + e.message }, 500);
    }
  });

  app.post('/api/admin/products/:id/trial', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_toggle_trial', { p_product_id: c.req.param('id'), p_trial_active: input.trialActive });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/products/:id/status', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { status } = z.object({ status: z.enum(['draft', 'published', 'archived']) }).parse(await c.req.json());
    const { data, error } = await c.get('db').rpc('admin_set_product_status', { p_product_id: c.req.param('id'), p_status: status });
    if (!error) {
      await logAdminAudit(c, 'product.status_changed', c.req.param('id'), `Changed agent product status to ${status}`, { status });
    }
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true, ...(data || {}) });
  });

  app.get('/api/admin/products/ai-policies', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const { data, error } = await c.get('db').rpc('admin_get_agent_ai_policies');
    return error ? c.json({ error: 'AI policies could not be loaded: ' + error.message }, 503) : c.json(data);
  });

  app.post('/api/admin/products/:id/ai-policy', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const productIdCheck = z.string().uuid().safeParse(c.req.param('id'));
    if (!productIdCheck.success) return c.json({ error: 'Invalid product ID.' }, 400);

    const parsed = normalizeAgentAiPolicyPayload(await c.req.json());
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const p = parsed.data;
    const rpcParams: Record<string, any> = {
      p_product_id: productIdCheck.data,
      p_ai_enabled: p.aiEnabled,
      p_default_model: p.defaultModel,
      p_task_models: p.taskModels,
      p_daily_limit: p.dailyLimit,
      p_weekly_limit: p.weeklyLimit,
      p_monthly_limit: p.monthlyLimit,
      p_trial_daily_limit: p.trialDailyLimit,
      p_max_input_chars: p.maxInputChars,
      p_max_output_tokens: p.maxOutputTokens,
      p_enforce_zdr: p.enforceZdr,
      p_stt_model: p.sttModel,
      p_groq_fallback_enabled: p.groqFallbackEnabled,
      p_stt_daily_limit: p.sttDailyLimit,
      p_stt_weekly_limit: p.sttWeeklyLimit,
      p_stt_monthly_limit: p.sttMonthlyLimit,
      p_stt_trial_daily_limit: p.sttTrialDailyLimit,
      p_ai_key_id: p.aiKeyId || null,
      p_trial_ai_key_id: p.trialAiKeyId || null,
      p_trial_default_model: p.trialDefaultModel || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      p_trial_enforce_zdr: Boolean(p.trialEnforceZdr),
      p_stt_key_id: p.sttKeyId || null,
      p_trial_stt_key_id: p.trialSttKeyId || null,
      p_trial_stt_fallback_enabled: Boolean(p.trialSttFallbackEnabled),
    };

    let { error } = await c.get('db').rpc('admin_upsert_agent_ai_policy', {
      ...rpcParams,
      p_trial_stt_model: p.trialSttModel || 'whisper-large-v3-turbo',
    });

    if (error && typeof error.message === 'string' && (error.message.includes('Could not find the function') || error.message.includes('schema cache'))) {
      // Fallback 1: 24 params (migration 076 before p_trial_stt_model)
      const fallback24 = await c.get('db').rpc('admin_upsert_agent_ai_policy', rpcParams);
      if (fallback24.error && typeof fallback24.error.message === 'string' && (fallback24.error.message.includes('Could not find the function') || fallback24.error.message.includes('schema cache'))) {
        // Fallback 2: 21 params (migration 075)
        const { p_stt_key_id, p_trial_stt_key_id, p_trial_stt_fallback_enabled, ...legacy075Params } = rpcParams;
        const fallback21 = await c.get('db').rpc('admin_upsert_agent_ai_policy', legacy075Params);
        error = fallback21.error;
      } else {
        error = fallback24.error;
      }
    }

    if (error && typeof error.message === 'string' && (error.message.includes('Could not find the function') || error.message.includes('schema cache'))) {
      // Fallback 3: Direct table upsert on agent_ai_policies if RPC not found in schema cache
      try {
        const directPolicy = await c.get('db').from('agent_ai_policies').upsert({
          product_id: productIdCheck.data,
          ai_enabled: p.aiEnabled,
          default_model: p.defaultModel,
          task_models: p.taskModels,
          daily_limit: p.dailyLimit,
          weekly_limit: p.weeklyLimit,
          monthly_limit: p.monthlyLimit,
          trial_daily_limit: p.trialDailyLimit,
          max_input_chars: p.maxInputChars,
          max_output_tokens: p.maxOutputTokens,
          enforce_zdr: p.enforceZdr,
          stt_model: p.sttModel,
          groq_fallback_enabled: p.groqFallbackEnabled,
          stt_daily_limit: p.sttDailyLimit,
          stt_weekly_limit: p.sttWeeklyLimit,
          stt_monthly_limit: p.sttMonthlyLimit,
          stt_trial_daily_limit: p.sttTrialDailyLimit,
          ai_key_id: p.aiKeyId || null,
          trial_ai_key_id: p.trialAiKeyId || null,
          trial_default_model: p.trialDefaultModel,
          trial_enforce_zdr: p.trialEnforceZdr,
          stt_key_id: p.sttKeyId || null,
          trial_stt_key_id: p.trialSttKeyId || null,
          trial_stt_fallback_enabled: p.trialSttFallbackEnabled,
          trial_stt_model: p.trialSttModel || 'whisper-large-v3-turbo',
        }, { onConflict: 'product_id' });
        if (!directPolicy.error) {
          error = null;
        }
      } catch {}
    }

    if (!error) {
      if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const adminDb = options.agentAiDeps?.createServiceClient
            ? options.agentAiDeps.createServiceClient(c.env)
            : createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
          const updateData: Record<string, any> = {};
          if (p.trialSttModel) updateData.trial_stt_model = p.trialSttModel;
          if (p.sttKeyId !== undefined) updateData.stt_key_id = p.sttKeyId || null;
          if (p.trialSttKeyId !== undefined) updateData.trial_stt_key_id = p.trialSttKeyId || null;
          if (p.trialSttFallbackEnabled !== undefined) updateData.trial_stt_fallback_enabled = Boolean(p.trialSttFallbackEnabled);
          if (Object.keys(updateData).length > 0) {
            await adminDb.from('agent_ai_policies').update(updateData).eq('product_id', productIdCheck.data);
          }
        } catch {
          // Non-critical if table already defaulted
        }
      }
      clearAiKeyCache();
    }
    return error ? c.json({ error: 'AI policy could not be saved: ' + error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/products', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const productParams = {
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
      p_device_allowance: input.deviceAllowance || null,
      p_extended_content: input.extendedContent || {},
      p_price_1w: input.price_1w != null && input.price_1w !== '' ? parseFloat(input.price_1w) : null
    };

    let { error } = await c.get('db').rpc('admin_upsert_product', productParams);

    // Fallback if PostgreSQL throws ambiguous candidate function or schema cache error
    if (error && typeof error.message === 'string' && (error.message.includes('Could not choose the best candidate') || error.message.includes('not unique') || error.message.includes('schema cache'))) {
      const productId = input.id || crypto.randomUUID();
      const productPayload: Record<string, any> = {
        id: productId,
        slug: input.slug,
        name: input.name,
        category_id: input.categoryId,
        tagline: input.tagline,
        description: input.description,
        price_label: input.price,
        status: input.status,
        logo_url: input.logoUrl || null,
        features: input.features || [],
        version: input.version,
        requirements: input.requirements,
        release_status: input.releaseStatus,
        workflow_heading: input.workflowHeading || 'Built for your workflow.',
        workflow_description: input.workflowDescription || '',
        workflow_media_url: input.workflowMediaUrl || null,
        workflow_note: input.workflowNote || '',
        price_1m: parseFloat(input.price_1m) || 0,
        price_3m: parseFloat(input.price_3m) || 0,
        price_lifetime: parseFloat(input.price_lifetime) || 999,
        ai_usage: input.aiUsage || null,
        device_allowance: input.deviceAllowance || null,
        extended_content: input.extendedContent || {},
        price_1w: input.price_1w != null && input.price_1w !== '' ? parseFloat(input.price_1w) : null,
      };
      const direct = await c.get('db').from('products').upsert(productPayload, { onConflict: 'id' });
      error = direct.error;
    }

    if (!error) {
      await logAdminAudit(c, input.id ? 'product.updated' : 'product.created', input.slug, `${input.id ? 'Updated' : 'Created'} agent product: ${input.name}`, { slug: input.slug, status: input.status, releaseStatus: input.releaseStatus });
    }
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
    if (!error) {
      await logAdminAudit(c, 'announcement.created', audience, `Created ${audience} announcement: "${message.slice(0, 50)}..."`);
    }
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.delete('/api/admin/announcements/:id', async c => {
    if (c.get('user').role !== 'owner') return c.json({ error: 'Permission denied.' }, 403);
    const { error } = await c.get('db').rpc('admin_delete_announcement', { p_id: c.req.param('id') });
    if (!error) {
      await logAdminAudit(c, 'announcement.deleted', c.req.param('id'), 'Deleted announcement');
    }
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
    if (!error) {
      await logAdminAudit(c, 'content.updated', 'homepage_content', 'Updated website headline and copy');
    }
    return error ? c.json({ error: 'Settings could not be saved.' }, 400) : c.json({ ok: true });
  });

  app.patch('/api/admin/settings', async c => {
    if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_update_settings', {
      p_name: input.name, p_headline: input.headline, p_description: input.description,
      p_email: input.email, p_company: input.company, p_domain: input.domain,
      p_banner_text: input.bannerText !== undefined ? input.bannerText : null,
      p_social_instagram: input.socialInstagram, p_social_youtube: input.socialYoutube, p_social_facebook: input.socialFacebook, p_social_twitter: input.socialTwitter
    });
    if (error) return c.json({ error: 'Settings could not be saved: ' + error.message }, 400);
    if (c.get('user').role === 'owner' && typeof input.maintenanceMode === 'boolean') {
      const advanced = await c.get('db').rpc('admin_update_advanced_settings', { p_maintenance_mode: input.maintenanceMode, p_permissions: input.permissions || {} });
      if (advanced.error) return c.json({ error: 'Advanced settings could not be saved: ' + advanced.error.message }, 400);
    }
    await logAdminAudit(c, 'settings.updated', 'store_configuration', 'Updated store configuration', { name: input.name, maintenanceMode: input.maintenanceMode });
    return c.json({ ok: true });
  });

  app.patch('/api/admin/permissions', async c => {
    const user = c.get('user');
    const current = await c.get('db').rpc('get_site_settings');
    if (current.error) return c.json({ error: 'Settings could not be loaded.' }, 503);
    const currentPermissions = current.data?.permissions || defaultPermissions;
    const canManage = user.role === 'owner' || (currentPermissions[user.role] || []).includes('manage_role_permissions');
    if (!canManage) return c.json({ error: 'Only the agency owner or authorized staff can configure permissions.' }, 403);

    const permissions = z.record(z.array(z.string().max(80)).max(30)).parse(await c.req.json());
    // Owner is permanently locked with full wildcard access
    permissions.owner = ['*'];

    const adminDb = (c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_'))
      ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!)
      : c.get('db');

    const { error } = await c.get('db').rpc('admin_update_advanced_settings', { p_maintenance_mode: !!current.data?.maintenanceMode, p_permissions: permissions });
    if (error) {
      const fallback = await adminDb.from('site_settings').update({ permissions }).eq('id', 1);
      if (fallback.error) return c.json({ error: fallback.error.message }, 400);
    }
    await logAdminAudit(c, 'settings.permissions_updated', 'dynamic_role_permissions', 'Saved dynamic role permissions matrix', { updatedRoles: Object.keys(permissions) });
    return c.json({ ok: true });
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
      // 1. Get the recent releases from the private repo
      const releasesRes = await fetch(`https://api.github.com/repos/${c.env.GITHUB_REPO_OWNER}/${c.env.GITHUB_REPO_NAME}/releases`, {
        headers: {
          'Authorization': `Bearer ${c.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Norvi-App'
        }
      });
      if (!releasesRes.ok) throw new Error('Releases not found.');
      const releases = await releasesRes.json() as any[];

      // 2. Find the first asset matching the slug across recent releases
      let asset = null;
      for (const release of releases) {
        asset = (release.assets || []).find((a: any) => 
          a.name.toLowerCase().includes(slug.toLowerCase()) && 
          (a.name.toLowerCase().endsWith('.zip') || a.name.toLowerCase().endsWith('.exe'))
        );
        if (asset) break;
      }
      
      if (!asset) {
        throw new Error(`Installer package for ${slug} is currently being prepared for your platform. Please reach out to support at norviagency@gmail.com for instant delivery.`);
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
    
    const { data: settings } = await db.rpc('get_site_settings');
    if (settings?.maintenance_mode) return c.json({ error: 'Store is temporarily closed for maintenance.' }, 503);

    const input = z.object({ productSlug: z.string() }).parse(await c.req.json());
    
    const { data: product } = await db.from('products').select('trial_active, status').eq('slug', input.productSlug).single();
    if (!product || product.trial_active === false || product.status === 'archived') return c.json({ error: 'Free trials are not available for this agent.' }, 403);

    const { data: licenseId, error } = await db.rpc('claim_free_trial', { p_product_slug: input.productSlug, p_encryption_secret: secret });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ ok: true, licenseId });
  });

  
    app.post('/api/checkout/validate-code', async c => {
      const { code, productId, duration } = await c.req.json();
      if (!code || !productId) return c.json({ valid: false });
      const user = c.get('user');
      const db = c.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!) : c.get('db');
      const { data, error } = await db.rpc('validate_promo_code', { p_code: code, p_product_id: productId, p_duration: duration || 'lifetime' });
      if (error) {
        console.error('validate_promo_code error:', error);
        return c.json({ valid: false, error: error.message });
      }
      if (data && data.valid) {
        if (data.type === 'referral' && data.partner_user_id && user?.id && data.partner_user_id === user.id) {
          return c.json({ valid: false, reason: 'self_referral' });
        }
        return c.json({ valid: true, type: data.type, discount: data.discount, allowedDurations: data.allowed_durations || data.allowedDurations });
      }
      if (data && data.reason === 'duration_mismatch') {
        return c.json({
          valid: false,
          reason: 'duration_mismatch',
          type: data.type,
          discount: data.discount,
          allowedDurations: data.allowed_durations || data.allowedDurations
        });
      }
      if (data && data.reason) {
        return c.json({ valid: false, reason: data.reason });
      }
      if (data && data.type) {
        return c.json({ valid: true, type: data.type, discount: data.discount });
      }
      return c.json({ valid: false, reason: 'not_found' });
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
      
      if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return c.json({ error: 'Missing required payment verification parameters.' }, 400);
      }

      const keySecret = c.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) return c.json({ error: 'Razorpay secret not configured' }, 503);
      
      // 1. Verify Razorpay Signature (razorpay_order_id + "|" + razorpay_payment_id) using timing-safe comparison
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(keySecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(`${razorpay_order_id}|${razorpay_payment_id}`));
      const expectedSig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (!timingSafeEqual(expectedSig, razorpay_signature)) {
        return c.json({ error: 'Invalid payment signature.' }, 403);
      }
      
      // 2. Fetch trusted internal order directly from database before executing fulfillment
      const adminDb = createClient(c.env.SUPABASE_URL!, c.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: orderRecord, error: orderErr } = await adminDb
        .from('orders')
        .select('id, user_id, amount_minor, currency, product_id, status, provider_order_id, products(id, slug, name)')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !orderRecord) {
        return c.json({ error: 'Order not found.' }, 404);
      }

      // 3. Verify caller authorization: the authenticated user must own the order (or be staff admin/owner)
      const user = c.get('user');
      if (user && orderRecord.user_id !== user.id && user.role !== 'owner' && user.role !== 'administrator') {
        return c.json({ error: 'Unauthorized to verify this order.' }, 403);
      }

      // 4. Strict Order ID binding check: ensure razorpay_order_id matches the order's provider_order_id (Prevents order substitution attack)
      if (!orderRecord.provider_order_id || orderRecord.provider_order_id !== razorpay_order_id) {
        return c.json({ error: 'Payment order mismatch.' }, 403);
      }

      // 5. Check order status eligibility: order must be pending or already paid
      if (orderRecord.status !== 'pending' && orderRecord.status !== 'paid') {
        return c.json({ error: `Order is not eligible for payment (current status: ${orderRecord.status}).` }, 400);
      }

      // 6. Verify payment entity directly with Razorpay API (amount, currency, order_id, capture status)
      if (!c.env.RAZORPAY_KEY_ID) {
        return c.json({ error: 'Payment gateway credentials incomplete.' }, 503);
      }

      let isCaptured = false;
      const product = orderRecord.products as any;
      const verifiedAmount = Number(orderRecord.amount_minor) / 100;
      const verifiedCurrency = orderRecord.currency || 'INR';

      try {
        const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${keySecret}`);
        const rzpPaymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        if (!rzpPaymentRes.ok) {
          return c.json({ error: 'Failed to verify payment with gateway.' }, 502);
        }
        const rzpPayment = await rzpPaymentRes.json() as any;

        // 6a. Ensure payment belongs to the expected Razorpay order
        if (rzpPayment.order_id !== razorpay_order_id) {
          return c.json({ error: 'Payment does not belong to the verified order.' }, 403);
        }

        // 6b. Verify payment amount matches internal order amount
        if (Number(rzpPayment.amount) !== Number(orderRecord.amount_minor)) {
          return c.json({ error: 'Payment amount mismatch.' }, 403);
        }

        // 6c. Verify currency matches
        if (String(rzpPayment.currency).toUpperCase() !== String(orderRecord.currency).toUpperCase()) {
          return c.json({ error: 'Payment currency mismatch.' }, 403);
        }

        // 6d. Check capture status
        isCaptured = rzpPayment.status === 'captured';

        if (!isCaptured) {
          // Payment is authorized but not captured yet. DO NOT fulfill license prematurely.
          return c.json({
            ok: true,
            verified: true,
            captured: false,
            status: rzpPayment.status,
            message: 'Payment verified but pending capture. License will be issued upon capture confirmation.',
            orderId: orderRecord.id,
            amount: verifiedAmount,
            currency: verifiedCurrency,
            productId: product?.id || orderRecord.product_id,
            productSlug: product?.slug || null,
            productName: product?.name || null
          });
        }
      } catch (e: any) {
        console.error('Razorpay payment capture check failed:', e);
        return c.json({ error: 'Payment gateway verification error: ' + (e?.message || 'Network error') }, 502);
      }

      // 7. Fulfill order ONLY when verified captured
      const encSecret = licenseSecret(c.env);
      if (!encSecret) return c.json({ error: 'License encryption is not configured.' }, 503);
      
      const { data: res, error } = await adminDb.rpc('process_payment_webhook', {
        p_order_id: orderId,
        p_payment_id: razorpay_payment_id,
        p_encryption_secret: encSecret
      });
      
      if (error) return c.json({ error: error.message }, 400);
      
      if (res && res.ok && res.license_id) {
         fireLog(c, c.env.norvi_sales_and_orders, `🎉 **[New Sale (Verified)]**
**Order ID:** ${orderId}
**Payment ID:** ${razorpay_payment_id}
License generated successfully.`);
      }

      return c.json({ 
        ok: true,
        verified: true,
        captured: true,
        orderId: orderRecord.id,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        productId: product?.id || orderRecord.product_id,
        productSlug: product?.slug || null,
        productName: product?.name || null
      });
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
      
      // Store the event for audit and idempotency
      const stored = await adminDb.rpc('record_webhook_event', { p_provider_event_id: event.id || `evt_${Date.now()}`, p_payload: event });
      if (stored.error) return c.json({ error: 'Webhook could not be recorded.' }, 503);
      if (!stored.data) return c.json({ ok: true, duplicate: true });

      // Process payment.captured ONLY. Do not fulfill on payment.authorized!
      if (event.event === 'payment.captured') {
        const payment = event.payload?.payment?.entity;
        if (!payment) return c.json({ error: 'Missing payment entity' }, 400);
        const rzpOrderId = payment.order_id;
        if (!rzpOrderId) return c.json({ ok: true, ignored: 'Missing order_id' });
        
        // Find our internal order ID by provider_order_id
        const { data: internalOrder } = await adminDb
          .from('orders')
          .select('id, amount_minor, currency, status')
          .eq('provider_order_id', rzpOrderId)
          .maybeSingle();

        if (internalOrder) {
          // Verify amount and currency
          if (Number(payment.amount) !== Number(internalOrder.amount_minor) || 
              String(payment.currency).toUpperCase() !== String(internalOrder.currency).toUpperCase()) {
            console.error(`[Webhook Alert] Amount or currency mismatch on order ${internalOrder.id}`);
            return c.json({ error: 'Amount or currency mismatch' }, 400);
          }

          const secret = licenseSecret(c.env);
          if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
          const { data: res, error } = await adminDb.rpc('process_payment_webhook', {
            p_order_id: internalOrder.id,
            p_payment_id: payment.id,
            p_encryption_secret: secret
          });
          if (!error && res && res.ok && res.license_id) {
            fireLog(c, c.env.norvi_sales_and_orders, `🎉 **[New Sale (Razorpay Captured)]**\n**Order ID:** ${internalOrder.id}\n**Payment ID:** ${payment.id}\nLicense generated successfully.`);
          }
        }
      } else if (event.event === 'payment.authorized') {
        // Acknowledge payment.authorized safely without fulfilling license prematurely
        return c.json({ ok: true, status: 'authorized_pending_capture' });
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

  
    
    app.get('/api/partner/promotional-content', async c => {
      const { data, error } = await c.get('db').from('partner_promotional_content').select('*').order('created_at', { ascending: false });
      return error ? c.json({ error: error.message }, 503) : c.json(data);
    });

    app.get('/api/partner/stats', async c => {
      const user = c.get('user');
      if (!user) return c.json({ active: false, authenticated: false });
      
      const { data, error } = await c.get('db').rpc('get_partner_stats');
      if (!error && data) {
        return c.json({ ...data, authenticated: true });
      }

      // Resilient fallback query via serviceDb
      try {
        if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY) {
          const serviceDb = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
          const { data: aff } = await serviceDb.from('affiliates').select('*').eq('user_id', user.id).maybeSingle();
          if (aff) {
            return c.json({ active: true, code: aff.code, status: aff.status, sales: 0, totalEarned: 0, pendingBalance: 0, authenticated: true });
          }
        }
      } catch {}
      return c.json({ active: false, authenticated: true });
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

    // --- Phase 12: Database-Encrypted Multi-Key AI Manager ---
    const getAdminAiDb = (c: Context<AppEnv>) => {
      if (c.env.SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY && !c.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_') && !c.env.SUPABASE_URL.includes('test-project')) {
        return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      }
      return c.get('db');
    };

    app.get('/api/admin/ai/keys', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) {
        return c.json({ error: 'Permission denied.' }, 403);
      }
      const db = getAdminAiDb(c);
      const { data, error } = await db
        .from('admin_ai_keys')
        .select('id, provider, label, key_suffix, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        return c.json({ error: error.message }, 500);
      }
      return c.json({ keys: data || [] });
    });

    app.post('/api/admin/ai/keys', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) {
        return c.json({ error: 'Permission denied. Only owners and administrators can manage AI keys.' }, 403);
      }
      const body = await c.req.json();
      const label = String(body.label || '').trim();
      const rawKey = String(body.key || '').trim();
      const provider = String(body.provider || 'openrouter').trim().toLowerCase();
      const makeActive = body.make_active !== false;

      if (!label || label.length > 100) {
        return c.json({ error: 'A valid label (1 to 100 characters) is required.' }, 400);
      }
      if (!rawKey || rawKey.length < 15) {
        return c.json({ error: 'Invalid API key format.' }, 400);
      }

      const secret = licenseSecret(c.env);
      if (!secret) {
        return c.json({ error: 'Server encryption key is not configured.' }, 500);
      }

      const keyHex = await deriveKeyHex(secret);
      const encryptedKey = await seal(rawKey, keyHex);
      const keySuffix = '...' + rawKey.slice(-4);

      const db = getAdminAiDb(c);

      // If making active, deactivate other keys for this provider
      if (makeActive) {
        await db
          .from('admin_ai_keys')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('provider', provider);
      }

      const { data: inserted, error } = await db
        .from('admin_ai_keys')
        .insert({
          provider,
          label,
          encrypted_key: encryptedKey,
          key_suffix: keySuffix,
          is_active: makeActive,
          updated_by: c.get('user').id,
        })
        .select('id, provider, label, key_suffix, is_active, created_at, updated_at')
        .single();

      if (error) {
        return c.json({ error: error.message }, 400);
      }

      clearAiKeyCache();
      await sendDiscordLog(c.env.norvi_system_alerts, `[Security Alert] New ${provider.toUpperCase()} AI key added: "${label}" (${keySuffix}) by ${c.get('user').email} (Active: ${makeActive})`);

      return c.json({ ok: true, key: inserted });
    });

    app.post('/api/admin/ai/keys/:id/activate', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) {
        return c.json({ error: 'Permission denied.' }, 403);
      }
      const id = c.req.param('id');
      const db = getAdminAiDb(c);

      const { data: targetKey, error: findErr } = await db
        .from('admin_ai_keys')
        .select('id, provider, label, key_suffix')
        .eq('id', id)
        .single();

      if (findErr || !targetKey) {
        return c.json({ error: 'Key not found.' }, 404);
      }

      await db
        .from('admin_ai_keys')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('provider', targetKey.provider)
        .neq('id', id);

      const { error: actErr } = await db
        .from('admin_ai_keys')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (actErr) {
        return c.json({ error: actErr.message }, 400);
      }

      clearAiKeyCache();
      await sendDiscordLog(c.env.norvi_system_alerts, `[Security Alert] Active ${targetKey.provider.toUpperCase()} AI key changed to "${targetKey.label}" (${targetKey.key_suffix}) by ${c.get('user').email}`);

      return c.json({ ok: true });
    });

    app.delete('/api/admin/ai/keys/:id', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) {
        return c.json({ error: 'Permission denied.' }, 403);
      }
      const id = c.req.param('id');
      const db = getAdminAiDb(c);

      const { data: targetKey } = await db
        .from('admin_ai_keys')
        .select('id, provider, label, key_suffix, is_active')
        .eq('id', id)
        .maybeSingle();

      const { error } = await db.from('admin_ai_keys').delete().eq('id', id);
      if (error) {
        return c.json({ error: error.message }, 400);
      }

      clearAiKeyCache();
      if (targetKey) {
        await sendDiscordLog(c.env.norvi_system_alerts, `[Security Alert] AI key deleted: "${targetKey.label}" (${targetKey.key_suffix}) by ${c.get('user').email}`);
      }

      return c.json({ ok: true });
    });

    app.post('/api/admin/ai/keys/:id/test', async c => {
      if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) {
        return c.json({ error: 'Permission denied.' }, 403);
      }
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));
      const requestedProvider = body?.provider === 'groq' || id === 'active-groq' ? 'groq' : 'openrouter';
      const db = getAdminAiDb(c);
      const fetchFn = (options.agentAiDeps?.fetchImpl as typeof fetch) || fetch;

      let rawKey: string | null = null;
      let label = 'Active Key';
      let keySuffix = '••••';
      let keyProvider = requestedProvider;

      if (id === 'active' || id === 'global' || id === 'active-groq') {
        const { data: activeKey } = await db
          .from('admin_ai_keys')
          .select('id, provider, label, key_suffix, encrypted_key, is_active')
          .eq('provider', requestedProvider)
          .eq('is_active', true)
          .maybeSingle();

        if (activeKey) {
          label = activeKey.label;
          keySuffix = activeKey.key_suffix;
          keyProvider = activeKey.provider;
          const secret = licenseSecret(c.env);
          if (secret) {
            const keyHex = await deriveKeyHex(secret);
            rawKey = await unseal(activeKey.encrypted_key, keyHex);
          }
        } else if (requestedProvider === 'groq' && c.env.GROQ_API_KEY) {
          rawKey = c.env.GROQ_API_KEY.trim();
          label = 'Netlify Env Groq Key';
          keySuffix = rawKey.slice(-4);
        } else if (requestedProvider === 'openrouter' && c.env.OPENROUTER_API_KEY) {
          rawKey = c.env.OPENROUTER_API_KEY.trim();
          label = 'Netlify Env Key';
          keySuffix = rawKey.slice(-4);
        }
      } else {
        const { data: targetKey, error: findErr } = await db
          .from('admin_ai_keys')
          .select('id, provider, label, key_suffix, encrypted_key, is_active')
          .eq('id', id)
          .maybeSingle();

        if (findErr || !targetKey) {
          return c.json({ error: 'Key not found.' }, 404);
        }
        label = targetKey.label;
        keySuffix = targetKey.key_suffix;
        keyProvider = targetKey.provider || requestedProvider;
        const secret = licenseSecret(c.env);
        if (secret) {
          const keyHex = await deriveKeyHex(secret);
          rawKey = await unseal(targetKey.encrypted_key, keyHex);
        }
      }

      if (!rawKey) {
        return c.json({
          ok: false,
          working: false,
          label,
          keySuffix,
          provider: keyProvider,
          error: 'Could not decrypt key or no key configured.',
        }, 400);
      }

      const testModel = typeof body?.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : null;

      const startMs = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), testModel ? 8000 : 4000);

        let resp: Response;
        if (keyProvider === 'groq') {
          resp = await fetchFn('https://api.groq.com/openai/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rawKey.trim()}`,
            },
            signal: controller.signal,
          });
        } else {
          if (testModel) {
            resp = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${rawKey.trim()}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://nor-vi.in',
                'X-Title': 'NORVI Agency Diagnostic Model Test',
              },
              body: JSON.stringify({
                model: testModel,
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1,
              }),
              signal: controller.signal,
            });
          } else {
            resp = await fetchFn('https://openrouter.ai/api/v1/auth/key', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${rawKey.trim()}`,
              },
              signal: controller.signal,
            });
          }
        }
        clearTimeout(timeout);
        const latencyMs = Date.now() - startMs;

        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          if (keyProvider === 'groq') {
            const modelsList = Array.isArray(data?.data) ? data.data.map((m: any) => m.id) : [];
            const effectiveModel = testModel || 'whisper-large-v3-turbo';
            const modelAvailable = modelsList.length === 0 || modelsList.some((m: string) => m.toLowerCase().includes(effectiveModel.toLowerCase()) || m.toLowerCase().includes('whisper'));
            return c.json({
              ok: true,
              working: true,
              label,
              keySuffix,
              provider: 'groq',
              latencyMs,
              testedModel: effectiveModel,
              modelAvailable,
            });
          }
          const keyData = data?.data || {};
          return c.json({
            ok: true,
            working: true,
            label,
            keySuffix,
            provider: 'openrouter',
            latencyMs,
            testedModel: testModel,
            usage: keyData.usage ?? null,
            limit: keyData.limit ?? null,
            isFreeTier: keyData.is_free_tier ?? null,
          });
        }

        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `Upstream returned HTTP ${resp.status}`;
        return c.json({
          ok: false,
          working: false,
          label,
          keySuffix,
          provider: keyProvider,
          latencyMs,
          statusCode: resp.status,
          testedModel: testModel,
          error: errMsg,
        });
      } catch (err: any) {
        const latencyMs = Date.now() - startMs;
        const isTimeout = err.name === 'AbortError' || err.message?.includes('abort');
        return c.json({
          ok: false,
          working: false,
          label,
          keySuffix,
          provider: keyProvider,
          latencyMs,
          testedModel: testModel,
          error: isTimeout ? (testModel ? 'Model test timed out (8000ms)' : 'Connection timed out (4000ms)') : (err.message || `Network error pinging ${keyProvider}`),
        });
      }
    });

    app.get('/api/admin/system/health', async c => {
      if (!['owner', 'administrator', 'product_manager', 'support'].includes(c.get('user').role)) {
        return c.json({ error: 'Permission denied.' }, 403);
      }
      const fetchFn = (options.agentAiDeps?.fetchImpl as typeof fetch) || fetch;
      const timeoutMs = 3000;
      const runWithTimeout = async <T>(fn: () => Promise<T>, timeoutMessage = 'Timeout'): Promise<T> => {
        return Promise.race([
          fn(),
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
        ]);
      };

      const checks: Array<{
        id: string;
        name: string;
        category: string;
        status: 'ok' | 'warning' | 'error';
        latencyMs?: number;
        message: string;
        details?: string;
        actionUrl?: string;
      }> = [];

      // 1. Supabase Database & Auth Engine
      const dbStart = Date.now();
      try {
        await runWithTimeout(async () => {
          const { error } = await c.get('db').from('products').select('id', { count: 'exact', head: true });
          if (error) throw error;
        });
        checks.push({
          id: 'database',
          name: 'Supabase Database & Auth',
          category: 'core',
          status: 'ok',
          latencyMs: Date.now() - dbStart,
          message: 'Operational · Connected',
          actionUrl: 'https://supabase.com/dashboard',
        });
      } catch (err: any) {
        checks.push({
          id: 'database',
          name: 'Supabase Database & Auth',
          category: 'core',
          status: 'error',
          latencyMs: Date.now() - dbStart,
          message: 'Connection failed',
          details: err.message,
          actionUrl: 'https://supabase.com/dashboard',
        });
      }

      // 2. OpenRouter AI Provider (Active Key)
      const aiStart = Date.now();
      try {
        const activeKey = await getActiveAiKey(c.env, 'openrouter', options.agentAiDeps?.createServiceClient, null);
        if (!activeKey) {
          checks.push({
            id: 'openrouter',
            name: 'OpenRouter AI Provider',
            category: 'ai',
            status: 'error',
            message: 'No active AI key found',
            details: 'Configure an active OpenRouter key in Releases.',
            actionUrl: '/admin/releases',
          });
        } else {
          const resp = await runWithTimeout(async () => {
            return fetchFn('https://openrouter.ai/api/v1/auth/key', {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${activeKey}` },
            });
          });
          const latencyMs = Date.now() - aiStart;
          if (resp.ok) {
            checks.push({
              id: 'openrouter',
              name: 'OpenRouter AI Provider',
              category: 'ai',
              status: 'ok',
              latencyMs,
              message: 'Active Key Operational',
              actionUrl: '/admin/releases',
            });
          } else {
            checks.push({
              id: 'openrouter',
              name: 'OpenRouter AI Provider',
              category: 'ai',
              status: 'error',
              latencyMs,
              message: `Upstream rejected key (HTTP ${resp.status})`,
              actionUrl: '/admin/releases',
            });
          }
        }
      } catch (err: any) {
        checks.push({
          id: 'openrouter',
          name: 'OpenRouter AI Provider',
          category: 'ai',
          status: 'error',
          latencyMs: Date.now() - aiStart,
          message: 'Verification check failed',
          details: err.message,
          actionUrl: '/admin/releases',
        });
      }

      // 3. Razorpay Payments Gateway
      const razorpayId = c.env.RAZORPAY_KEY_ID;
      const razorpaySecret = c.env.RAZORPAY_KEY_SECRET;
      if (!razorpayId || !razorpaySecret || razorpayId.includes('YOUR_KEY')) {
        checks.push({
          id: 'payments',
          name: 'Razorpay Payments Gateway',
          category: 'commerce',
          status: 'warning',
          message: 'Credentials not configured',
          actionUrl: '/admin/orders',
        });
      } else {
        const payStart = Date.now();
        try {
          const authHeader = 'Basic ' + Buffer.from(`${razorpayId}:${razorpaySecret}`).toString('base64');
          const resp = await runWithTimeout(async () => {
            return fetchFn('https://api.razorpay.com/v1/payments?count=1', {
              headers: { 'Authorization': authHeader },
            });
          });
          const latencyMs = Date.now() - payStart;
          if (resp.ok) {
            const masked = razorpayId.slice(0, 8) + '...' + razorpayId.slice(-4);
            checks.push({
              id: 'payments',
              name: 'Razorpay Payments Gateway',
              category: 'commerce',
              status: 'ok',
              latencyMs,
              message: `Operational · ${masked}`,
              actionUrl: '/admin/orders',
            });
          } else {
            checks.push({
              id: 'payments',
              name: 'Razorpay Payments Gateway',
              category: 'commerce',
              status: 'error',
              latencyMs,
              message: `Auth failed (HTTP ${resp.status})`,
              actionUrl: '/admin/orders',
            });
          }
        } catch (err: any) {
          checks.push({
            id: 'payments',
            name: 'Razorpay Payments Gateway',
            category: 'commerce',
            status: 'error',
            latencyMs: Date.now() - payStart,
            message: 'Could not connect to Razorpay',
            details: err.message,
            actionUrl: '/admin/orders',
          });
        }
      }

      // 4. Resend Transactional Email Delivery
      const resendKey = c.env.RESEND_API_KEY;
      if (!resendKey || resendKey.includes('YOUR_API_KEY')) {
        checks.push({
          id: 'email',
          name: 'License Email Delivery (Resend)',
          category: 'notifications',
          status: 'warning',
          message: 'Resend API key missing',
          actionUrl: '/admin/activity',
        });
      } else {
        const emailStart = Date.now();
        try {
          const resp = await runWithTimeout(async () => {
            return fetchFn('https://api.resend.com/api-keys', {
              headers: { 'Authorization': `Bearer ${resendKey}` },
            });
          });
          const latencyMs = Date.now() - emailStart;
          if (resp.ok) {
            checks.push({
              id: 'email',
              name: 'License Email Delivery (Resend)',
              category: 'notifications',
              status: 'ok',
              latencyMs,
              message: `Operational · ${c.env.EMAIL_FROM || 'support@nor-vi.in'}`,
              actionUrl: '/admin/activity',
            });
          } else {
            checks.push({
              id: 'email',
              name: 'License Email Delivery (Resend)',
              category: 'notifications',
              status: 'error',
              latencyMs,
              message: `Resend auth failed (HTTP ${resp.status})`,
              actionUrl: '/admin/activity',
            });
          }
        } catch (err: any) {
          checks.push({
            id: 'email',
            name: 'License Email Delivery (Resend)',
            category: 'notifications',
            status: 'error',
            latencyMs: Date.now() - emailStart,
            message: 'Could not connect to Resend',
            details: err.message,
            actionUrl: '/admin/activity',
          });
        }
      }

      // 5. Groq STT Voice Engine
      const groqKey = await getActiveAiKey(c.env, 'groq', options.agentAiDeps?.createServiceClient, null);
      if (!groqKey || groqKey.includes('YOUR_')) {
        checks.push({
          id: 'groq_stt',
          name: 'Groq STT Voice Engine',
          category: 'ai',
          status: 'warning',
          message: 'STT fallback key not set',
          actionUrl: '/admin/releases',
        });
      } else {
        const groqStart = Date.now();
        try {
          const resp = await runWithTimeout(async () => {
            return fetchFn('https://api.groq.com/openai/v1/models', {
              headers: { 'Authorization': `Bearer ${groqKey}` },
            });
          });
          const latencyMs = Date.now() - groqStart;
          if (resp.ok) {
            checks.push({
              id: 'groq_stt',
              name: 'Groq STT Voice Engine',
              category: 'ai',
              status: 'ok',
              latencyMs,
              message: 'Operational · whisper-large-v3-turbo',
              actionUrl: '/admin/releases',
            });
          } else {
            checks.push({
              id: 'groq_stt',
              name: 'Groq STT Voice Engine',
              category: 'ai',
              status: 'error',
              latencyMs,
              message: `Groq auth failed (HTTP ${resp.status})`,
              actionUrl: '/admin/releases',
            });
          }
        } catch (err: any) {
          checks.push({
            id: 'groq_stt',
            name: 'Groq STT Voice Engine',
            category: 'ai',
            status: 'error',
            latencyMs: Date.now() - groqStart,
            message: 'Could not connect to Groq',
            details: err.message,
            actionUrl: '/admin/releases',
          });
        }
      }

      // 6. Commercial Agent Catalog
      try {
        const { count, error } = await c.get('db')
          .from('products')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'deleted');
        if (error) throw error;
        checks.push({
          id: 'catalog',
          name: 'Commercial Agent Catalog',
          category: 'agents',
          status: 'ok',
          message: `${count || 0} Agents Live & Deployable`,
          actionUrl: '/admin/products',
        });
      } catch (err: any) {
        checks.push({
          id: 'catalog',
          name: 'Commercial Agent Catalog',
          category: 'agents',
          status: 'error',
          message: 'Failed to query catalog',
          details: err.message,
          actionUrl: '/admin/products',
        });
      }

      const hasErrors = checks.some(c => c.status === 'error');
      const allOk = !hasErrors && checks.every(c => c.status === 'ok');

      return c.json({
        ok: true,
        allOk,
        hasErrors,
        summary: allOk
          ? 'All systems operational'
          : hasErrors
          ? 'Action required on critical services'
          : 'Core systems active (optional integrations unconfigured)',
        timestamp: new Date().toISOString(),
        checks,
      });
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
      let maxUses: number | null = 50;
      if (input.maxUses === null || input.maxUses === '' || input.maxUses === 'unlimited') {
        maxUses = null;
      } else if (input.maxUses !== undefined) {
        const parsed = parseInt(String(input.maxUses), 10);
        maxUses = isNaN(parsed) ? null : parsed;
      }
      const { error } = await c.get('db').rpc('admin_upsert_coupon', { 
        p_id: input.id || null,
        p_code: input.code,
        p_discount: input.discount, 
        p_product_id: input.productId || null,
        p_duration: input.duration || null,
        p_expires_at: input.expiresAt || null,
        p_max_uses: maxUses
      });
      if (!error) {
        await logAdminAudit(c, 'coupon.created', input.code, `Created/Updated coupon code ${input.code} (${input.discount}%)`);
      }
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

    app.delete('/api/admin/products/:id', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
      const { error } = await c.get('db').rpc('admin_delete_product', { p_product_id: c.req.param('id') });
      if (!error) {
        await logAdminAudit(c, 'product.deleted', c.req.param('id'), 'Deleted agent product from catalog');
      }
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
      if (!error) {
        await logAdminAudit(c, 'settings.promotions_updated', 'promotions', 'Updated promotions and sale configurations');
      }
      return error ? c.json({ error: 'Failed to update promotions: ' + error.message }, 400) : c.json({ ok: true });
    });

    app.delete('/api/admin/coupons/:id', async c => {
      if (!['owner', 'administrator'].includes(c.get('user').role)) return c.json({ error: 'Permission denied' }, 403);
      const { error } = await c.get('db').rpc('admin_delete_coupon', { p_id: c.req.param('id') });
      if (!error) {
        await logAdminAudit(c, 'coupon.deleted', c.req.param('id'), 'Deleted discount coupon');
      }
      return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
    });

  app.all('/api/*', c => c.json({ error: 'This operation belongs to a later integration phase. Real purchases, activation, and commerce administration are not enabled.' }, 503));
  return app;
}
