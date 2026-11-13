import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { seed, type Store, type Role, type User } from '../../packages/shared/model';
import { hash, seal, unseal, secret } from './crypto';
export type Repository = { read: () => Promise<Store>; change: <T>(fn: (data: Store) => Promise<T> | T) => Promise<T> };
export const permissions: Record<string, Role[]> = { customers: ['owner', 'administrator', 'support'], licenses: ['owner', 'administrator', 'support'], manageLicenses: ['owner', 'administrator'], devices: ['owner', 'administrator', 'support'], orders: ['owner', 'administrator', 'support'], billing: ['owner', 'administrator'], products: ['owner', 'administrator', 'product_manager'], content: ['owner', 'administrator', 'product_manager'], team: ['owner'], settings: ['owner'], audit: ['owner', 'administrator'] };
export function memoryRepo(): Repository { let data = seed(); let queue = Promise.resolve(); return { read: async () => structuredClone(data), change: fn => { const job = queue.then(async () => { const next = structuredClone(data); const result = await fn(next); data = next; return result; }); queue = job.then(() => { }, () => { }); return job; } }; }
export function createApp(repo: Repository, encryptionKey: string, { preview = false, origin = 'http://127.0.0.1:4321' } = {}) {
    const app = new Hono<{ Variables: { user: User } }>(); const sessions = new Map<string, { userId: string; expires: number }>();
    const audit = (s: Store, user: User, action: string, target: string) => s.audit.unshift({ id: crypto.randomUUID(), actor: user.name, action, target, createdAt: new Date().toISOString() });
    app.use('/api/*', async (c, next) => { c.header('Cache-Control', 'no-store'); c.header('X-Content-Type-Options', 'nosniff'); if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !c.req.path.startsWith('/api/agent/') && c.req.header('origin') !== origin) return c.json({ error: 'Request origin is not allowed.' }, 403); if (Number(c.req.header('content-length') || 0) > 32768) return c.json({ error: 'Request is too large.' }, 413); await next(); });
    app.onError((e, c) => c.json({ error: e instanceof z.ZodError ? e.errors.map(e => e.message).join(' ') : 'The request could not be completed.' }, e instanceof z.ZodError ? 400 : 500));
    app.get('/api/health', c => c.json({ mode: preview ? 'local-preview' : 'unconfigured', livePayments: false }));
    const contactInquiries: Array<{ id: string; name: string; email: string; message: string; status: 'open' | 'resolved'; createdAt: string }> = [
      { id: 'contact-demo-1', name: 'Aarav Patel', email: 'aarav.patel@gmail.com', message: 'Hi Norvi team, does Voro work with external Bluetooth earphones on Windows 11?', status: 'open', createdAt: new Date(Date.now() - 3600_000 * 5).toISOString() },
      { id: 'contact-demo-2', name: 'Neha Sharma', email: 'neha.sharma.tech@outlook.com', message: 'Interested in bulk team licenses for Rolvio. Do you offer agency invoicing?', status: 'resolved', createdAt: new Date(Date.now() - 86400_000 * 2).toISOString() }
    ];

    app.get('/api/catalog', async c => { const s = await repo.read(); return c.json({ products: s.products.filter(p => p.status === 'published' || p.status === 'archived'), settings: s.settings, preview }); });
    app.get('/api/auth/config', c => c.json({ mode: 'preview', preview, registration: false }));
    app.post('/api/contact', async c => {
      const body = await c.req.json().catch(() => ({}));
      const name = String(body.name || 'Visitor').trim();
      const email = String(body.email || 'visitor@example.com').trim();
      const message = String(body.message || '').trim();
      contactInquiries.unshift({ id: crypto.randomUUID(), name, email, message, status: 'open', createdAt: new Date().toISOString() });
      return c.json({ ok: true });
    });
    app.post('/api/preview/session', async c => { if (!preview) return c.json({ error: 'Preview is disabled.' }, 404); const { role } = z.object({ role: z.enum(['owner', 'customer', 'support', 'product_manager']) }).parse(await c.req.json()); const s = await repo.read(); const user = s.users.find(u => u.role === role && u.status === 'active'); if (!user) return c.json({ error: 'Preview account unavailable.' }, 403); const token = secret(); sessions.set(token, { userId: user.id, expires: Date.now() + 3600_000 }); setCookie(c, 'norvi_preview', token, { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 3600 }); await repo.change(s => { s.users.find(u => u.id === user.id)!.lastLogin = new Date().toISOString(); }); return c.json({ user }); });
    app.post('/api/auth/logout', c => { sessions.delete(getCookie(c, 'norvi_preview') || ''); deleteCookie(c, 'norvi_preview', { path: '/' }); return c.json({ ok: true }); });
    app.post('/api/auth/:action', c => c.json({ error: 'Account services are not connected yet. Use the clearly labeled local preview to explore the website; do not enter a real password.' }, 503));
    app.use('/api/*', async (c, next) => { if (!preview) return c.json({ error: 'Live services are not configured.' }, 503); if (c.req.path.startsWith('/api/agent/')) return next(); const session = sessions.get(getCookie(c, 'norvi_preview') || ''); const s = await repo.read(); let user = session && session.expires > Date.now() ? s.users.find(u => u.id === session.userId && u.status === 'active') : undefined; if (!user) return c.json({ error: 'Sign in to continue.' }, 401); if (user.role === 'owner') { const imp = getCookie(c, 'norvi_impersonate'); if (imp) { const target = s.users.find(u => u.id === imp); if (target) user = { ...target, isImpersonated: true } as any; } } c.set('user', user!); await next(); });
    app.get('/api/me', c => c.json({ user: c.get('user'), preview: true }));
    app.get('/api/account', async c => { const s = await repo.read(); const id = c.get('user').id; return c.json({ user: c.get('user'), licenses: s.licenses.filter(l => l.userId === id).map(({ keyHash, encryptedKey, ...l }) => ({ ...l, maxDevices: (l as any).maxDevices || 3, devices: (l as any).devices || ((l as any).device ? [{ id: 'dev-1', installation_id: (l as any).device, active: true, last_seen_at: new Date().toISOString() }] : []) })), orders: s.orders.filter(o => o.userId === id).map(o => ({ ...o, amountMinor: (o as any).amountMinor || (parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, '')) * 100) || 0, currency: (o as any).currency || 'INR', providerPaymentId: (o as any).providerPaymentId || (o.status === 'paid' ? 'pay_' + o.id.slice(0, 14) : null) })), tickets: s.tickets.filter(t => t.userId === id), emails: s.emails.filter(e => e.userId === id), announcements: s.announcements.filter(a => a.audience === 'customer').sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }); });
    app.patch('/api/me', async c => { const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(await c.req.json()); await repo.change(s => { s.users.find(u => u.id === c.get('user').id)!.name = name; }); return c.json({ ok: true }); });
    app.post('/api/preview/purchase', async c => { const s = await repo.read(); if (s.settings.maintenanceMode) return c.json({ error: 'Store is temporarily closed for maintenance. Please check back later.' }, 503); const { productId } = z.object({ productId: z.string() }).parse(await c.req.json()); const user = c.get('user'); const result = await repo.change(async s => { const p = s.products.find(p => p.id === productId && p.status === 'published'); if (!p || p.releaseStatus === 'development') return { error: 'Product is unavailable for purchase while in development.' }; const existing = s.orders.find(o => o.userId === user.id && o.productId === productId && o.status === 'simulated'); if (existing) return { order: existing }; const key = 'NORVI_' + secret(); const id = crypto.randomUUID(); s.licenses.push({ id, userId: user.id, productId, status: 'active', keyHash: await hash(key), encryptedKey: await seal(key, encryptionKey), suffix: key.slice(-6), createdAt: new Date().toISOString(), device: null, expiresAt: null }); const order = { id: crypto.randomUUID(), userId: user.id, productId, status: 'simulated' as const, amount: 'Preview — no charge', createdAt: new Date().toISOString(), licenseId: id }; s.orders.push(order); s.emails.push({ id: crypto.randomUUID(), userId: user.id, orderId: order.id, status: 'Preview only · not sent', createdAt: order.createdAt }); audit(s, user, 'Simulated purchase', p.name); return { order }; }); return c.json(result, 'error' in result ? 400 : 200); });
    app.post('/api/licenses/:id/reveal', async c => { const s = await repo.read(); const user = c.get('user'); const license = s.licenses.find(l => l.id === c.req.param('id') && (l.userId === user.id || user.role === 'owner')); if (!license) return c.json({ error: 'License not found.' }, 404); await repo.change(s => audit(s, user, 'Revealed preview key', license.id)); return c.json({ key: await unseal(license.encryptedKey, encryptionKey) }); });
    app.post('/api/licenses/:id/device-reset', async c => { const result = await repo.change(s => { const user = c.get('user'); const l = s.licenses.find(l => l.id === c.req.param('id')); if (!l || (l.userId !== user.id && !permissions.devices.includes(user.role))) return false; l.device = null; audit(s, user, 'Reset device', l.id); return true; }); return result ? c.json({ ok: true }) : c.json({ error: 'License not found.' }, 404); });
    app.post('/api/licenses/:id/download', async c => { const s = await repo.read(); if (s.settings.maintenanceMode) return c.json({ error: 'Downloads are temporarily disabled for maintenance.' }, 503); return c.json({ error: 'No agent release has been uploaded yet. Add the actual agent files before enabling downloads.' }, 409); });
    app.post('/api/support', async c => { const data = z.object({ subject: z.string().trim().min(3).max(120), message: z.string().trim().min(10).max(3000) }).parse(await c.req.json()); await repo.change(s => s.tickets.unshift({ ...data, id: crypto.randomUUID(), userId: c.get('user').id, status: 'open', createdAt: new Date().toISOString() })); return c.json({ ok: true }); });
    const affiliates: Array<{ userId: string; code: string; status: string; sales: number; totalEarned: number; pendingBalance: number }> = [
      { userId: 'customer-1', code: 'NORVI10', status: 'active', sales: 3, totalEarned: 150000, pendingBalance: 250000 }
    ];
    app.get('/api/partner/stats', async c => {
      const user = c.get('user');
      if (!user) return c.json({ active: false, authenticated: false });
      const aff = affiliates.find(a => a.userId === user.id);
      if (!aff) return c.json({ active: false, authenticated: true });
      return c.json({ active: true, ...aff, authenticated: true });
    });
    app.get('/api/partner/promotional-content', async c => c.json([]));
    app.post('/api/partner/join', async c => {
      const user = c.get('user');
      if (!user) return c.json({ error: 'Sign in to join.' }, 401);
      const { code } = z.object({ code: z.string().trim().toUpperCase() }).parse(await c.req.json());
      const existing = affiliates.find(a => a.userId === user.id);
      if (existing) {
        existing.code = code;
      } else {
        affiliates.push({ userId: user.id, code, status: 'active', sales: 0, totalEarned: 0, pendingBalance: 0 });
      }
      return c.json({ ok: true, code });
    });
    app.post('/api/partner/payout', async c => {
      const user = c.get('user');
      if (!user) return c.json({ error: 'Sign in to request payout.' }, 401);
      return c.json({ ok: true });
    });
    app.use('/api/admin/*', async (c, next) => { if (c.req.path.startsWith('/api/admin/impersonate') && (c.req.method === 'DELETE' || c.req.path.endsWith('/stop'))) return next(); if (c.get('user').role === 'customer') return c.json({ error: 'Staff permission required.' }, 403); await next(); });
    app.get('/api/admin/:section', async c => {
      const section = c.req.param('section'), user = c.get('user');
      const s = await repo.read();
      if (user.role !== 'owner' && !(s.settings.permissions[user.role] || []).includes('/' + section) && section !== 'team' && section !== 'analytics' && section !== 'coupons') return c.json({ error: 'Your role cannot access this section.' }, 403);
      if (section === 'analytics') {
        const now = Date.now();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayIso = todayStart.toISOString();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

        const isCommercial = (o: typeof s.orders[0]) => {
          const val = parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, ''));
          return (o.status === 'paid' || o.status === 'simulated') && val > 0;
        };
        const isTrial = (o: typeof s.orders[0]) => {
          const val = parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, ''));
          return (o.status === 'paid' || o.status === 'simulated') && val === 0;
        };

        const paidOrders = s.orders.filter(isCommercial);
        const trialOrders = s.orders.filter(isTrial);
        const todayOrders = paidOrders.filter(o => o.createdAt >= todayIso);
        const sevenDayOrders = paidOrders.filter(o => o.createdAt >= sevenDaysAgo);
        const thirtyDayOrders = paidOrders.filter(o => o.createdAt >= thirtyDaysAgo);

        const getRev = (ords: typeof paidOrders) => ords.reduce((sum, o) => {
          const parsed = parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, ''));
          return sum + (isNaN(parsed) || parsed === 0 ? 99 : parsed);
        }, 0);

        const leaderboard = s.products.map(p => {
          const pOrders = paidOrders.filter(o => o.productId === p.id);
          const pTrials = trialOrders.filter(o => o.productId === p.id);
          const rev = getRev(pOrders);
          const activeLic = s.licenses.filter(l => l.productId === p.id && l.status === 'active').length;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            status: p.status,
            paidOrders: pOrders.length,
            trialOrders: pTrials.length,
            revenue: rev,
            activeLicenses: activeLic
          };
        }).sort((a, b) => b.revenue - a.revenue);

        return c.json({
          items: s.audit.slice(0, 20),
          metrics: {
            revenue: getRev(thirtyDayOrders),
            revenueToday: getRev(todayOrders),
            salesToday: todayOrders.length,
            revenue7d: getRev(sevenDayOrders),
            sales7d: sevenDayOrders.length,
            revenue30d: getRev(thirtyDayOrders),
            sales30d: thirtyDayOrders.length,
            revenueAllTime: getRev(paidOrders),
            salesAllTime: paidOrders.length,
            trialsAllTime: trialOrders.length,
            activeLicenses: s.licenses.filter(l => l.status === 'active').length,
            recentSales: thirtyDayOrders.length,
            totalCustomers: s.users.filter(u => u.role === 'customer').length
          },
          leaderboard
        });
      }
      if (section === 'coupons') {
        return c.json([
          { id: '00000000-0000-4000-8000-000000000001', code: 'LAUNCH100', discount_percentage: 100, product_id: null, duration_type: null, expires_at: null, max_uses: 50, used_count: 12 },
          { id: '00000000-0000-4000-8000-000000000002', code: 'DEV50', discount_percentage: 50, product_id: null, duration_type: '1_month', expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), max_uses: 100, used_count: 45 }
        ]);
      }
      if (section === 'customers') return c.json({ items: s.users.filter(u => u.role === 'customer').map(u => ({ ...u, purchases: s.orders.filter(o => o.userId === u.id && o.status === 'simulated').length, licenseCount: s.licenses.filter(l => l.userId === u.id).length })) });
      if (section === 'inquiries') {
        const tickets = s.tickets.map(t => {
          const u = s.users.find(user => user.id === t.userId);
          return {
            id: t.id,
            source: 'support_ticket' as const,
            userId: t.userId,
            name: u?.name || 'Registered Customer',
            email: u?.email || 'Unknown',
            subject: t.subject || 'Support Request',
            message: t.message,
            status: t.status || 'open',
            createdAt: t.createdAt,
            activeLicenses: s.licenses.filter(l => l.userId === t.userId && l.status === 'active').length
          };
        });
        const contacts = contactInquiries.map(ci => ({
          id: ci.id,
          source: 'contact_form' as const,
          userId: null,
          name: ci.name,
          email: ci.email,
          subject: 'Website Contact Inquiry',
          message: ci.message,
          status: ci.status,
          createdAt: ci.createdAt,
          activeLicenses: 0
        }));
        return c.json([...tickets, ...contacts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      }
      if (section === 'licenses') return c.json({ items: s.licenses.map(({ keyHash, encryptedKey, ...l }) => ({ ...l, customer: s.users.find(u => u.id === l.userId)?.name, product: s.products.find(p => p.id === l.productId)?.name })) });
      if (section === 'orders' || section === 'billing') return c.json({ items: s.orders.map(o => ({ ...o, customer: s.users.find(u => u.id === o.userId)?.name, product: s.products.find(p => p.id === o.productId)?.name })) });
      if (section === 'products') return c.json({ items: s.products });
      if (section === 'team') return c.json({ items: s.users.filter(u => u.role !== 'customer'), invitations: s.invitations });
      if (section === 'audit') return c.json({ items: s.audit, emails: s.emails });
      if (section === 'settings' || section === 'content') return c.json({ settings: s.settings });
      return c.json({ error: 'Not found' }, 404);
    });
    app.post('/api/admin/coupons', async c => c.json({ ok: true }));
    app.post('/api/admin/inquiries/:id/status', async c => {
      const { source, status } = z.object({
        source: z.enum(['support_ticket', 'contact_form']),
        status: z.enum(['open', 'resolved'])
      }).parse(await c.req.json());
      const id = c.req.param('id');
      if (source === 'support_ticket') {
        await repo.change(s => {
          const t = s.tickets.find(tick => tick.id === id);
          if (t) t.status = status as any;
        });
      } else {
        const ci = contactInquiries.find(item => item.id === id);
        if (ci) ci.status = status;
      }
      return c.json({ ok: true });
    });
    app.delete('/api/admin/inquiries/:id', async c => {
      const id = c.req.param('id');
      let source = c.req.query('source');
      if (!source) {
        try {
          const body = await c.req.json();
          source = body?.source;
        } catch {}
      }
      if (source === 'support_ticket') {
        await repo.change(s => {
          s.tickets = s.tickets.filter(t => t.id !== id);
        });
      } else if (source === 'contact_form') {
        const idx = contactInquiries.findIndex(item => item.id === id);
        if (idx >= 0) contactInquiries.splice(idx, 1);
      } else {
        await repo.change(s => {
          s.tickets = s.tickets.filter(t => t.id !== id);
        });
        const idx = contactInquiries.findIndex(item => item.id === id);
        if (idx >= 0) contactInquiries.splice(idx, 1);
      }
      return c.json({ ok: true });
    });
    app.delete('/api/admin/coupons/:id', async c => c.json({ ok: true }));
    app.post('/api/admin/products', async c => { const user = c.get('user'); if (!permissions.products.includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const input = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(80), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.'), categoryId: z.string().min(1), category: z.object({ id: z.string(), slug: z.string(), name: z.string() }).optional(), subHeading: z.string().optional(), tagline: z.string().min(3).max(140), description: z.string().min(5).max(2000), price: z.string().min(1).max(50), status: z.enum(['draft', 'published', 'archived']), releaseStatus: z.enum(['development', 'prelaunch', 'live']), logoUrl: z.string().nullable(), features: z.array(z.string().max(120)).max(8), requirements: z.string().max(400), version: z.string().max(40), workflowHeading: z.string().max(150), workflowDescription: z.string().max(2000), workflowMediaUrl: z.string().nullable(), workflowNote: z.string().max(500), extendedContent: z.any().optional(), trialActive: z.boolean().optional() }).parse(await c.req.json()); const result = await repo.change(s => { if (s.products.some(p => p.slug === input.slug && p.id !== input.id)) return { error: 'This URL is already used by another agent.' }; const p = { ...input, id: input.id || crypto.randomUUID(), updatedAt: new Date().toISOString() }; const index = s.products.findIndex(x => x.id === p.id); if (index >= 0) s.products[index] = p; else s.products.push(p); audit(s, user, 'Saved product (' + p.status + ')', p.name); return { product: p }; }); return c.json(result, 'error' in result ? 409 : 200); });
    app.post('/api/admin/products/:id/trial', async c => { const user = c.get('user'); if (!permissions.products.includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const { trialActive } = z.object({ trialActive: z.boolean() }).parse(await c.req.json()); const ok = await repo.change(s => { const p = s.products.find(p => p.id === c.req.param('id')); if (!p) return false; p.trialActive = trialActive; return true; }); return ok ? c.json({ ok: true }) : c.json({ error: 'Product not found.' }, 404); });
    app.post('/api/admin/products/:id/status', async c => { const user = c.get('user'); if (!permissions.products.includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const { status } = z.object({ status: z.enum(['draft', 'published', 'archived']) }).parse(await c.req.json()); const ok = await repo.change(s => { const p = s.products.find(p => p.id === c.req.param('id')); if (!p) return false; p.status = status; return true; }); return ok ? c.json({ ok: true }) : c.json({ error: 'Product not found.' }, 404); });
    app.post('/api/admin/licenses/:id/:action', async c => { const user = c.get('user'); if (!permissions.manageLicenses.includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const { reason } = z.object({ reason: z.string().trim().min(5).max(250) }).parse(await c.req.json()); const action = z.enum(['revoke', 'restore', 'rotate']).parse(c.req.param('action')); const result = await repo.change(async s => { const l = s.licenses.find(l => l.id === c.req.param('id')); if (!l) return false; if (action === 'rotate') { const key = 'NORVI_' + secret(); l.keyHash = await hash(key); l.encryptedKey = await seal(key, encryptionKey); l.suffix = key.slice(-6); } else l.status = action === 'revoke' ? 'revoked' : 'active'; l.device = null; audit(s, user, action + ': ' + reason, l.id); return true; }); return result ? c.json({ ok: true }) : c.json({ error: 'License not found.' }, 404); });
    app.patch('/api/admin/settings', async c => { const user = c.get('user'); if (!permissions.settings.includes(user.role)) return c.json({ error: 'Owner permission required.' }, 403); const data = z.object({ name: z.string().trim().min(2).max(60).optional(), headline: z.string().max(150).optional(), description: z.string().max(500).optional(), email: z.string().max(100).optional(), company: z.string().max(100).optional(), domain: z.string().max(150).optional(), maintenanceMode: z.boolean().optional(), bannerText: z.string().optional().nullable(), socialInstagram: z.string().optional().nullable(), socialYoutube: z.string().optional().nullable(), socialFacebook: z.string().optional().nullable(), socialTwitter: z.string().optional().nullable() }).passthrough().parse(await c.req.json()); await repo.change(s => { s.settings = { ...s.settings, ...data, bannerText: data.bannerText || undefined, socialInstagram: data.socialInstagram || undefined, socialYoutube: data.socialYoutube || undefined, socialFacebook: data.socialFacebook || undefined, socialTwitter: data.socialTwitter || undefined, maintenanceMode: data.maintenanceMode || false }; audit(s, user, 'Updated business settings', data.name || 'Settings'); }); return c.json({ ok: true }); });
    app.patch('/api/admin/content', async c => { const user = c.get('user'); if (!permissions.content.includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const data = z.object({ headline: z.string().min(5).max(150), description: z.string().min(5).max(500) }).parse(await c.req.json()); await repo.change(s => { s.settings = { ...s.settings, ...data }; audit(s, user, 'Updated homepage content', 'Homepage'); }); return c.json({ ok: true }); });
    app.post('/api/admin/customers/:id/suspend', async c => { const user = c.get('user'); if (!permissions.customers.includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const { suspended } = z.object({ suspended: z.boolean() }).parse(await c.req.json()); const ok = await repo.change(s => { const member = s.users.find(u => u.id === c.req.param('id')); if (!member || member.role !== 'customer') return false; member.status = suspended ? 'suspended' : 'active'; audit(s, user, suspended ? 'Suspended customer' : 'Restored customer', member.name); return true; }); return ok ? c.json({ ok: true }) : c.json({ error: 'Customer not found.' }, 400); });
    app.post('/api/admin/licenses/gift', async c => { const user = c.get('user'); if (!['owner', 'administrator', 'product_manager'].includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const { email, productSlug } = z.object({ email: z.string().email(), productSlug: z.string() }).parse(await c.req.json()); const result = await repo.change(async s => { const target = s.users.find(u => u.email === email && u.role === 'customer'); if (!target) return { error: 'Account with this email does not exist. They must register first.' }; const p = s.products.find(p => p.slug === productSlug); if (!p) return { error: 'Product not found.' }; const key = 'NORVI_' + secret(); const id = crypto.randomUUID(); s.licenses.push({ id, userId: target.id, productId: p.id, status: 'active', keyHash: await hash(key), encryptedKey: await seal(key, encryptionKey), suffix: key.slice(-6), createdAt: new Date().toISOString(), device: null, expiresAt: null }); const order = { id: crypto.randomUUID(), userId: target.id, productId: p.id, status: 'simulated' as const, amount: 'Manual Gift', createdAt: new Date().toISOString(), licenseId: id }; s.orders.push(order); audit(s, user, 'Gifted license', id + ' to ' + email); return { ok: true, licenseId: id }; }); return c.json(result, 'error' in result ? 400 : 200); });
    app.post('/api/admin/team/invite', async c => { const user = c.get('user'); if (user.role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403); const input = z.object({ email: z.string().email().max(150), role: z.enum(['administrator', 'product_manager', 'support']) }).parse(await c.req.json()); const result = await repo.change(s => { if (s.invitations.some(i => i.email === input.email && i.status === 'pending')) return false; s.invitations.push({ ...input, id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString() }); audit(s, user, 'Staged invitation (not sent)', input.email); return true; }); return result ? c.json({ ok: true }) : c.json({ error: 'An invitation is already pending.' }, 409); });
    app.post('/api/admin/team/:id/suspend', async c => { const user = c.get('user'); if (user.role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403); const ok = await repo.change(s => { const member = s.users.find(u => u.id === c.req.param('id')); if (!member || member.role === 'owner' || member.role === 'customer') return false; member.status = member.status === 'active' ? 'suspended' : 'active'; audit(s, user, 'Changed staff access', member.name); return true; }); return ok ? c.json({ ok: true }) : c.json({ error: 'This membership cannot be changed.' }, 400); });
    app.post('/api/admin/team/:id/role', async c => { const user = c.get('user'); if (user.role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403); const { role } = z.object({ role: z.enum(['administrator', 'product_manager', 'support']) }).parse(await c.req.json()); const ok = await repo.change(s => { const member = s.users.find(u => u.id === c.req.param('id')); if (!member || member.role === 'owner' || member.role === 'customer') return false; member.role = role as any; audit(s, user, 'Changed staff role', member.name + ' to ' + role); return true; }); return ok ? c.json({ ok: true }) : c.json({ error: 'Role could not be changed.' }, 400); });
    app.delete('/api/admin/team/invite/:id', async c => { const user = c.get('user'); if (!['owner', 'administrator'].includes(user.role)) return c.json({ error: 'Permission denied.' }, 403); const ok = await repo.change(s => { const idx = s.invitations.findIndex(i => i.id === c.req.param('id')); if (idx === -1) return false; const email = s.invitations[idx].email; s.invitations.splice(idx, 1); audit(s, user, 'Deleted invitation', email); return true; }); return ok ? c.json({ ok: true }) : c.json({ error: 'Invitation not found.' }, 400); });
    app.get('/api/admin/announcements/:audience', async c => { const s = await repo.read(); return c.json({ items: s.announcements.filter(a => a.audience === c.req.param('audience')).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }); });
    app.post('/api/admin/impersonate', async c => { const user = c.get('user'); if (user.role !== 'owner') return c.json({ error: 'Permission denied.' }, 403); const { id } = await c.req.json(); setCookie(c, 'norvi_impersonate', id, { path: '/' }); return c.json({ ok: true }); });
    app.delete('/api/admin/impersonate', c => { deleteCookie(c, 'norvi_impersonate', { path: '/' }); return c.json({ ok: true }); });
    app.post('/api/admin/impersonate/stop', c => { deleteCookie(c, 'norvi_impersonate', { path: '/' }); return c.json({ ok: true }); });
    app.post('/api/admin/announcements', async c => { const user = c.get('user'); if (user.role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403); const { message, audience } = z.object({ message: z.string().min(1), audience: z.enum(['customer', 'team']) }).parse(await c.req.json()); await repo.change(s => { s.announcements.push({ id: crypto.randomUUID(), authorId: user.id, audience, message, createdAt: new Date().toISOString() }); audit(s, user, 'Created announcement', audience); }); return c.json({ ok: true }); });
    app.patch('/api/admin/permissions', async c => { const user = c.get('user'); if (user.role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403); const data = await c.req.json(); await repo.change(s => { s.settings.permissions = data; audit(s, user, 'Updated dynamic role permissions', 'global'); }); return c.json({ ok: true }); });
    app.delete('/api/admin/announcements/:id', async c => { const user = c.get('user'); if (user.role !== 'owner') return c.json({ error: 'Owner permission required.' }, 403); const ok = await repo.change(s => { const idx = s.announcements.findIndex(a => a.id === c.req.param('id')); if (idx === -1) return false; s.announcements.splice(idx, 1); audit(s, user, 'Deleted announcement', c.req.param('id')); return true; }); return ok ? c.json({ ok: true }) : c.json({ error: 'Announcement not found.' }, 404); });
    app.post('/api/agent/activate', async c => { const data = z.object({ key: z.string().max(100), productId: z.string(), deviceId: z.string().min(3).max(100) }).parse(await c.req.json()); const digest = await hash(data.key); const result = await repo.change(s => { const l = s.licenses.find(l => l.keyHash === digest && l.productId === data.productId && l.status === 'active'); if (!l || (l.expiresAt && Date.parse(l.expiresAt) <= Date.now()) || (l.device && l.device !== data.deviceId)) return null; l.device = data.deviceId; return { licenseId: l.id, productId: l.productId, deviceId: l.device, preview: true, message: 'Preview activation accepted. Production signed leases are not enabled.' }; }); return result ? c.json(result) : c.json({ error: 'Activation could not be authorized.' }, 403); });
    return app;
}
