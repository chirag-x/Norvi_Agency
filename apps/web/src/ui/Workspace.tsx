import { LiveAdmin } from './Accounts';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, ChevronDown, ChevronUp, Bot, ArrowUpRight, BookOpen, Box, Check, Copy, CreditCard, Download, Eye, FileText, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Plus, Search, Settings as SettingsIcon, ShieldCheck, Users, X, Monitor, SlidersHorizontal, Mail, Megaphone, Globe, Sparkles, Video, Image as ImageIcon, HelpCircle, Layers, Trash2, Tag, ExternalLink, Printer, Phone, Clock, Share2, MessageSquare } from 'lucide-react';
import type { Category, Product, Settings, User, AgentExtendedContent, FeaturePillar, MediaGalleryItem, ComparisonRow, AgentFaq, GuideSection, AgentGuide } from '../../../../packages/shared/model';
import { createDefaultAgentAiPolicy, normalizeAgentAiPolicyPayload, type AgentAiPolicy } from '../../../../packages/shared/agentAi';
import { AgentAiPolicySection } from './AgentAiPolicySection';
import { ProductCard, ProductIcon } from './App';
import { api, Badge, date, Empty, Field, Loading, Notice, PageHeading, uploadFile, useData, SmartVideoPlayer, parseYouTubeVideoId } from './common';
import { SupportChatBox } from './SupportChat';
const customerNav = [['', 'Overview', LayoutDashboard], ['/agents', 'My agents', Box], ['/licenses', 'Keys & devices', KeyRound], ['/billing', 'Billing & orders', CreditCard], ['/support', 'Support', LifeBuoy], ['/partner', 'Partner program', Users], ['/settings', 'Profile & security', SettingsIcon]] as const;
const staffNav = [['', 'Overview', LayoutDashboard], ['/products', 'Products & Content', Box], ['/releases', 'Agent Releases', SlidersHorizontal], ['/categories', 'Categories', Box], ['/customers', 'Customers', Users], ['/licenses', 'Licenses', KeyRound], ['/orders', 'Orders', CreditCard], ['/inquiries', 'Inquiries & Support', LifeBuoy], ['/promotions', 'Promotions', Activity], ['/affiliates', 'Partners & Payouts', Users], ['/team', 'Team', Users], ['/announcements', 'Announcements', Mail], ['/content', 'Content', FileText], ['/activity', 'Audit & delivery', Activity], ['/ai-agent', 'AI Support Agent', Bot], ['/marketing', 'Broadcasts', Megaphone], ['/settings', 'Settings', SettingsIcon]] as const;
const allowed: Record<string, string[]> = { owner: ['*'], administrator: ['', '/inquiries', '/marketing', '/products', '/releases', '/categories', '/customers', '/licenses', '/orders', '/promotions', '/announcements', '/content', '/activity', '/affiliates', '/ai-agent'], product_manager: ['', '/marketing', '/products', '/releases', '/categories', '/announcements', '/content'], support: ['', '/inquiries', '/customers', '/licenses', '/orders', '/announcements'] };
function CommandPalette({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(v => !v); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  if (!open) return null;
  const adminLinks = [ { name: 'Go to Products', path: '/admin/products' }, { name: 'Go to Agent Releases', path: '/admin/releases' }, { name: 'Go to Customers', path: '/admin/customers' }, { name: 'Go to Licenses', path: '/admin/licenses' }, { name: 'Go to Orders', path: '/admin/orders' }, { name: 'Go to Inquiries & Support', path: '/admin/inquiries' }, { name: 'Go to Settings', path: '/admin/settings' } ].filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  const customerLinks = [ { name: 'Go to Agents', path: '/account/agents' }, { name: 'Go to Licenses', path: '/account/licenses' }, { name: 'Go to Billing', path: '/account/billing' }, { name: 'Go to Support', path: '/account/support' }, { name: 'Go to Settings', path: '/account/settings' } ].filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  const links = user.role === 'customer' ? customerLinks : adminLinks;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', paddingTop: '10vh' }} onClick={() => setOpen(false)}>
      <div style={{ background: 'var(--surface)', width: '100%', maxWidth: 500, borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <input autoFocus placeholder="Search… (Cmd+K)" value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%', padding: '16px 20px', fontSize: 18, border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', outline: 'none' }} />
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {links.length ? links.map(l => (
            <a key={l.path} href={l.path} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)', textDecoration: 'none' }}>
              <ArrowRight size={16} /> {l.name}
            </a>
          )) : <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>No results found</div>}
        </div>
      </div>
    </div>
  );
}

export function Workspace({ path, products, settings, onCatalogChange }: { path: string; products: Product[]; settings: Settings; onCatalogChange: () => void }) {
    const admin = path.startsWith('/admin'), base = admin ? '/admin' : '/account'; const section = path.slice(base.length); const { data: identity, error } = useData('/me'); const [logoutError, setLogoutError] = useState('');
    if (error) return <div className="container page"><Empty title={admin ? 'Your workspace awaits.' : 'Your agents live here.'} description={error} href={admin ? '/admin/login' : '/login'} label={admin ? 'Open admin sign in' : 'Open customer sign in'} /></div>;
    if (!identity) return <Loading />; if(identity.mfaRequired) return <div className="container page"><Notice>Complete authenticator verification to access your account.</Notice><a className="button primary" href="/account/security">Open account security</a></div>; const user: User = identity.user; if (admin && user.role === 'customer') return <div className="container page"><Notice kind="error">This account has no staff permissions.</Notice><a href="/account" className="button secondary">Return to my account</a></div>;
    const pMap = settings?.permissions || allowed;
    const canAccessSlug = (slug: string) => user.role === 'owner' || pMap[user.role]?.includes('*') || pMap[user.role]?.includes(slug) || (slug === '/releases' && pMap[user.role]?.includes('/products'));
    const nav = admin ? staffNav.filter(([slug]) => canAccessSlug(slug)) : customerNav;
      console.log('ACTIVE NAV:', nav);
    const sectionAllowed = !admin || canAccessSlug(section);
    return <div className="workspace"><CommandPalette user={user} /><aside className="sidebar"><div className="workspace-label">{admin ? 'AGENCY WORKSPACE' : 'PERSONAL WORKSPACE'}</div><nav aria-label="Workspace navigation">{nav.map(([slug, label, Icon]) => <a key={slug} href={base + slug} className={section === slug ? 'selected' : ''}><Icon size={18} />{label}{section === slug && <span className="nav-indicator" />}</a>)}</nav><div className="sidebar-bottom"><div className="preview-box"><ShieldCheck size={18} /><b>{identity.preview ? 'Local preview' : 'NORVI account'}</b><p>{identity.preview ? 'Sample data. No live payments or emails.' : 'Verified account. Active customer workspace.'}</p></div><a href="/" className="text-button">Back to website <ArrowUpRight size={15} /></a><button className="logout" onClick={async () => { try { await api('/auth/logout', { method: 'POST' }); location.href = admin ? '/admin/login' : '/login'; } catch (e: any) { setLogoutError(e.message); } }}><LogOut size={16} />{identity.preview ? 'Sign out of preview' : 'Sign out'}</button>{logoutError && <Notice kind="error">{logoutError}</Notice>}</div></aside><div className="workspace-main">
        {(user as any).isImpersonated && <div style={{ background: '#eab308', color: '#1a1a1a', padding: '12px 24px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', borderBottom: '2px solid #ca8a04', zIndex: 100 }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} /><span>You are currently impersonating <b>{user.name}</b> {user.email ? `(${user.email})` : ''} · Role: <b>{user.role}</b></span></div><button type="button" className="button primary small" style={{ background: '#1c2418', color: '#fff', borderColor: '#1c2418', cursor: 'pointer' }} onClick={async () => { try { await api('/admin/impersonate', { method: 'DELETE' }); } catch { try { await api('/admin/impersonate/stop', { method: 'POST' }); } catch {} } document.cookie = 'norvi_impersonate=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;'; window.location.href = '/admin/customers'; }}>Stop Impersonating</button></div>}
        <div className="workspace-topbar"><span>NORVI <span className="slash">/</span> {admin ? 'Agency workspace' : 'My account'}</span><div style={{display: 'flex', alignItems: 'center', gap: 15}}><a href="/" className="text-button" style={{fontSize: 13}}>Back to website <ArrowUpRight size={14} /></a><span className="user-chip"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>{user.name}<Badge>{user.role.replace('_', ' ')}</Badge></span></div></div>{!sectionAllowed ? <Notice kind="error">Your role cannot open this section.</Notice> : admin ? <Admin section={section} user={user} settings={settings} onCatalogChange={onCatalogChange} /> : <Customer section={section} products={products} user={user} />}</div></div>;
}
export function CustomerInvoiceModal({ order, user, onClose }: { order: any; user: User; onClose: () => void }) {
  const isPaid = order.status === 'paid';
  return (
    <Modal title="Official Purchase Receipt" onClose={onClose} wide>
      <div style={{ background: '#12180f', border: '1px solid var(--border)', borderRadius: 10, padding: 24, color: 'var(--text)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, color: 'var(--lime)' }}>NORVI AI AGENCY</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5 }}>
              Kunj Vihar, Gole ka mandir<br />
              Gwalior, Madhya Pradesh, India 474005<br />
              Support: norviagency@gmail.com · +91-9893534314
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge good" style={{ fontSize: 12, padding: '4px 10px', textTransform: 'uppercase' }}>
              {isPaid ? 'Paid & Verified' : order.status}
            </span>
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 8 }}>
              <b>Invoice Date:</b> {date(order.createdAt)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
              <b>Order Ref:</b> #{order.id.slice(0, 8)}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, background: 'var(--surface)', padding: 14, borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Billed To</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{user.email}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Gateway Reference</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2, fontFamily: 'monospace' }}>
              {order.providerPaymentId || 'Verified Checkout'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)' }}>Payment processed securely via Razorpay</div>
          </div>
        </div>

        <div className="table-wrap" style={{ margin: '0 0 20px', background: 'transparent' }}>
          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Total (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>{order.product || 'AI Agent Software License'}</b>
                  <small className="block" style={{ color: 'var(--text-light)' }}>Single Customer License · Digital Instant Delivery</small>
                </td>
                <td>Software License</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--lime)' }}>{order.amount || '₹0.00'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
            Digital software delivery complete. License key authorized in your NORVI account.
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 13, color: 'var(--text-light)', marginRight: 12 }}>Total Paid:</span>
            <b style={{ fontSize: 20, color: 'var(--lime)' }}>{order.amount}</b>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <button type="button" className="button secondary" onClick={() => window.print()}>
          <Printer size={15} style={{ marginRight: 6 }} /> Print / Save as PDF
        </button>
        <button type="button" className="button primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

export function DeviceReleaseModal({
  device,
  onClose,
  onConfirm
}: {
  device: { licenseId: string; deviceId: string; installationId: string };
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Disconnect Computer" onClose={onClose}>
      <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>
        Are you sure you want to disconnect this computer from your license?
      </p>
      <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>Device Identifier</div>
        <code style={{ fontSize: 13, color: 'var(--lime)', wordBreak: 'break-all' }}>{device.installationId}</code>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5, margin: '0 0 20px' }}>
        ⚠️ Disconnecting this computer deactivates the agent on this machine and immediately frees up your device allowance so you can connect a new PC or laptop.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button
          type="button"
          className="button primary"
          style={{ background: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
            onClose();
          }}
        >
          {busy ? 'Disconnecting...' : 'Disconnect Computer'}
        </button>
      </div>
    </Modal>
  );
}

export function CustomerTicketModal({ ticket, onClose }: { ticket: any; onClose: () => void }) {
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  return (
    <Modal title={ticket.subject} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
          Submitted on <b>{date(ticket.createdAt)}</b>
        </div>
        <Badge kind={isResolved ? 'good' : ''}>{ticket.status || 'open'}</Badge>
      </div>

      <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 6 }}>Your Inquiry</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.message}</p>
      </div>

      <div style={{ background: '#141d11', border: '1px solid #36492b', padding: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--lime)', textTransform: 'uppercase', marginBottom: 6 }}>
          <ShieldCheck size={14} /> Official Support Resolution & Notes
        </div>
        {ticket.admin_notes || ticket.reply ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.admin_notes || ticket.reply}</p>
        ) : isResolved ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>This support ticket has been reviewed and marked as resolved by our technical team. If you need further assistance, please open a new request.</p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>Our technical support team is currently reviewing your ticket. Typical response time is 2–4 hours during operating hours (Mon–Sat, 10am–6pm IST). Updates will also be sent to your email.</p>
        )}
      </div>

      <div style={{ marginTop: 20, textAlign: 'right' }}>
        <button type="button" className="button primary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function Customer({ section, products, user }: { section: string; products: Product[]; user: User }) {
  const { data, error, reload } = useData('/account');
  const [feedback, setFeedback] = useState('');
  const [keyModal, setKeyModal] = useState<{ key: string; name: string } | null>(null);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [guideModal, setGuideModal] = useState<{ product: Product; license?: any } | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<any | null>(null);
  const [deviceToRelease, setDeviceToRelease] = useState<{ licenseId: string; deviceId: string; installationId: string } | null>(null);
  const [viewingTicket, setViewingTicket] = useState<any | null>(null);

  useEffect(() => {
    const latest = data?.announcements?.[0];
    if (latest && localStorage.getItem('dismissed_announcement') !== latest.id) setAnnouncement(latest);
  }, [data]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <Loading />;

  const licenses = data.licenses as any[], orders = data.orders as any[];
  const owned = products.filter(p => licenses.some(l => l.productId === p.id));
  const product = (id: string) => products.find(p => p.id === id);

  async function action(path: string) {
    try {
      const result = await api(path, { method: 'POST' });
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      reload();
      return result;
    } catch (e: any) {
      setFeedback(e.message);
    }
  }

  async function copyLicenseKey(licenseId: string, agentName: string) {
    try {
      const result = await action('/licenses/' + licenseId + '/reveal');
      if (result?.key) {
        await navigator.clipboard.writeText(result.key);
        setFeedback(`Copied activation key for ${agentName} to clipboard!`);
      }
    } catch (err: any) {
      setFeedback(err.message || 'Could not copy key');
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="YOUR PERSONAL WORKSPACE"
        title={
          section === '' ? 'A little more possibility.' :
          section === '/agents' ? 'Your agent collection.' :
          section === '/licenses' ? 'Your keys. Your access.' :
          section === '/billing' ? 'Everything accounted for.' :
          section === '/settings' ? 'Make yourself at home.' :
          'How can we help?'
        }
        description={
          section === '' ? 'Welcome back, ' + user.name + '. Find everything you need for your next workflow.' :
          section === '/licenses' ? 'Your product-specific keys, access status, and active devices.' :
          undefined
        }
      />
      {feedback && <Notice>{feedback}</Notice>}

      {section === '' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 20px', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>{user.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 16 }}>{user.name}</b>
                  <Badge kind="good">Verified Customer</Badge>
                </div>
                <small style={{ color: 'var(--text-light)', fontSize: 12 }}>{user.email}</small>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-light)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={14} className="accent" /> Email Verified</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={14} /> Member since {user.createdAt ? date(user.createdAt) : 'Recently'}</span>
            </div>
          </div>

          <div className="stat-grid">
            <Stat label="Your agents" value={licenses.length} icon={<Box />} hint="In your collection" />
            <Stat label="Active licenses" value={licenses.filter(l => l.status === 'active').length} icon={<KeyRound />} hint="Authorized machines" />
            <Stat label="Your orders" value={orders.length} icon={<CreditCard />} hint="Purchase receipts" />
          </div>

          {owned.length > 0 && (() => {
            const primaryLicense = licenses[0];
            const p = product(primaryLicense?.productId);
            const activeDevCount = primaryLicense?.devices?.length || 0;
            const maxDev = primaryLicense?.maxDevices || 3;
            const hasConnectedDevice = activeDevCount > 0;
            return (
              <div className="workspace-welcome" style={{ marginBottom: 30 }}>
                <div>
                  <span className="eyebrow" style={{ color: 'var(--lime)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} /> QUICK SETUP HUB
                  </span>
                  <h2 style={{ margin: '10px 0 12px', fontSize: 28 }}>{p?.name || 'Your Agent'} is ready.</h2>
                  <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-light)', lineHeight: 1.6 }}>
                    Follow these 3 simple steps to start automating your workflows on your desktop machine.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="button primary small" onClick={() => action('/licenses/' + primaryLicense.id + '/download')}>
                      <Download size={14} style={{ marginRight: 5 }} /> Download Installer
                    </button>
                    <a href="/account/licenses" className="button secondary small">
                      <KeyRound size={14} style={{ marginRight: 5 }} /> Keys & Devices
                    </a>
                  </div>
                </div>

                <div className="setup-list">
                  <div>
                    <div className="check-circle done"><Check size={14} /></div>
                    <div>
                      <b>Step 1: Download & Install</b>
                      <small>Native installer for Windows 10/11 or macOS 12+</small>
                    </div>
                  </div>
                  <div>
                    <div className="check-circle done"><Check size={14} /></div>
                    <div style={{ flex: 1 }}>
                      <b>Step 2: Copy Activation Key</b>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <code style={{ fontSize: 12, color: 'var(--lime)' }}>NORVI-••••-••••-{primaryLicense?.suffix}</code>
                        <button
                          type="button"
                          className="button secondary small"
                          style={{ padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => copyLicenseKey(primaryLicense.id, p?.name || 'Agent')}
                        >
                          <Copy size={11} /> Copy Key
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className={`check-circle ${hasConnectedDevice ? 'done' : ''}`}>
                      {hasConnectedDevice ? <Check size={14} /> : <span style={{ fontSize: 11, fontWeight: 700 }}>3</span>}
                    </div>
                    <div>
                      <b>Step 3: Connect Machine ({activeDevCount}/{maxDev} devices)</b>
                      <small>{hasConnectedDevice ? 'Machine linked and authorized for daily operation' : 'Launch the app and enter your key to link this computer'}</small>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="panel-heading">
            <h3>Ready for your next workflow</h3>
            <a href="/agents" className="text-button">Explore agents <ArrowUpRight size={16} /></a>
          </div>

          {!owned.length ? (
            <Empty title="Your collection starts here." description="Explore our collection of AI agents and activate your first workflow." href="/agents" label="Explore agents" />
          ) : (
            <div className="product-grid">{owned.map(p => <ProductCard key={p.id} product={p} />)}</div>
          )}

          <div className="two-column">
            <div className="panel">
              <KeyRound className="accent" />
              <h3>One key. One product.</h3>
              <p>Keep your activation keys private. Your account is always the place to find them.</p>
              <a href="/account/licenses" className="text-button">Manage your keys <ArrowRight size={16} /></a>
            </div>
            <div className="panel">
              <LifeBuoy className="accent" />
              <h3>A little help, when you need it.</h3>
              <p>Find the steps for installation, activation, and managing your device.</p>
              <a href="/help" className="text-button">Visit the help center <ArrowRight size={16} /></a>
            </div>
          </div>
        </>
      )}

      {section === '/agents' && (!licenses.length ? (
        <Empty title="No agents in your collection yet." description="Your purchased products and downloads will appear here." href="/agents" label="Explore agents" />
      ) : (
        <div className="owned-grid">
          {licenses.map(l => {
            const p = product(l.productId);
            return (
              <div className="panel owned-card" key={l.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    {p && <ProductIcon product={p} size={48} />}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{p?.name || 'Archived agent'}</h3>
                        {p?.version && <span className="badge" style={{ fontSize: 10 }}>{p.version}</span>}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-light)' }}>
                        {p?.tagline || `Added ${date(l.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <Badge kind={l.status === 'active' ? 'good' : ''}>{l.status}</Badge>
                    <span style={{ fontSize: 11, fontWeight: 600, color: l.expiresAt ? 'var(--text-light)' : 'var(--lime)' }}>
                      {l.expiresAt ? `Valid until ${date(l.expiresAt)}` : 'Lifetime Access'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KeyRound size={14} className="accent" />
                    <code style={{ fontSize: 12, color: 'var(--lime)' }}>NORVI-••••-••••-{l.suffix}</code>
                  </div>
                  <button
                    type="button"
                    className="button secondary small"
                    style={{ padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => copyLicenseKey(l.id, p?.name || 'Agent')}
                  >
                    <Copy size={11} /> Copy Key
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-light)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <span><Monitor size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {p?.requirements || 'Windows 10/11 (64-bit)'}</span>
                  <span>{l.devices?.length || 0} of {l.maxDevices || 3} computers connected</span>
                </div>

                <div className="owned-actions" style={{ display: 'flex', gap: 10, borderTop: 'none', paddingTop: 0 }}>
                  <a className="button secondary small" href="/account/licenses" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <KeyRound size={14} /> Keys & Devices
                  </a>
                  <button className="button secondary small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => { if (p) setGuideModal({ product: p, license: l }); }}>
                    <BookOpen size={14} /> Setup Guide
                  </button>
                  <button className="button primary small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }} onClick={() => action('/licenses/' + l.id + '/download')}>
                    <Download size={14} /> Download Installer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {section === '/licenses' && (!licenses.length ? (
        <Empty title="No activation keys yet." description="Your product-specific keys will appear here immediately after purchasing an agent or starting a trial." href="/agents" label="Explore agents" />
      ) : (
        <div className="license-list">
          {licenses.map(l => {
            const p = product(l.productId);
            const activeCount = l.devices?.length || 0;
            const maxCount = l.maxDevices || 3;
            return (
              <div className="panel" key={l.id}>
                <div className="panel-heading">
                  <div>
                    <h3 style={{ margin: 0 }}>{p?.name || 'Archived agent'}</h3>
                    <small style={{ color: 'var(--text-light)', fontSize: 12 }}>Issued {date(l.createdAt)}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge kind={l.status === 'active' ? 'good' : ''}>{l.status}</Badge>
                    <span className="badge good" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <Monitor size={12} /> {activeCount} / {maxCount} Slots Active
                    </span>
                  </div>
                </div>

                <div className="key-line">
                  <code>NORVI-XXXX-XXXX-XXXX-{l.suffix}</code>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="button primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      onClick={() => copyLicenseKey(l.id, p?.name || 'Agent')}
                    >
                      <Copy size={15} /> Copy Key
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      onClick={async () => {
                        const result = await action('/licenses/' + l.id + '/reveal');
                        if (result) setKeyModal({ key: result.key, name: p?.name || 'Agent' });
                      }}
                    >
                      <Eye size={15} /> Reveal key
                    </button>
                  </div>
                </div>

                <div className="license-meta" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Issued Date</div>
                      <div style={{ fontWeight: 500 }}>{date(l.createdAt)}</div>
                    </div>

                    <div style={{ flex: 1, textAlign: 'center' }}>
                      {l.expiresAt ? (
                        <>
                          <div style={{ fontSize: '12px', color: new Date(l.expiresAt).getTime() < Date.now() + 1000 * 60 * 60 * 24 * 7 ? 'var(--error)' : 'var(--text-light)', marginBottom: '4px' }}>Expires</div>
                          <div style={{ fontWeight: 500, color: new Date(l.expiresAt).getTime() < Date.now() + 1000 * 60 * 60 * 24 * 7 ? 'var(--error)' : 'inherit' }}>{date(l.expiresAt)}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>Access Level</div>
                          <div style={{ fontWeight: 600, color: 'var(--accent)' }}>Lifetime Access</div>
                        </>
                      )}
                    </div>

                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      {l.expiresAt && Number(p?.price1m || 0) > 0 && (
                        <a href={`/checkout/${p?.slug}?renew=${l.id}`} className="button primary small">Renew License</a>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-light)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Authorized Machines</span>
                      <span>{activeCount} of {maxCount} computers connected</span>
                    </div>
                    {l.devices && l.devices.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {l.devices.map((d: any) => (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lime)', display: 'inline-block' }} title="Authorized" />
                              <div>
                                <b style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Monitor size={14} /> Linked Computer</b>
                                <code style={{ fontSize: 11, color: 'var(--text-light)' }}>{d.installation_id}</code>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <small style={{ color: 'var(--text-light)', fontSize: 11 }}>
                                {d.last_seen_at ? `Active ${date(d.last_seen_at)}` : 'Authorized'}
                              </small>
                              <button
                                type="button"
                                className="text-button bare"
                                style={{ color: 'var(--red, #ef4444)', fontSize: 12 }}
                                onClick={() => setDeviceToRelease({ licenseId: l.id, deviceId: d.id, installationId: d.installation_id })}
                              >
                                Release slot <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 6, color: 'var(--text-light)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Monitor size={15} /> No machines connected yet. Launch your desktop agent and enter your key to link your first computer.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {section === '/billing' && (
        <>
          <OrderTable
            items={orders.map(o => ({ ...o, product: product(o.productId)?.name }))}
            onViewInvoice={order => setInvoiceOrder(order)}
            onCopied={msg => setFeedback(msg)}
          />
          <div className="panel">
            <h3>Subscriptions & Renewals</h3>
            <p>Active license plans and renewal controls are managed directly under your license cards in Keys & devices.</p>
          </div>
        </>
      )}

      {section === '/partner' && <PartnerProgram />}

      {section === '/settings' && (
        <div className="two-column">
          <ProfileForm user={user} />
          <div className="panel">
            <ShieldCheck className="accent" />
            <h3>Account security</h3>
            <p>Manage your authenticator and account access.</p>
            <a className="button secondary" href="/account/security">Account security</a>
          </div>
          <AccountDeletion />
        </div>
      )}

      {section === '/support' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SupportChatBox
            context="account"
            title="NORVI AI Troubleshooting Assistant"
            subtitle="Get instant troubleshooting for activation errors, hardware computer unlinking, 1-day offline mode, or agent configuration. If your issue requires manual engineering review, submit an official support ticket below."
            quickQuestions={[
              "How do I disconnect a computer from my license?",
              "How does 1-day offline mode work?",
              "Where can I find and copy my activation key?",
              "What should I do if an agent fails to activate?"
            ]}
            onEscalateToTicket={() => {
              const form = document.getElementById('support-ticket-form');
              if (form) form.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          <div className="two-column">
            <SupportForm user={user} onSave={reload} />
            <div>
              <div className="panel" style={{ marginBottom: 20 }}>
                <h3>Your requests</h3>
                {!data.tickets.length ? (
                  <p style={{ color: 'var(--text-light)', fontSize: 13 }}>No requests yet.</p>
                ) : (
                  data.tickets.map((t: any) => (
                    <div
                      className="list-row"
                      key={t.id}
                      style={{ cursor: 'pointer', padding: '12px 10px', borderRadius: 6, transition: 'background 0.15s ease' }}
                      onClick={() => setViewingTicket(t)}
                      title="Click to view full ticket details and response"
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                          <MessageSquare size={14} className="accent" /> {t.subject}
                        </b>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-light)' }}>{date(t.createdAt)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge kind={t.status === 'resolved' || t.status === 'closed' ? 'good' : ''}>{t.status || 'open'}</Badge>
                        <ArrowRight size={14} style={{ color: 'var(--text-light)' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="panel">
                <ShieldCheck className="accent" size={24} />
                <h3 style={{ margin: '8px 0 10px' }}>Priority Support Channels</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-light)' }}>
                  Need direct assistance with installation or activation? Reach out through our dedicated channels:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: '10px 14px', borderRadius: 6 }}>
                    <Mail size={16} className="accent" />
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'block' }}>Email Support</span>
                      <b>norviagency@gmail.com</b>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: '10px 14px', borderRadius: 6 }}>
                    <Phone size={16} className="accent" />
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'block' }}>Direct Phone / WhatsApp</span>
                      <b>+91-9893534314</b>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: '10px 14px', borderRadius: 6 }}>
                    <Clock size={16} className="accent" />
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-light)', display: 'block' }}>Operating Hours</span>
                      <b>Mon–Sat, 10:00 AM – 8:00 PM IST</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {keyModal && (
        <Modal title={keyModal.name + ' activation key'} onClose={() => setKeyModal(null)}>
          <Notice>Keep your activation key confidential. Enter it into your desktop agent to unlock your license.</Notice>
          <code className="full-key">{keyModal.key}</code>
          <CopyButton text={keyModal.key} />
        </Modal>
      )}

      {invoiceOrder && (
        <CustomerInvoiceModal order={invoiceOrder} user={user} onClose={() => setInvoiceOrder(null)} />
      )}

      {deviceToRelease && (
        <DeviceReleaseModal
          device={deviceToRelease}
          onClose={() => setDeviceToRelease(null)}
          onConfirm={async () => {
            await action(`/licenses/${deviceToRelease.licenseId}/device-reset?deviceId=${deviceToRelease.deviceId}`);
            setFeedback('Hardware slot released successfully.');
          }}
        />
      )}

      {viewingTicket && (
        <CustomerTicketModal ticket={viewingTicket} onClose={() => setViewingTicket(null)} />
      )}

      {announcement && (
        <Modal title="Important Announcement" onClose={() => { localStorage.setItem('dismissed_announcement', announcement.id); setAnnouncement(null); }}>
          <div style={{ padding: '20px 0', fontSize: '16px', lineHeight: 1.6 }}>{announcement.message}</div>
          <button className="button primary" style={{ width: '100%', marginTop: '20px' }} onClick={() => { localStorage.setItem('dismissed_announcement', announcement.id); setAnnouncement(null); }}>I understand</button>
        </Modal>
      )}

      {guideModal && (
        <AgentGuideModal product={guideModal.product} license={guideModal.license} onClose={() => setGuideModal(null)} onDownload={() => guideModal.license && action('/licenses/' + guideModal.license.id + '/download')} />
      )}
    </>
  );
}
function AgentGuideModal({
  product,
  license,
  onClose,
  onDownload
}: {
  product: Product;
  license?: any;
  onClose: () => void;
  onDownload?: () => void;
}) {
  const guide = product.extendedContent?.guide;
  const sections = guide?.sections || [];
  const [activeImage, setActiveImage] = useState<string | null>(null);

  return (
    <Modal title={`${product.name} — Setup & User Guide`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxHeight: 'calc(80vh - 70px)', overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* Top Summary & Quick Key Access */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <ProductIcon product={product} size={40} />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{product.name}</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-light)' }}>
                {product.tagline || 'Step-by-step setup and walkthrough'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {license && (
              <a href="/account/licenses" className="button secondary small" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={14} /> License Key: NORVI-••••-{license.suffix}
              </a>
            )}
            {onDownload && (
              <button className="button primary small" onClick={onDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /> Download Agent
              </button>
            )}
          </div>
        </div>

        {/* Video Tutorial Section */}
        {guide?.videoUrl ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span className="badge good" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Walkthrough Video</span>
              <h4 style={{ margin: 0 }}>Full Video Tutorial</h4>
            </div>
            <SmartVideoPlayer url={guide.videoUrl} title={`${product.name} Video Guide`} />
          </div>
        ) : null}

        {/* Step-by-Step Sections */}
        <div>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Step-by-Step Instructions</h4>
          {!sections.length ? (
            <div className="panel" style={{ textAlign: 'center', padding: '32px 20px', background: 'var(--surface)' }}>
              <BookOpen size={32} style={{ color: 'var(--text-light)', marginBottom: '8px' }} />
              <h4 style={{ margin: '0 0 6px 0' }}>Documentation in Progress</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>
                A step-by-step written guide for {product.name} is being prepared. If you need assistance right away, please contact our support team.
              </p>
              <a href="/account/support" className="button secondary small" style={{ marginTop: '16px', display: 'inline-block' }}>
                Contact Support
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sections.map((sec, idx) => (
                <div
                  key={sec.id || idx}
                  className="panel"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '18px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: 'var(--black)',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      {idx + 1}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '15px' }}>{sec.heading}</h4>
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-line', color: 'var(--text)' }}>
                    {sec.content}
                  </p>
                  {sec.imageUrl && (
                    <div style={{ marginTop: '12px' }}>
                      <img
                        src={sec.imageUrl}
                        alt={sec.heading}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '360px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          display: 'block'
                        }}
                        onClick={() => setActiveImage(sec.imageUrl!)}
                        title="Click to view full size"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox Modal for Screenshots */}
        {activeImage && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
            onClick={() => setActiveImage(null)}
          >
            <img
              src={activeImage}
              alt="Zoomed view"
              style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
        )}

        {/* Bottom Help Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'var(--background)', padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Having trouble with {product.name}?</span>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-light)' }}>Our team is ready to help you get up and running.</p>
          </div>
          <a href="/account/support" className="text-button" style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Open Support Ticket <ArrowRight size={14} />
          </a>
        </div>

      </div>
    </Modal>
  );
}
function Stat({ label, value, icon, hint }: { label: string; value: string | number; icon: ReactNode; hint?: string }) { return <div className="stat"><div><span>{label}</span>{icon}</div><b>{value}</b>{hint ? <small>{hint}</small> : null}</div>; }
function ProfileForm({ user }: { user: User }) { const [name, setName] = useState(user.name), [message, setMessage] = useState(''); return <form className="panel" onSubmit={async e => { e.preventDefault(); try { await api('/me', { method: 'PATCH', body: JSON.stringify({ name }) }); setMessage('Profile saved.'); } catch (e: any) { setMessage(e.message); } }}><h3>Your profile</h3><Field label="Display name"><input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Email address" hint="Email address is tied to your account security. Contact support to request an email update."><input value={user.email} disabled /></Field><button className="button primary">Save profile <Check size={16} /></button>{message && <Notice>{message}</Notice>}</form>; }
function SupportForm({ user, onSave }: { user?: User; onSave: () => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  return (
    <form
      id="support-ticket-form"
      className="panel"
      name="support"
      method="POST"
      data-netlify="true"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = new FormData(form);
        const subject = String(d.get('subject') || '').trim();
        const msg = String(d.get('message') || '').trim();
        setBusy(true);
        setMessage('');

        try {
          // 1. Submit to API (Supabase ticket creation + Discord notification to # │ norvi-support)
          await api('/support', {
            method: 'POST',
            body: JSON.stringify({ subject, message: msg }),
          });

          // 2. Submit to Netlify Forms for Netlify tracking & logging
          try {
            await fetch('/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams(new FormData(form) as any).toString(),
            });
          } catch (netErr) {
            console.warn('Netlify support form warning:', netErr);
          }

          setIsSuccess(true);
          setMessage('Your support request has been submitted. Our team will review it shortly.');
          form.reset();
          onSave();
        } catch (e: any) {
          setIsSuccess(false);
          setMessage(e.message || 'Could not submit support request. Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <input type="hidden" name="form-name" value="support" />
      <input type="hidden" name="name" value={user?.name || 'Customer'} />
      <input type="hidden" name="email" value={user?.email || ''} />
      <h3>Start a conversation</h3>
      <p>Need help with your agent, activation key, or subscription? Reach our team directly.</p>
      <Field label="Subject">
        <input name="subject" required minLength={3} maxLength={120} placeholder="What can we help with?" disabled={busy} />
      </Field>
      <Field label="Message">
        <textarea name="message" required minLength={5} maxLength={3000} rows={5} placeholder="Tell us a little more…" disabled={busy} />
      </Field>
      <button className="button primary" disabled={busy}>
        {busy ? 'Submitting...' : 'Send support request'} <ArrowRight size={16} />
      </button>
      {message && <Notice kind={isSuccess ? 'success' : 'error'}>{message}</Notice>}
    </form>
  );
}
export function OrderTable({ items, onViewInvoice, onCopied }: { items: any[]; onViewInvoice?: (order: any) => void; onCopied?: (msg: string) => void }) {
  if (!items.length) {
    return <Empty title="No orders just yet." description="Your purchase history will appear here after checkout." href="/agents" label="Explore agents" />;
  }
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    if (onCopied) onCopied(`Copied ${label}: ${text}`);
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order Ref</th>
            <th>Agent</th>
            <th>Payment ID</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            {onViewInvoice && <th>Receipt</th>}
          </tr>
        </thead>
        <tbody>
          {items.map(o => (
            <tr key={o.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <code>#{o.id.slice(0, 8)}</code>
                  <button
                    type="button"
                    title="Copy Order ID"
                    aria-label="Copy Order ID"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lime, #98e038)' }}
                    onClick={() => copy(o.id, 'Order ID')}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </td>
              <td>
                <b>{o.product || o.productId}</b>
                <small className="block" style={{ color: 'var(--text-light)' }}>
                  {o.amountMinor === 0 || String(o.amount || '').includes('₹0') ? 'Promotional Trial' : 'Commercial License'}
                </small>
              </td>
              <td>
                <code style={{ fontSize: 11, color: 'var(--text-light)' }}>
                  {o.providerPaymentId ? (o.providerPaymentId.startsWith('pay_') ? o.providerPaymentId.slice(0, 14) + '...' : o.providerPaymentId) : 'Verified Razorpay'}
                </code>
              </td>
              <td>{date(o.createdAt)}</td>
              <td>
                <b style={{ color: Number(o.amountMinor || 0) > 0 ? 'var(--lime, #98e038)' : 'inherit' }}>
                  {o.amount || '₹0.00'}
                </b>
              </td>
              <td>
                <Badge kind={o.status === 'paid' ? 'good' : ''}>{o.status}</Badge>
              </td>
              {onViewInvoice && (
                <td>
                  <button
                    type="button"
                    className="button secondary small"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11 }}
                    onClick={() => onViewInvoice(o)}
                  >
                    <FileText size={12} /> View Invoice
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AdminOrderTable({ items, onCopied }: { items: any[]; onCopied?: (msg: string) => void }) {
  if (!items.length) {
    return <Empty title="No matching orders." description="Try adjusting your search query or filters." />;
  }
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    if (onCopied) onCopied(`Copied ${label}: ${text}`);
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order Ref</th>
            <th>Customer</th>
            <th>Agent</th>
            <th>Payment ID</th>
            <th>Amount</th>
            <th>License Key</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(o => (
            <tr key={o.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ fontSize: '12px' }}>#{o.id.slice(0, 8)}</code>
                  <button
                    type="button"
                    title="Copy full order ID"
                    aria-label="Copy order ID"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-light)' }}
                    onClick={() => copy(o.id, 'order ID')}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <b>{o.customer || 'Customer'}</b>
                  </div>
                  {o.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <small style={{ color: 'var(--text-light)' }}>{o.email}</small>
                      <button
                        type="button"
                        title="Copy customer email"
                        aria-label="Copy email"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lime, #98e038)' }}
                        onClick={() => copy(o.email, 'email')}
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <b>{o.product || o.productId}</b>
                  {o.productSlug && (
                    <a href={`/agents/${o.productSlug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}>
                      /{o.productSlug} ↗
                    </a>
                  )}
                </div>
              </td>
              <td>
                {o.providerPaymentId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <code style={{ fontSize: '11px', color: 'var(--lime, #98e038)' }}>{o.providerPaymentId}</code>
                    <button
                      type="button"
                      title="Copy Razorpay payment ID"
                      aria-label="Copy payment ID"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lime, #98e038)' }}
                      onClick={() => copy(o.providerPaymentId, 'payment ID')}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                ) : (
                  <small style={{ color: 'var(--muted)' }}>—</small>
                )}
              </td>
              <td>
                <b>{o.amount}</b>
              </td>
              <td>
                {o.licenseSuffix ? (
                  <a href="/admin/licenses" className="badge" style={{ fontSize: '11px', textDecoration: 'none', padding: '2px 8px' }}>
                    <KeyRound size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    ••••-{o.licenseSuffix}
                  </a>
                ) : (
                  <small style={{ color: 'var(--muted)' }}>No license</small>
                )}
              </td>
              <td>
                <small className="block">{date(o.createdAt)}</small>
              </td>
              <td>
                {o.status === 'trial' || String(o.providerPaymentId || '').startsWith('trial_') ? (
                  <span className="badge" style={{ background: '#1e293b', color: '#93c5fd' }}>Free Trial</span>
                ) : o.status === 'gift' || String(o.providerPaymentId || '').startsWith('gift_') ? (
                  <span className="badge" style={{ background: '#2e1065', color: '#d8b4fe' }}>Gifted</span>
                ) : o.status === 'free' || String(o.providerPaymentId || '').startsWith('free_') || (o.status === 'paid' && (o.amountMinor !== undefined ? Number(o.amountMinor) === 0 : parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, '')) === 0)) ? (
                  <span className="badge" style={{ background: '#14532d', color: '#86efac' }}>100% Promo</span>
                ) : o.status === 'paid' ? (
                  <span className="badge good">paid</span>
                ) : o.status === 'refunded' ? (
                  <span className="badge" style={{ background: '#3b2020', color: '#f87171' }}>refunded</span>
                ) : (
                  <Badge>{o.status}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Announcements({ user, items, action }: { user: User; items: any[]; action: (path: string, body?: object, method?: string) => Promise<void> }) { const isOwner = user.role === 'owner'; return <><div className="panel"><h3>Team Announcements</h3>{!items.length ? <p>No internal announcements yet.</p> : items.map(a => <div className="list-row" key={a.id}><Mail size={16} /><div className="grow" style={{ flex: 1, minWidth: 0 }}><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.message}</p></div><span className="small-note">{date(a.createdAt)}</span>{isOwner && <button className="text-button bare" onClick={() => action('/admin/announcements/' + a.id, {}, 'DELETE')}><X size={14}/></button>}</div>)}</div>{isOwner && <form className="panel" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; await action('/admin/announcements', { audience: 'team', message: new FormData(form).get('message') }); form.reset(); }}><h3>Post an announcement</h3><Field label="Message"><textarea name="message" required minLength={3} rows={3} placeholder="Tell your team what's new..." /></Field><button className="button primary">Broadcast to team</button></form>}</>; }
function exportCsv(filename: string, headers: string[], rows: any[][]) { const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = filename; a.click(); }

function PartnerProgram() {
  const { data, error, reload } = useData('/partner/stats');
  const { data: promotions } = useData('/partner/promotional-content');
  const [code, setCode] = useState('');
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <Loading />;

  async function handleJoin(e: any) {
    e.preventDefault();
    setBusy(true); setFeedback('');
    try {
      await api('/partner/join', { method: 'POST', body: JSON.stringify({ code }) });
      reload();
    } catch (e: any) { setFeedback(e.message); }
    setBusy(false);
  }

  async function handlePayout(e: any) {
    e.preventDefault();
    setBusy(true); setFeedback('');
    try {
      await api('/partner/payout', { method: 'POST', body: JSON.stringify({ upi }) });
      setUpi('');
      reload();
      setFeedback('Payout request submitted successfully!');
    } catch (e: any) { setFeedback(e.message); }
    setBusy(false);
  }

  if (!data.active) {
    return (
      <div className="panel">
        <h3>Join the Partner Program</h3>
        <p>Earn a 15% commission on every sale made with your unique referral code. Your buyers will also get a 10% discount on their purchase!</p>
        <form onSubmit={handleJoin} style={{marginTop:'1rem'}}>
          <Field label="Choose your unique referral code"><input name="code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} required placeholder="e.g. CHIRAG10" style={{textTransform:'uppercase'}}/></Field>
          <button className="button primary" disabled={busy||!code}>{busy ? 'Joining...' : 'Generate Code'}</button>
          {feedback && <Notice kind="error">{feedback}</Notice>}
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="stat-grid">
        <Stat label="Total Referrals" value={data.sales} icon={<Activity />} hint="Successful orders" />
        <Stat label="Pending Earnings" value={`₹${(data.pendingBalance/100).toFixed(2)}`} icon={<CreditCard />} hint="Ready for payout" />
        <Stat label="Total Earned" value={`₹${(data.totalEarned/100).toFixed(2)}`} icon={<Activity />} hint="All-time commissions" />
      </div>
      <div className="two-column">
        <div className="panel">
          <KeyRound className="accent" />
          <h3>Your Referral Code</h3>
          <p>Share this code with your audience. They get 10% off, you get 15% commission.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
            <code className="full-key" style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '2px', flex: 1, margin: 0 }}>{data.code}</code>
            <button
              type="button"
              className="button primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: '100%', padding: '14px 18px' }}
              onClick={() => {
                navigator.clipboard.writeText(data.code);
                setFeedback('Copied referral code to clipboard!');
              }}
            >
              <Copy size={16} /> Copy Code
            </button>
          </div>
          {data.status === 'suspended' && <Notice kind="error">Your partner account has been suspended.</Notice>}
        </div>
        <div className="panel">
          <CreditCard className="accent" />
          <h3>Request Payout</h3>
          <p>Once your pending balance reaches ₹2000, you can request a direct transfer.</p>
          <form onSubmit={handlePayout}>
            <Field label="UPI ID / Bank Details"><input value={upi} onChange={e=>setUpi(e.target.value)} required placeholder="e.g. name@okhdfcbank" disabled={data.pendingBalance < 200000 || data.status === 'suspended'}/></Field>
            <button className="button primary" disabled={busy || !upi || data.pendingBalance < 200000 || data.status === 'suspended'}>Request Payout</button>
            {feedback && <Notice kind={feedback.includes('success') ? 'success' : 'error'}>{feedback}</Notice>}
          </form>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Share2 className="accent" size={18} />
          <h3 style={{ margin: 0, fontSize: 18 }}>Ready-to-Share Promotional Templates</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-light)' }}>
          Pre-written promotional messages with your unique code (<code>{data.code}</code>) embedded for quick sharing with your network.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>Twitter / X Post</b>
              <span className="badge">10% Off</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5, flex: 1, margin: '0 0 12px' }}>
              "Automate your daily workflow with AI agents from @NorviAgency! 🚀 Use my coupon code {data.code} for 10% off at https://nor-vi.in/agents"
            </p>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                navigator.clipboard.writeText(`Automate your daily workflow with AI agents from @NorviAgency! 🚀 Use my coupon code ${data.code} for 10% off at https://nor-vi.in/agents`);
                setFeedback('Copied Twitter post to clipboard!');
              }}
            >
              <Copy size={13} style={{ marginRight: 5 }} /> Copy Post
            </button>
          </div>

          <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>LinkedIn / Professional</b>
              <span className="badge">Professional</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5, flex: 1, margin: '0 0 12px' }}>
              "Looking to streamline repetitive tasks and save hours every week? I recommend checking out @NorviAgency's autonomous desktop AI agents. Use my partner code {data.code} for 10% off: https://nor-vi.in/agents"
            </p>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                navigator.clipboard.writeText(`Looking to streamline repetitive tasks and save hours every week? I recommend checking out @NorviAgency's autonomous desktop AI agents. Use my partner code ${data.code} for 10% off: https://nor-vi.in/agents`);
                setFeedback('Copied LinkedIn post to clipboard!');
              }}
            >
              <Copy size={13} style={{ marginRight: 5 }} /> Copy Post
            </button>
          </div>

          <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b>WhatsApp / Direct Message</b>
              <span className="badge">Quick Chat</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5, flex: 1, margin: '0 0 12px' }}>
              "Hey! Check out Norvi Agency's AI agents. They help automate interview practice, job applications, and desktop workflows. Use code {data.code} for 10% off: https://nor-vi.in"
            </p>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                navigator.clipboard.writeText(`Hey! Check out Norvi Agency's AI agents. They help automate interview practice, job applications, and desktop workflows. Use code ${data.code} for 10% off: https://nor-vi.in`);
                setFeedback('Copied WhatsApp message to clipboard!');
              }}
            >
              <Copy size={13} style={{ marginRight: 5 }} /> Copy Message
            </button>
          </div>
        </div>
      </div>
      <CustomerPromotions promotions={promotions} />
    </>
  );
}



function AIAgentManager() {
  const { data, error, reload } = useData('/admin/ai/settings');
  const { data: kbData, reload: reloadKb } = useData('/admin/ai/kb');
  const [tab, setTab] = useState('settings');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data || !kbData) return <Loading />;

  const handleSaveSettings = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(e.currentTarget);
    try {
      await api('/admin/ai/settings', {
        method: 'POST',
        body: JSON.stringify({ api_key: form.get('api_key'), model: form.get('model'), system_prompt: form.get('system_prompt') })
      });
      setMessage('AI Settings saved successfully.');
      reload();
    } catch (err: any) {
      setMessage(err.message);
    }
    setBusy(false);
  };

  const handleAddKb = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/admin/ai/kb', {
        method: 'POST',
        body: JSON.stringify({ title: form.get('title'), content: form.get('content') })
      });
      formElement.reset();
      setMessage('Article added successfully.');
      reloadKb();
    } catch (err: any) {
      setMessage(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="ai-manager">
      <PageHeading title="AI Support Agent" description="Manage your AI settings and knowledge base." />
      <div className="tabs" style={{display:'flex', gap:15, marginBottom:20, paddingBottom:10}}>
        <button onClick={() => { setTab('settings'); setMessage(''); }} className={tab==='settings' ? 'button primary' : 'button secondary'}>Configuration</button>
        <button onClick={() => { setTab('kb'); setMessage(''); }} className={tab==='kb' ? 'button primary' : 'button secondary'}>Knowledge Base</button>
      </div>

      {tab === 'settings' && (
        <form className="panel" onSubmit={handleSaveSettings}>
          <h3>Google AI Studio Configuration</h3>
          <p>Your API key is securely encrypted and never exposed to the public frontend.</p>
          <Field label="AI Provider">
            <input type="text" readOnly value="Google Gemini" disabled />
          </Field>
          <Field label="API Key">
            <input type="password" name="api_key" defaultValue={data.api_key || ''} placeholder="AIzaSy..." />
          </Field>
          <Field label="Model Version">
            <input type="text" name="model" defaultValue={data.model || 'gemini-3.5-flash'} required />
          </Field>
          <Field label="System Prompt (Agent Persona)">
            <textarea name="system_prompt" rows={5} defaultValue={data.system_prompt} required />
          </Field>
          <button className="button primary" disabled={busy}>Save Settings</button>
          {message && <Notice>{message}</Notice>}
        </form>
      )}

      {tab === 'kb' && (
        <div className="two-column">
          <form className="panel" onSubmit={handleAddKb}>
            <h3>Add Knowledge Base Article</h3>
            <p>Paste product details, FAQs, or refund policies here to teach the AI.</p>
            <Field label="Title / Topic">
              <input type="text" name="title" required placeholder="e.g., Refund Policy" />
            </Field>
            <Field label="Content">
              <textarea name="content" required rows={8} placeholder="Paste text here..." />
            </Field>
            <button className="button primary" disabled={busy}>Add Article</button>
            {message && <Notice>{message}</Notice>}
          </form>

          <div className="panel">
            <h3>Current Knowledge Base</h3>
            {kbData.length === 0 ? <p>No articles yet.</p> : (
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {kbData.map((k:any) => (
                  <div key={k.id} style={{padding:12, border:'1px solid var(--border)', borderRadius:6}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <b>{k.title}</b>
                      <button className="text-button bare" style={{color:'var(--red)'}} onClick={async () => {
                        if(confirm('Delete this article?')) {
                          await api(`/admin/ai/kb/${k.id}`, { method: 'DELETE' });
                          reloadKb();
                        }
                      }}><X size={14}/></button>
                    </div>
                    <p style={{fontSize:12, color:'var(--text-light)', margin:'4px 0 0 0'}}>{k.content.slice(0,100)}...</p>
                    <div style={{marginTop:8}}>
                      <Badge>{k.has_embedding ? 'Vectorized' : 'Pending Vectorization'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function MarketingManager() {
  const { data: stats, error: statsError } = useData('/admin/marketing/stats');
  const { data: history, error: historyError, reload: reloadHistory } = useData('/admin/marketing/history');
  const [tab, setTab] = useState('compose');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (statsError || historyError) return <Notice kind="error">{statsError || historyError}</Notice>;
  if (!stats || !history) return <Loading />;

  const handleSend = async (e: any) => {
    e.preventDefault();
    if(!window.confirm('Are you absolutely sure you want to blast this email to the selected audience?')) return;
    setBusy(true);
    setMessage('');
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    try {
      const res = await api('/admin/marketing/send', {
        method: 'POST',
        body: JSON.stringify({
          audience: form.get('audience'),
          subject: form.get('subject'),
          htmlBody: form.get('htmlBody')
        })
      });
      setMessage(`Success! Queued ${res.queued} emails for delivery. They will be dispatched in the background.`);
      formElement.reset();
      reloadHistory();
    } catch (err: any) {
      setMessage(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="marketing-manager">
      <PageHeading title="Broadcasts & Marketing" description="Send targeted mass emails to your audiences." />
      <div className="tabs" style={{display:'flex', gap:15, marginBottom:20, paddingBottom:10}}>
        <button onClick={() => { setTab('compose'); setMessage(''); }} className={tab==='compose' ? 'button primary' : 'button secondary'}>Compose Broadcast</button>
        <button onClick={() => { setTab('history'); setMessage(''); }} className={tab==='history' ? 'button primary' : 'button secondary'}>Broadcast History</button>
      </div>

      {tab === 'compose' && (
        <div className="two-column">
          <form className="panel" onSubmit={handleSend}>
            <h3>Compose Email Blast</h3>
            <Field label="Target Audience Segment">
              <select name="audience" required>
                <option value="all">All Users ({stats.all})</option>
                <option value="customers">Paying Customers ({stats.customers})</option>
                <option value="leads">Warm Leads ({stats.leads})</option>
                <option value="affiliates">Active Affiliates ({stats.affiliates})</option>
              </select>
            </Field>
            <Field label="Email Subject">
              <input type="text" name="subject" required placeholder="Flash Sale: 50% Off Today Only!" />
            </Field>
            <Field label="HTML Body">
              <textarea name="htmlBody" required rows={12} placeholder="<h1>Hello!</h1><p>We are running a sale...</p>" style={{fontFamily: 'monospace'}} />
            </Field>
            <button className="button primary" disabled={busy}>Blast Email <Megaphone size={16} style={{marginLeft: 8}} /></button>
            {message && <Notice>{message}</Notice>}
          </form>

          <div className="panel">
            <h3>Audience Live Stats</h3>
            <p style={{marginBottom: 20}}>Real-time database queries of your segments.</p>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <div className="stat"><div><span>Total Audience</span><Users size={16}/></div><b>{stats.all}</b></div>
              <div className="stat"><div><span>Paying Customers</span><Badge>High Value</Badge></div><b>{stats.customers}</b></div>
              <div className="stat"><div><span>Warm Leads</span><Badge>Zero Purchases</Badge></div><b>{stats.leads}</b></div>
              <div className="stat"><div><span>Active Affiliates</span><Badge>Partners</Badge></div><b>{stats.affiliates}</b></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="panel">
          <h3>Previous Broadcasts</h3>
          {history.length === 0 ? <p>No broadcasts sent yet.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Subject</th><th>Audience</th><th>Delivered</th></tr></thead>
                <tbody>
                  {history.map((b: any) => (
                    <tr key={b.id}>
                      <td>{new Date(b.created_at).toLocaleDateString()}</td>
                      <td><b>{b.subject}</b></td>
                      <td><Badge>{b.audience}</Badge></td>
                      <td>{b.sent_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



export function CouponsManager() {
  const { data, error, reload } = useData('/admin/coupons');
  const { data: productsData } = useData('/admin/products');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data || !productsData) return <Loading />;

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <h3>Coupon Codes</h3>
      <p>Generate promo codes for your customers. A 100% discount will automatically bypass the payment gateway.</p>
      
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Target</th>
              <th>Redemptions</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c: any) => {
              const isExpired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
              const isExhausted = c.max_uses !== null && c.max_uses !== undefined && (c.used_count || 0) >= c.max_uses;
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <b>{c.code}</b>
                      {isExhausted && <span className="badge" style={{ background: '#3b2020', color: '#f87171' }}>Exhausted</span>}
                      {isExpired && <span className="badge" style={{ background: '#3b2020', color: '#f87171' }}>Expired</span>}
                    </div>
                  </td>
                  <td><Badge>{c.discount_percentage}% OFF</Badge></td>
                  <td>
                    <small className="block">Agent: {c.product_id ? productsData.items.find((p:any)=>p.id === c.product_id)?.name || c.product_id : 'All Agents'}</small>
                    <small className="block">Duration: {c.duration_type === 'all' || !c.duration_type ? 'All Durations' : c.duration_type.split(',').map((d: string) => d.replace('_', ' ')).join(', ')}</small>
                  </td>
                  <td>
                    <Badge>
                      {c.used_count || 0} / {c.max_uses ? `${c.max_uses} uses` : 'Unlimited'}
                    </Badge>
                  </td>
                  <td>
                    {c.expires_at ? (
                      <div>
                        <span>{new Date(c.expires_at).toLocaleDateString()}</span>
                        <small className="block" style={{ color: isExpired ? 'var(--red, #ef4444)' : 'var(--muted)', fontSize: 11 }}>
                          {isExpired ? 'Expired' : new Date(c.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </div>
                    ) : 'Never'}
                  </td>
                  <td>
                    <button className="text-button bare" style={{color: 'var(--red)'}} onClick={async () => {
                      if (window.confirm('Delete this coupon?')) {
                        await api('/admin/coupons/' + c.id, { method: 'DELETE' });
                        reload();
                      }
                    }}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {!data.length && <tr><td colSpan={6} style={{textAlign:'center'}}>No active coupons.</td></tr>}
          </tbody>
        </table>
      </div>

      <form className="form-grid" style={{marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)'}} onSubmit={async e => {
        e.preventDefault();
        setBusy(true); setErrorMsg('');
        const form = new FormData(e.currentTarget);
        const selectedDurations: string[] = [];
        if (form.get('dur_1_month') === 'on') selectedDurations.push('1_month');
        if (form.get('dur_3_months') === 'on') selectedDurations.push('3_months');
        if (form.get('dur_lifetime') === 'on') selectedDurations.push('lifetime');
        const duration = (selectedDurations.length === 0 || selectedDurations.length === 3) 
          ? null 
          : selectedDurations.join(',');

        const maxUsesRaw = form.get('maxUses') as string;
        const maxUses = maxUsesRaw ? parseInt(maxUsesRaw, 10) : null;

        try {
          await api('/admin/coupons', {
            method: 'POST',
            body: JSON.stringify({
              code: form.get('code'),
              discount: parseInt(form.get('discount') as string),
              productId: form.get('productId') || null,
              duration,
              maxUses,
              expiresAt: form.get('expiresAt') ? new Date(form.get('expiresAt') as string).toISOString() : null
            })
          });
          reload();
          (e.target as HTMLFormElement).reset();
        } catch (err: any) {
          setErrorMsg(err.message);
        }
        setBusy(false);
      }}>
        <Field label="Coupon Code"><input name="code" required placeholder="e.g. LAUNCH100" style={{textTransform: 'uppercase'}} /></Field>
        <Field label="Discount %"><input name="discount" type="number" required min="1" max="100" placeholder="100" /></Field>
        <Field label="Usage Limit (Max Redemptions)"><input name="maxUses" type="number" min="1" defaultValue="50" placeholder="e.g. 50 (leave empty for unlimited)" /></Field>
        <Field label="Specific Agent">
          <select name="productId">
            <option value="">All Agents</option>
            {productsData.items.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Applies to Durations (Select any, or leave unselected for All)">
          <div style={{display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', minHeight: '38px'}}>
            <label style={{display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px'}}>
              <input type="checkbox" name="dur_1_month" /> 1 Month
            </label>
            <label style={{display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px'}}>
              <input type="checkbox" name="dur_3_months" /> 3 Months
            </label>
            <label style={{display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px'}}>
              <input type="checkbox" name="dur_lifetime" /> Lifetime Access
            </label>
          </div>
        </Field>
        <Field label="Expiry (Optional)"><input type="datetime-local" name="expiresAt" /></Field>
        <div style={{gridColumn: '1 / -1'}}>
          {errorMsg && <Notice kind="error">{errorMsg}</Notice>}
          <button className="button secondary" disabled={busy}>Create Coupon</button>
        </div>
      </form>
    </div>
  );
}



function TrialManager() {
  const { data, reload } = useData('/admin/products');
  const [busy, setBusy] = useState('');
  
  if (!data) return null;
  const items = data.items || [];
  
  const toggle = async (id: string, current: boolean) => {
    setBusy(id);
    try {
      await api(`/admin/products/${id}/trial`, { method: 'POST', body: JSON.stringify({ trialActive: !current }) });
      reload();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel">
      <h3>Free Trials</h3>
      <p>Enable or disable the 1-day free trial button for individual agents.</p>
      <div className="list-grid">
        {items.map((p: any) => (
          <div className="list-row" key={p.id}>
            <div className="grow" style={{ flex: 1, minWidth: 0 }}>
              <b>{p.name}</b>
              <p>{p.trialActive !== false ? 'Trial Enabled' : 'Trial Disabled'}</p>
            </div>
            <button 
              className={`button ${p.trialActive !== false ? 'secondary' : 'primary'}`}
              disabled={busy === p.id}
              onClick={() => toggle(p.id, p.trialActive !== false)}
            >
              {busy === p.id ? 'Saving...' : p.trialActive !== false ? 'Disable Trial' : 'Enable Trial'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromotionsManager() {
  const { data, error, reload } = useData('/admin/settings');
  const { data: productsData } = useData('/admin/products');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data || !productsData) return <Loading />;

  const settings = data.settings;
  const products = productsData.items || [];
  
  const handleSave = async (e: any) => {
    e.preventDefault();
    setBusy(true); setMessage('');
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const selectedAgents = products.map((p: any) => p.id).filter((id: string) => form.get(`agent_${id}`) === 'on');
    
    try {
      await api('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          bannerText: form.get('bannerText'),
          saleActive: form.get('saleActive') === 'on',
          salePercentage: parseInt(form.get('salePercentage') as string) || 0,
          saleProductIds: selectedAgents
        })
      });
      setMessage('Successfully updated promotions and announcements. Changes are live.');
      reload();
    } catch (err: any) {
      setMessage(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="promotions-manager">
      <form className="panel" onSubmit={handleSave}>
        <h3>Global Website Banner</h3>
        <p>Type a message to appear across the top of your public website. Leave empty to hide.</p>
        <Field label="Banner Announcement Text">
          <textarea name="bannerText" rows={2} defaultValue={settings.bannerText || ''} placeholder="e.g. V2 Launching Next Week! Get 20% off all agents." />
        </Field>
        
        <div style={{ marginTop: 40, borderTop: '1px solid var(--border)', paddingTop: 30 }}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 15}}>
            <div>
              <h3 style={{margin:0}}>Targeted Flash Sale</h3>
              <p style={{margin:'5px 0 0 0'}}>Toggle this mode to activate the dynamic pricing engine for selected agents.</p>
            </div>
            <button type="button" className="button secondary" onClick={(e) => {
              const form = (e.target as any).closest('form');
              const checkboxes = form.querySelectorAll('input[type="checkbox"][name^="agent_"]');
              checkboxes.forEach((c: HTMLInputElement) => c.checked = true);
            }}>Select All Agents</button>
          </div>
          
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 30 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)', padding: 15, borderRadius: 8, border: '1px solid var(--border)', flex: 1 }}>
              <input type="checkbox" name="saleActive" defaultChecked={settings.saleActive} style={{ width: 18, height: 18 }} />
              <div>
                <b>Sale Mode Active</b>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>Enable discounted pricing on the storefront.</p>
              </div>
            </label>
            <div style={{ flex: 1 }}>
              <Field label="Discount Percentage (%)">
                <input type="number" name="salePercentage" defaultValue={settings.salePercentage || 0} min="0" max="100" />
              </Field>
            </div>
          </div>
          
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            {products.map((p: any) => (
              <label key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-start', margin: 0, padding: '12px 16px', background: 'rgba(200, 255, 100, 0.05)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                  <input type="checkbox" name={`agent_${p.id}`} defaultChecked={p.is_on_sale} style={{ width: 18, height: 18, margin: 0, flexShrink: 0 }} />
                  <div style={{ flex: 1, textAlign: 'left' }}><b style={{ fontSize: 14 }}>{p.name}</b></div>
                </label>
            ))}
          </div>
        </div>
        
        <div style={{ marginTop: 30 }}>
          <button className="button primary" disabled={busy}>Publish Changes <Activity size={16} style={{marginLeft: 8}} /></button>
        </div>
        {message && <div style={{marginTop:15}}><Notice>{message}</Notice></div>}
      </form>
    </div>
  );
}


function AdminPromotions({ promotions, reload }: { promotions: any[]; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  async function handleSubmit(e: any) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    try {
      const fileInput = form.querySelector('input[name="file"]') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      const title = (form.querySelector('input[name="title"]') as HTMLInputElement)?.value;
      const description = (form.querySelector('textarea[name="description"]') as HTMLTextAreaElement)?.value || '';

      if (!file) throw new Error('Please select a file.');
      const media_url = await uploadFile(file, 'promotions');
      const media_type = file.type.startsWith('video/') ? 'video' : 'image';

      await api('/admin/promotional-content', {
        method: 'POST',
        body: JSON.stringify({ title, description, media_url, media_type })
      });
      form.reset();
      reload();
    } catch (err: any) {
      alert(err.message);
    }
    setBusy(false);
  }
  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this?')) return;
    setBusy(true);
    try {
      await api('/admin/promotional-content/' + id, { method: 'DELETE' });
      reload();
    } catch (err: any) {
      alert(err.message);
    }
    setBusy(false);
  }
  return (
    <div className="panel">
      <h3>Promotional Content</h3>
      <p>Upload videos and images for your partners to use in their marketing campaigns.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 30, background: 'var(--background)', padding: 15, borderRadius: 8 }}>
        <Field label="Title"><input name="title" required placeholder="e.g. 10% Discount Campaign Video" /></Field>
        <Field label="Description / Caption"><textarea name="description" rows={3} placeholder="Write a ready-to-use caption with hashtags..." /></Field>
        <Field label="Media File (Image or Video, max 50MB)"><input type="file" name="file" required accept="image/*,video/*" /></Field>
        <button type="submit" className="button primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>Upload Content</button>
      </form>
      {promotions.length === 0 ? <p>No promotional content uploaded yet.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Media</th><th>Title & Caption</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>
              {promotions.map(p => (
                <tr key={p.id}>
                  <td>
                    {p.media_type === 'video' ? 
                      <video src={p.media_url} width={100} style={{ borderRadius: 4 }} controls /> :
                      <img src={p.media_url} width={100} style={{ borderRadius: 4 }} />
                    }
                  </td>
                  <td><b>{p.title}</b><p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{p.description}</p></td>
                  <td><Badge>{p.media_type}</Badge></td>
                  <td><button className="button secondary small" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={busy} onClick={() => handleDelete(p.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CustomerPromotions({ promotions }: { promotions: any[] }) {
  if (!promotions || promotions.length === 0) return null;
  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <h3>Promotional Resources</h3>
      <p>Use these ready-made marketing assets to promote your referral code.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>
        {promotions.map(p => (
          <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              {p.media_type === 'video' ? 
                <video src={p.media_url} style={{ maxWidth: '100%', maxHeight: '100%' }} controls /> :
                <img src={p.media_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              }
            </div>
            <div style={{ padding: 15, display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h4 style={{ margin: '0 0 10px 0' }}>{p.title}</h4>
              <p style={{ margin: '0 0 15px 0', fontSize: 13, color: 'var(--text-light)', whiteSpace: 'pre-wrap', flex: 1 }}>{p.description}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={p.media_url} download target="_blank" className="button primary small" style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }} rel="noreferrer">
                  <Download size={14} style={{ marginRight: 5 }} /> Download
                </a>
                <button className="button secondary small" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(p.title + '\n\n' + (p.description||''))}>
                  <Copy size={14} style={{ marginRight: 5 }} /> Copy Text
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AffiliateManager() {
  const { data: affiliates, error: aError, reload: aReload } = useData('/admin/affiliates');
  const { data: payouts, error: pError, reload: pReload } = useData('/admin/payouts');
  const { data: promotions, error: prError, reload: prReload } = useData('/admin/promotional-content');
  const [busy, setBusy] = useState(false);
  const [showPartners, setShowPartners] = useState(false);

  if (aError || pError || prError) return <Notice kind="error">{aError || pError || prError}</Notice>;
  if (!affiliates || !payouts || !promotions) return <Loading />;

  async function handleAction(path: string) {
    if (!confirm('Are you sure?')) return;
    setBusy(true);
    try { await api(path, { method: 'POST' }); aReload(); pReload(); } catch (e: any) { alert(e.message); }
    setBusy(false);
  }

  async function handleStatus(id: string, status: string) {
    setBusy(true);
    try { await api(`/admin/affiliates/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }); aReload(); } catch (e: any) { alert(e.message); }
    setBusy(false);
  }

  return (
    <>
      <AdminPromotions promotions={promotions} reload={prReload} />
      <div className="panel">
        <h3>Payout Requests</h3>
        {payouts.length === 0 ? <p>No payout requests.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Partner</th><th>Code</th><th>Amount</th><th>UPI ID</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {payouts.map((p:any) => (
                  <tr key={p.id}>
                    <td>{date(p.createdAt)}</td>
                    <td>{p.name}</td>
                    <td><code>{p.code}</code></td>
                    <td><b>₹{(p.amount/100).toFixed(2)}</b></td>
                    <td>{p.upi}</td>
                    <td><Badge>{p.status}</Badge></td>
                    <td>
                      {p.status === 'pending' && <button className="button primary small" disabled={busy} onClick={() => handleAction(`/admin/payouts/${p.id}/mark-paid`)}>Mark Paid</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div onClick={() => setShowPartners(!showPartners)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <h3 style={{ margin: 0 }}>Active Partners</h3>
          {showPartners ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {showPartners && (affiliates.length === 0 ? <p style={{marginTop:15}}>No partners yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Partner</th><th>Code</th><th>Sales</th><th>Total Earned</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {affiliates.map((a:any) => (
                  <tr key={a.id}>
                    <td><b>{a.name}</b><br/><small>{a.email}</small></td>
                    <td><code>{a.code}</code></td>
                    <td>{a.sales}</td>
                    <td>₹{(a.totalEarned/100).toFixed(2)}</td>
                    <td><Badge>{a.status}</Badge></td>
                    <td>
                      <div style={{display:'flex', gap:'8px'}}>
                        <button className="button secondary small" disabled={busy} onClick={() => handleStatus(a.id, a.status === 'active' ? 'suspended' : 'active')}>{a.status === 'active' ? 'Suspend' : 'Activate'}</button>
                        <button className="button secondary small" style={{borderColor:'var(--red)', color:'var(--red)'}} disabled={busy} onClick={() => handleAction(`/admin/affiliates/${a.id}/delete`)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}

export interface AdminDeviceItem {
  id: string;
  installation_id: string;
  active: boolean;
  last_seen_at?: string | null;
  banned_until?: string | null;
  ban_reason?: string | null;
  is_banned?: boolean;
}

export interface AdminLicenseItem {
  id: string;
  product: string;
  productSlug?: string;
  customer: string;
  email?: string;
  status: string;
  suffix: string;
  maxDevices?: number;
  expiresAt?: string | null;
  device?: boolean;
  devices?: AdminDeviceItem[];
  createdAt?: string;
}

export function AdminLicenseCard({
  license: l,
  userRole,
  onAction,
  onBanDevice,
  onUnbanDevice,
  onRemoveDevice,
  onShowTelemetry,
  onLicenseAction,
  onCopiedEmail,
}: {
  license: AdminLicenseItem;
  userRole: string;
  onAction: (path: string, body?: object, method?: string) => Promise<void>;
  onBanDevice: (device: { id: string; installationId: string }) => void;
  onUnbanDevice: (deviceId: string, installationId: string) => void;
  onRemoveDevice: (deviceId: string, installationId: string) => void;
  onShowTelemetry: (lic: { id: string; product: string; customer: string; email?: string }) => void;
  onLicenseAction: (id: string, action: string) => void;
  onCopiedEmail: (email: string) => void;
}) {
  const isExpired = l.expiresAt ? new Date(l.expiresAt) < new Date() : false;
  const isOneDayTrial = l.expiresAt && Math.abs(new Date(l.expiresAt).getTime() - new Date(l.createdAt || l.expiresAt).getTime()) <= 86400000 * 1.5;

  return (
    <div className="panel" key={l.id} style={{ marginBottom: '1.5rem' }}>
      <div className="panel-heading" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{l.product}</h3>
            {isOneDayTrial ? (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 12, background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', fontWeight: 600 }}>
                1-Day Trial
              </span>
            ) : l.expiresAt ? (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 12, background: isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: isExpired ? '#ef4444' : '#60a5fa', border: `1px solid ${isExpired ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`, fontWeight: 600 }}>
                {isExpired ? 'Expired' : `Expires ${new Date(l.expiresAt).toLocaleDateString()}`}
              </span>
            ) : (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 12, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 600 }}>
                Lifetime Key
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{l.customer}</span>
            {l.email && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--surface, #1e261a)',
                  border: '1px solid var(--border, #3a4930)',
                  borderRadius: '14px',
                  padding: '2px 9px',
                  fontSize: '12px',
                  color: 'var(--text-light, #a4b494)'
                }}
              >
                <Mail size={12} />
                <span>{l.email}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(l.email || '');
                      onCopiedEmail(l.email || '');
                    } catch {
                      // fallback
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: 'var(--lime, #98e038)',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                  title="Copy customer email"
                  aria-label="Copy customer email"
                >
                  <Copy size={12} />
                </button>
              </span>
            )}
          </div>
        </div>

        <Badge>{l.status}</Badge>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <code>NORVI-XXXX-XXXX-XXXX-{l.suffix}</code>
        <span className="small-note">
          Slot Capacity: {l.devices?.length || 0} / {l.maxDevices || 1} Device{l.maxDevices !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Connected Hardware IDs Subsection */}
      <div
        style={{
          margin: '14px 0',
          border: '1px solid var(--line, #2d3826)',
          borderRadius: '8px',
          padding: '12px 14px',
          background: 'rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Monitor size={15} style={{ color: 'var(--lime, #98e038)' }} />
            Connected Hardware IDs ({l.devices?.length || 0} / {l.maxDevices || 1})
          </span>
          {l.devices && l.devices.length > 0 && (
            <span className="small-note">Manage individual machines &amp; lockout durations</span>
          )}
        </div>

        {!l.devices || l.devices.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>
            No machines activated yet on this license key.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {l.devices.map(d => {
              const isBanned = d.is_banned || (d.banned_until && new Date(d.banned_until) > new Date()) || !d.active;
              const isLifetimeBan = d.banned_until && new Date(d.banned_until).getUTCFullYear() >= 9999;
              const banExpires = d.banned_until
                ? isLifetimeBan
                  ? 'Lifetime Ban'
                  : `Banned until ${new Date(d.banned_until).toLocaleString()}`
                : isBanned
                ? 'Banned'
                : null;

              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    padding: '8px 12px',
                    background: isBanned ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface, #1e261a)',
                    border: isBanned ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--line, #2d3826)',
                    borderRadius: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <code style={{ fontSize: '12px', fontWeight: 600, color: isBanned ? 'var(--red, #ef4444)' : 'var(--lime, #98e038)' }}>
                      {d.installation_id}
                    </code>
                    {isBanned ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#3b1c1c', border: '1px solid #7f2828', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', color: '#fca5a5' }}>
                        🚫 {banExpires}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#1c331c', border: '1px solid #286028', borderRadius: '12px', padding: '2px 8px', fontSize: '11px', color: '#86efac' }}>
                        🟢 Active {d.last_seen_at ? `(seen ${date(d.last_seen_at)})` : ''}
                      </span>
                    )}
                    {d.ban_reason && (
                      <span className="small-note" style={{ color: '#fca5a5' }}>
                        Reason: {d.ban_reason}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="button secondary small"
                      title="Unlink this machine to free the license slot cleanly (does not ban the machine)"
                      onClick={() => onRemoveDevice(d.id, d.installation_id)}
                    >
                      Unlink HWID
                    </button>

                    {isBanned ? (
                      <button
                        type="button"
                        className="button primary small"
                        style={{ background: '#22c55e', borderColor: '#22c55e', color: '#052e16' }}
                        title="Lift ban immediately on this hardware ID"
                        onClick={() => onUnbanDevice(d.id, d.installation_id)}
                      >
                        <Check size={13} style={{ marginRight: 4 }} /> Unban HWID
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button secondary small"
                        style={{ color: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }}
                        title="Block this hardware ID for 24h, 7d, 1m, or Lifetime"
                        onClick={() => onBanDevice({ id: d.id, installationId: d.installation_id })}
                      >
                        🚫 Ban HWID
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Row Actions */}
      <div className="row-actions">
        <button
          type="button"
          className="button primary small"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={() => onShowTelemetry({ id: l.id, product: l.product, customer: l.customer, email: l.email })}
        >
          <Activity size={14} /> View Usage &amp; Limits
        </button>

        {userRole !== 'support' && (
          <>
            <button className="button secondary" onClick={() => onLicenseAction(l.id, l.status === 'active' ? 'revoke' : 'restore')}>
              {l.status === 'active' ? 'Revoke access' : 'Restore access'}
            </button>
            <button className="button secondary" onClick={() => onLicenseAction(l.id, 'rotate')}>
              Rotate key
            </button>
          </>
        )}
        <button
          className="button secondary"
          style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
          onClick={() => onLicenseAction(l.id, 'delete')}
        >
          Delete
        </button>
        {l.device && (
          <button className="button secondary" onClick={() => onAction('/licenses/' + l.id + '/device-reset')}>
            Reset devices
          </button>
        )}
        {userRole === 'owner' && <OwnerReveal id={l.id} />}
      </div>
    </div>
  );
}

export function BanDeviceModal({
  device,
  onClose,
  onConfirmBan
}: {
  device: { id: string; installationId: string };
  onClose: () => void;
  onConfirmBan: (duration: string, reason?: string) => Promise<void>;
}) {
  const [duration, setDuration] = useState('24h');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal title={`Ban Hardware ID: ${device.installationId}`} onClose={onClose}>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-light)' }}>
        Select a lockout duration for hardware ID <code>{device.installationId}</code>. While banned, any agent instance attempting to activate licenses or make proxy calls from this machine will be blocked.
      </p>

      <form
        onSubmit={async e => {
          e.preventDefault();
          setBusy(true);
          try {
            await onConfirmBan(duration, reason.trim() || undefined);
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Lockout Duration">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', background: duration === '24h' ? 'rgba(152, 224, 56, 0.1)' : 'var(--surface, #1e261a)', border: '1px solid var(--line, #2d3826)', borderRadius: '6px' }}>
              <input type="radio" name="banDuration" value="24h" checked={duration === '24h'} onChange={() => setDuration('24h')} />
              <div>
                <b>24 Hours</b>
                <span className="small-note block">Temporary 1-day lockout (auto-lifts in 24 hours)</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', background: duration === '7d' ? 'rgba(152, 224, 56, 0.1)' : 'var(--surface, #1e261a)', border: '1px solid var(--line, #2d3826)', borderRadius: '6px' }}>
              <input type="radio" name="banDuration" value="7d" checked={duration === '7d'} onChange={() => setDuration('7d')} />
              <div>
                <b>7 Days</b>
                <span className="small-note block">1-week lockout (auto-lifts in 7 days)</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', background: duration === '1m' ? 'rgba(152, 224, 56, 0.1)' : 'var(--surface, #1e261a)', border: '1px solid var(--line, #2d3826)', borderRadius: '6px' }}>
              <input type="radio" name="banDuration" value="1m" checked={duration === '1m'} onChange={() => setDuration('1m')} />
              <div>
                <b>1 Month (30 Days)</b>
                <span className="small-note block">30-day lockout (auto-lifts in 30 days)</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', background: duration === 'lifetime' ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface, #1e261a)', border: duration === 'lifetime' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--line, #2d3826)', borderRadius: '6px' }}>
              <input type="radio" name="banDuration" value="lifetime" checked={duration === 'lifetime'} onChange={() => setDuration('lifetime')} />
              <div>
                <b style={{ color: 'var(--red, #ef4444)' }}>Lifetime (Permanent)</b>
                <span className="small-note block" style={{ color: '#fca5a5' }}>Permanent hardware ban until an administrator manually clicks Unban</span>
              </div>
            </label>
          </div>
        </Field>

        <Field label="Ban Reason (Optional note for security audit log)">
          <textarea
            name="banReason"
            placeholder="e.g. Rapid token abuse, unauthorized machine sharing"
            rows={2}
            maxLength={250}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </Field>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy}
            style={{ background: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)', color: '#fff' }}
          >
            {busy ? 'Applying Ban...' : 'Confirm Hardware Ban'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function InquiriesAdmin({ onFeedback }: { onFeedback: (msg: string) => void }) {
  const { data: rawData, error, reload } = useData('/admin/inquiries');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'tickets' | 'contacts' | 'open' | 'resolved'>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const inquiries = Array.isArray(rawData) ? rawData : [];

  const filtered = inquiries.filter((inq: any) => {
    const text = `${inq.name} ${inq.email} ${inq.subject} ${inq.message}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (filter === 'tickets') return inq.source === 'support_ticket';
    if (filter === 'contacts') return inq.source === 'contact_form';
    if (filter === 'open') return inq.status === 'open';
    if (filter === 'resolved') return inq.status === 'resolved';
    return true;
  });

  const totalCount = inquiries.length;
  const openCount = inquiries.filter((i: any) => i.status === 'open').length;
  const ticketCount = inquiries.filter((i: any) => i.source === 'support_ticket').length;
  const contactCount = inquiries.filter((i: any) => i.source === 'contact_form').length;

  const handleToggleStatus = async (inq: any) => {
    setBusyId(inq.id);
    const nextStatus = inq.status === 'resolved' ? 'open' : 'resolved';
    try {
      await api(`/admin/inquiries/${inq.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ source: inq.source, status: nextStatus })
      });
      onFeedback(`Marked inquiry as ${nextStatus}.`);
      reload();
      if (selectedInquiry?.id === inq.id) {
        setSelectedInquiry({ ...selectedInquiry, status: nextStatus });
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update inquiry status');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (inq: any) => {
    const isCustomer = inq.source === 'support_ticket';
    const label = isCustomer ? 'Customer Support Ticket' : 'Website Contact Form Message';
    if (!window.confirm(`⚠️ PERMANENT DELETION\n\nAre you sure you want to permanently delete this ${label}?\n\nFrom: ${inq.name || 'Unnamed'} (${inq.email})\nSubject: ${inq.subject || 'No subject'}\n\nThis cannot be undone.`)) {
      return;
    }
    setBusyId(inq.id);
    try {
      await api(`/admin/inquiries/${inq.id}?source=${inq.source}`, {
        method: 'DELETE',
        body: JSON.stringify({ source: inq.source })
      });
      onFeedback('Inquiry permanently deleted.');
      reload();
      if (selectedInquiry?.id === inq.id) {
        setSelectedInquiry(null);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete inquiry');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 20 }}>
        <Stat label="Total Inquiries" value={totalCount} icon={<Mail />} hint="Customer & visitor messages" />
        <Stat label="Open / Pending" value={openCount} icon={<LifeBuoy />} hint="Awaiting reply or resolution" />
        <Stat label="Customer Tickets" value={ticketCount} icon={<Users />} hint="Registered account submissions" />
        <Stat label="Contact Forms" value={contactCount} icon={<MessageSquare />} hint="Public website inquiries" />
      </div>

      {/* Prominent Origin & Status Filter Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <button
          type="button"
          className={`button small ${filter === 'all' ? 'primary' : 'secondary'}`}
          onClick={() => setFilter('all')}
        >
          All Messages ({totalCount})
        </button>
        <button
          type="button"
          className={`button small ${filter === 'tickets' ? 'primary' : 'secondary'}`}
          onClick={() => setFilter('tickets')}
          style={filter === 'tickets' ? {} : { borderColor: 'rgba(192, 132, 252, 0.4)', color: '#c084fc' }}
        >
          <Users size={13} style={{ marginRight: 6 }} /> Customer Support Tickets ({ticketCount})
        </button>
        <button
          type="button"
          className={`button small ${filter === 'contacts' ? 'primary' : 'secondary'}`}
          onClick={() => setFilter('contacts')}
          style={filter === 'contacts' ? {} : { borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}
        >
          <Globe size={13} style={{ marginRight: 6 }} /> Website Contact Forms ({contactCount})
        </button>
        <button
          type="button"
          className={`button small ${filter === 'open' ? 'primary' : 'secondary'}`}
          onClick={() => setFilter('open')}
        >
          Open ({openCount})
        </button>
        <button
          type="button"
          className={`button small ${filter === 'resolved' ? 'primary' : 'secondary'}`}
          onClick={() => setFilter('resolved')}
        >
          Resolved ({totalCount - openCount})
        </button>
      </div>

      <div className="catalog-toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <label className="search" style={{ flex: 1, minWidth: 260 }}>
          <Search size={17} />
          <input
            aria-label="Search inquiries"
            placeholder="Search sender, email, subject, or message..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter inquiries"
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          style={{ width: 'auto', minWidth: 160 }}
        >
          <option value="all">All Inquiries ({totalCount})</option>
          <option value="tickets">Registered Customer Tickets ({ticketCount})</option>
          <option value="contacts">Website Contact Form ({contactCount})</option>
          <option value="open">Open / Pending ({openCount})</option>
          <option value="resolved">Resolved ({totalCount - openCount})</option>
        </select>
      </div>

      {error ? (
        <Notice kind="error">{error}</Notice>
      ) : !rawData ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty
          title="No inquiries match."
          description={query ? "Try clearing your search query." : "Your inbox is clear! Customer support requests and website contact messages will appear here in real-time."}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer / Sender</th>
                <th>Channel / Origin</th>
                <th>Subject &amp; Message Snippet</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inq: any) => (
                <tr key={inq.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b>{inq.name || 'Unnamed'}</b>
                      {inq.email && (
                        <button
                          type="button"
                          title="Copy email"
                          aria-label="Copy email"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lime, #98e038)' }}
                          onClick={() => {
                            navigator.clipboard.writeText(inq.email);
                            onFeedback(`Copied email ${inq.email}`);
                          }}
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                    <small className="block" style={{ color: 'var(--muted)' }}>{inq.email}</small>
                  </td>
                  <td>
                    {inq.source === 'support_ticket' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(192, 132, 252, 0.14)',
                            color: '#c084fc',
                            borderColor: 'rgba(192, 132, 252, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            width: 'fit-content',
                            fontWeight: 600
                          }}
                        >
                          <Users size={12} /> Support Ticket
                        </span>
                        <small style={{ color: 'var(--muted)', fontSize: 11 }}>Registered Customer</small>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(251, 191, 36, 0.14)',
                            color: '#fbbf24',
                            borderColor: 'rgba(251, 191, 36, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            width: 'fit-content',
                            fontWeight: 600
                          }}
                        >
                          <Globe size={12} /> Contact Form
                        </span>
                        <small style={{ color: 'var(--muted)', fontSize: 11 }}>Website Visitor (Public)</small>
                      </div>
                    )}
                  </td>
                  <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <b style={{ display: 'block', color: 'var(--text)' }}>{inq.subject || 'No subject'}</b>
                    <small style={{ color: 'var(--muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inq.message}
                    </small>
                  </td>
                  <td>{date(inq.createdAt)}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: inq.status === 'resolved' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(152, 224, 56, 0.12)',
                        color: inq.status === 'resolved' ? 'var(--muted)' : 'var(--lime, #98e038)',
                        borderColor: inq.status === 'resolved' ? 'var(--border)' : 'rgba(152, 224, 56, 0.3)'
                      }}
                    >
                      {inq.status || 'open'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="button secondary small"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setSelectedInquiry(inq)}
                      >
                        View &amp; Reply
                      </button>
                      <button
                        type="button"
                        className="button secondary small"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        disabled={busyId === inq.id}
                        onClick={() => handleToggleStatus(inq)}
                      >
                        {inq.status === 'resolved' ? 'Reopen' : 'Resolve'}
                      </button>
                      <button
                        type="button"
                        className="button secondary small"
                        style={{ padding: '4px 8px', fontSize: 12, color: 'var(--red, #ef4444)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                        disabled={busyId === inq.id}
                        title="Permanently delete inquiry"
                        onClick={() => handleDelete(inq)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedInquiry && (
        <InquiryDetailModal
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onToggleStatus={() => handleToggleStatus(selectedInquiry)}
          onDelete={() => handleDelete(selectedInquiry)}
          onFeedback={onFeedback}
        />
      )}
    </div>
  );
}

export function InquiryDetailModal({
  inquiry,
  onClose,
  onToggleStatus,
  onDelete,
  onFeedback
}: {
  inquiry: any;
  onClose: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onFeedback: (msg: string) => void;
}) {
  const isCustomerTicket = inquiry.source === 'support_ticket';
  const subjectLine = inquiry.subject ? `Re: ${inquiry.subject}` : 'Re: Your Inquiry to NORVI Agency';
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(inquiry.email)}&su=${encodeURIComponent(subjectLine)}`;
  const mailtoUrl = `mailto:${inquiry.email}?subject=${encodeURIComponent(subjectLine)}`;

  return (
    <Modal title={inquiry.subject || 'Customer Inquiry'} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Origin Banner */}
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: isCustomerTicket ? 'rgba(192, 132, 252, 0.08)' : 'rgba(251, 191, 36, 0.08)',
          border: `1px solid ${isCustomerTicket ? 'rgba(192, 132, 252, 0.25)' : 'rgba(251, 191, 36, 0.25)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isCustomerTicket ? (
              <>
                <Users size={16} style={{ color: '#c084fc' }} />
                <span style={{ fontSize: 13, color: '#e9d5ff', fontWeight: 500 }}>
                  Origin: <b>Customer Account Support Hub</b> (Submitted from <code>/account/support</code>)
                </span>
              </>
            ) : (
              <>
                <Globe size={16} style={{ color: '#fbbf24' }} />
                <span style={{ fontSize: 13, color: '#fef08a', fontWeight: 500 }}>
                  Origin: <b>Public Website Contact Form</b> (Submitted from <code>/contact</code>)
                </span>
              </>
            )}
          </div>
          <span className="badge" style={{ fontSize: 11 }}>
            {isCustomerTicket ? 'Registered Customer' : 'Public Visitor'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{inquiry.name || 'Anonymous Customer'}</h3>
              <span
                className="badge"
                style={{
                  background: inquiry.status === 'resolved' ? 'rgba(255,255,255,0.05)' : 'rgba(152, 224, 56, 0.15)',
                  color: inquiry.status === 'resolved' ? 'var(--muted)' : 'var(--lime)',
                  fontSize: 11
                }}
              >
                {inquiry.status || 'open'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>
              <b>Email:</b> {inquiry.email} &middot; <b>Submitted:</b> {date(inquiry.createdAt)}
            </p>
          </div>
        </div>

        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 8 }}>
            Message Content
          </span>
          <div style={{
            background: 'var(--surface, #1e261a)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            maxHeight: 280,
            overflowY: 'auto'
          }}>
            {inquiry.message}
          </div>
        </div>

        {/* Action Buttons: Reply Options + Status / Delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button primary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              title="Open directly in Gmail in a new browser tab"
            >
              <Mail size={14} /> Reply via Gmail <ExternalLink size={12} />
            </a>
            <a
              href={mailtoUrl}
              className="button secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              title="Open your desktop email client (Outlook, Apple Mail, etc.)"
            >
              Desktop Mail <ArrowUpRight size={12} />
            </a>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                navigator.clipboard.writeText(inquiry.email);
                onFeedback(`Copied email ${inquiry.email}`);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Copy size={14} /> Copy Email
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="button secondary small"
              onClick={onToggleStatus}
            >
              {inquiry.status === 'resolved' ? 'Reopen Inquiry' : 'Mark as Resolved'}
            </button>
            <button
              type="button"
              className="button secondary small"
              style={{ color: 'var(--red, #ef4444)', borderColor: 'rgba(239, 68, 68, 0.4)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={onDelete}
              title="Permanently remove this inquiry"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function LicenseTelemetryModal({
  license,
  initialData,
  onClose
}: {
  license: { id: string; product: string; customer: string; email?: string };
  initialData?: any;
  onClose: () => void;
}) {
  const fetched = useData(initialData ? '' : '/admin/licenses/' + license.id + '/telemetry');
  const data = initialData || fetched.data;
  const error = initialData ? '' : fetched.error;

  return (
    <Modal title={`Usage & Limits — ${license.product}`} onClose={onClose} wide>
      <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--line, #2d3826)' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <b>Customer:</b> {license.customer} {license.email ? `(${license.email})` : ''}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
          Live per-license telemetry tracked automatically by your backend proxy. Limits are hidden from customers.
        </p>
      </div>

      {error ? (
        <Notice kind="error">{error}</Notice>
      ) : !data ? (
        <Loading />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Cloud AI Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Bot size={18} style={{ color: 'var(--lime, #98e038)' }} />
              <h4 style={{ margin: 0, fontSize: '15px' }}>OpenRouter Cloud AI Requests &amp; Limits</h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
              <div className="panel" style={{ padding: '14px', margin: 0, background: 'rgba(0,0,0,0.2)' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>24-Hour Rolling (Today)</span>
                <div style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px' }}>
                  {data.ai?.used_24h ?? 0} <span style={{ fontSize: '13px', color: 'var(--muted)' }}>/ {data.ai?.limit_24h === 0 ? '∞' : data.ai?.limit_24h} reqs</span>
                </div>
                <small style={{ color: data.ai?.left_24h === 0 ? 'var(--red, #ef4444)' : 'var(--lime, #98e038)' }}>
                  {data.ai?.left_24h === -1 ? 'Unlimited requests' : `${data.ai?.left_24h} prompts remaining`}
                </small>
              </div>

              <div className="panel" style={{ padding: '14px', margin: 0, background: 'rgba(0,0,0,0.2)' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>7-Day Rolling (Week)</span>
                <div style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px' }}>
                  {data.ai?.used_7d ?? 0} <span style={{ fontSize: '13px', color: 'var(--muted)' }}>/ {data.ai?.limit_7d === 0 ? '∞' : data.ai?.limit_7d} reqs</span>
                </div>
                <small style={{ color: data.ai?.left_7d === 0 ? 'var(--red, #ef4444)' : 'var(--text-light)' }}>
                  {data.ai?.left_7d === -1 ? 'Unlimited requests' : `${data.ai?.left_7d} prompts remaining`}
                </small>
              </div>

              <div className="panel" style={{ padding: '14px', margin: 0, background: 'rgba(0,0,0,0.2)' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>30-Day Rolling (Month)</span>
                <div style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px' }}>
                  {data.ai?.used_30d ?? 0} <span style={{ fontSize: '13px', color: 'var(--muted)' }}>/ {data.ai?.limit_30d === 0 ? '∞' : data.ai?.limit_30d} reqs</span>
                </div>
                <small style={{ color: data.ai?.left_30d === 0 ? 'var(--red, #ef4444)' : 'var(--text-light)' }}>
                  {data.ai?.left_30d === -1 ? 'Unlimited requests' : `${data.ai?.left_30d} prompts remaining`}
                </small>
              </div>

              <div className="panel" style={{ padding: '14px', margin: 0, background: 'rgba(0,0,0,0.2)' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>Tokens &amp; Real Dollar Cost</span>
                <div style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--lime, #98e038)' }}>
                  ${Number(data.ai?.total_cost_usd || 0).toFixed(4)} <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>USD</span>
                </div>
                <small style={{ color: 'var(--muted)' }}>
                  {(data.ai?.total_tokens ?? 0).toLocaleString()} tokens consumed
                </small>
              </div>
            </div>
          </div>

          {/* Speech-to-Text Fallback Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Activity size={18} style={{ color: '#60a5fa' }} />
              <h4 style={{ margin: 0, fontSize: '15px' }}>Groq Speech-to-Text (STT) Server Fallback</h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
              <div className="panel" style={{ padding: '14px', margin: 0, background: 'rgba(0,0,0,0.2)' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>24-Hour STT Fallback</span>
                <div style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px' }}>
                  {data.stt?.used_24h ?? 0} <span style={{ fontSize: '13px', color: 'var(--muted)' }}>/ {data.stt?.limit_24h === 0 ? '∞' : data.stt?.limit_24h} chunks</span>
                </div>
                <small style={{ color: data.stt?.left_24h === 0 ? 'var(--red, #ef4444)' : '#60a5fa' }}>
                  {data.stt?.left_24h === -1 ? 'Unlimited STT' : `${data.stt?.left_24h} chunks remaining`}
                </small>
              </div>

              <div className="panel" style={{ padding: '14px', margin: 0, background: 'rgba(0,0,0,0.2)' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>7-Day STT Fallback</span>
                <div style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px' }}>
                  {data.stt?.used_7d ?? 0} <span style={{ fontSize: '13px', color: 'var(--muted)' }}>/ {data.stt?.limit_7d === 0 ? '∞' : data.stt?.limit_7d} chunks</span>
                </div>
                <small style={{ color: 'var(--text-light)' }}>
                  {data.stt?.left_7d === -1 ? 'Unlimited STT' : `${data.stt?.left_7d} chunks remaining`}
                </small>
              </div>

              <div className="panel" style={{ padding: '14px', margin: 0, background: 'rgba(0,0,0,0.2)' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>30-Day STT Fallback</span>
                <div style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px' }}>
                  {data.stt?.used_30d ?? 0} <span style={{ fontSize: '13px', color: 'var(--muted)' }}>/ {data.stt?.limit_30d === 0 ? '∞' : data.stt?.limit_30d} chunks</span>
                </div>
                <small style={{ color: 'var(--text-light)' }}>
                  {data.stt?.left_30d === -1 ? 'Unlimited STT' : `${data.stt?.left_30d} chunks remaining`}
                </small>
              </div>
            </div>
          </div>

          {/* Recent Prompt Turns (Last 10 turns) */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>
              📜 Recent Prompt Activity Log (Last 10 Requests)
            </h4>
            {!data.recent_logs || data.recent_logs.length === 0 ? (
              <p className="small-note">No recent prompts logged for this license.</p>
            ) : (
              <div className="table-wrap" style={{ margin: 0, maxHeight: '240px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Task Slot</th>
                      <th>Model Used</th>
                      <th>Tokens (In / Out)</th>
                      <th>Cost</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_logs.map((log: any) => (
                      <tr key={log.id}>
                        <td>{date(log.created_at)}</td>
                        <td><code>{log.task_key}</code></td>
                        <td><small>{log.model_used?.split('/').pop() || log.model_used}</small></td>
                        <td>{log.prompt_tokens} / {log.completion_tokens}</td>
                        <td>${Number(log.cost_usd || 0).toFixed(5)}</td>
                        <td><Badge>{log.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function CustomerOrdersModal({
  customer,
  initialData,
  onClose
}: {
  customer: { id: string; name: string; email?: string };
  initialData?: any;
  onClose: () => void;
}) {
  const fetched = useData(initialData ? '' : '/admin/customers/' + customer.id + '/orders');
  const data = initialData || fetched.data;
  const error = initialData ? '' : fetched.error;

  return (
    <Modal title={`Purchase History — ${customer.name}`} onClose={onClose} wide>
      <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--line, #2d3826)' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          <b>Customer:</b> {customer.name} {customer.email ? `(${customer.email})` : ''}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
          Verified payment records, order receipts, and associated activation keys.
        </p>
      </div>

      {error ? (
        <Notice kind="error">{error}</Notice>
      ) : !data ? (
        <Loading />
      ) : !data.orders || data.orders.length === 0 ? (
        <Empty
          title="No purchase history."
          description={`${customer.name} has not placed any paid orders or claimed free trials yet.`}
        />
      ) : (
        <div className="table-wrap" style={{ margin: 0, maxHeight: '420px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Order Reference</th>
                <th>Agent / Product</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Gateway / Payment ID</th>
                <th>Date</th>
                <th>License Key</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o: any) => (
                <tr key={o.id}>
                  <td>
                    <code>{o.id.slice(0, 8)}</code>
                    {o.providerOrderId && <small className="block">{o.providerOrderId}</small>}
                  </td>
                  <td>
                    <b>{o.product}</b>
                    <small className="block">/{o.productSlug}</small>
                  </td>
                  <td>
                    <b style={{ color: Number(o.amountMinor || 0) > 0 ? 'var(--lime, #98e038)' : 'var(--text-light)' }}>
                      {o.amount}
                    </b>
                  </td>
                  <td><Badge>{o.status}</Badge></td>
                  <td>
                    {o.providerPaymentId ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <code>{o.providerPaymentId}</code>
                        <button
                          type="button"
                          style={{ padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lime, #98e038)', display: 'inline-flex', alignItems: 'center' }}
                          title="Copy Payment ID"
                          aria-label="Copy Payment ID"
                          onClick={() => navigator.clipboard.writeText(o.providerPaymentId)}
                        >
                          <Copy size={12} />
                        </button>
                      </span>
                    ) : (
                      <small style={{ color: 'var(--muted)' }}>Direct / Free</small>
                    )}
                  </td>
                  <td>{date(o.createdAt)}</td>
                  <td>
                    {o.licenseSuffix ? (
                      <a
                        href="/admin/licenses"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'var(--lime, #98e038)', fontSize: '12px' }}
                      >
                        <KeyRound size={12} /> NORVI-••••-{o.licenseSuffix}
                      </a>
                    ) : (
                      <small style={{ color: 'var(--muted)' }}>No license</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function Admin({ section, user, settings, onCatalogChange }: { section: string; user: User; settings: Settings; onCatalogChange: () => void }) {
    const map: Record<string, string> = { '': 'analytics', '/products': 'products', '/releases': 'products', '/categories': 'categories', '/customers': 'customers', '/licenses': 'licenses', '/orders': 'orders', '/inquiries': 'inquiries', '/promotions': 'settings', '/team': 'team', '/announcements': 'announcements/team', '/content': 'content', '/activity': 'activity', '/settings': 'settings' }; const endpoint = section === '' && user.role === 'support' ? 'customers' : map[section] || 'products'; const { data, error, reload } = useData('/admin/' + endpoint); const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [editing, setEditing] = useState<Product | null | undefined>(undefined), [feedback, setFeedback] = useState(''), [licenseAction, setLicenseAction] = useState<{ id: string; action: string } | null>(null), [giftModal, setGiftModal] = useState(false), [banningDevice, setBanningDevice] = useState<{ id: string; installationId: string } | null>(null), [telemetryLicense, setTelemetryLicense] = useState<{ id: string; product: string; customer: string; email?: string } | null>(null), [viewingOrdersCustomer, setViewingOrdersCustomer] = useState<{ id: string; name: string; email?: string } | null>(null);
    const titles: Record<string, string> = { '': 'Your agency, at a glance.', '/products': 'Agent Collection & Content.', '/releases': 'Agent Releases & Commercial Deployment.', '/customers': 'The people behind the accounts.', '/licenses': 'Access, under your control.', '/orders': 'Every order, in one place.', '/inquiries': 'Customer Inquiries & Support Messages.', '/promotions': 'Run sales and global announcements.', '/team': 'Good work takes a team.', '/announcements': 'Internal directives.', '/content': 'Make it sound like you.', '/activity': 'A clear record of every change.', '/settings': 'The details that make it yours.' };
    const items = (data?.items || []) as any[];
    const filtered = items.filter(item => {
      const matchesQuery = JSON.stringify(item).toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (filter === 'all') return true;
      if (filter === 'nonbuyers') return item.purchases === 0;
      if (section === '/orders') {
        const isPaid = item.status === 'paid' && Number(item.amountMinor || 0) > 0 && !String(item.providerPaymentId || '').startsWith('trial_') && !String(item.providerPaymentId || '').startsWith('gift_') && !String(item.providerPaymentId || '').startsWith('free_');
        const isTrial = item.status === 'trial' || String(item.providerPaymentId || '').startsWith('trial_');
        const isGift = item.status === 'gift' || String(item.providerPaymentId || '').startsWith('gift_');
        if (filter === 'paid') return isPaid;
        if (filter === 'trial') return isTrial;
        if (filter === 'gift') return isGift;
        return item.status === filter;
      }
      return item.status === filter;
    });
    async function action(path: string, body?: object, method: string = 'POST') { try { await api(path, { method, body: Object.keys(body || {}).length ? JSON.stringify(body) : undefined }); reload(); setFeedback('Action completed successfully.'); } catch (e: any) { setFeedback(e.message); } }
    return <><PageHeading eyebrow={section === '' ? 'WELCOME TO YOUR WORKSPACE' : 'AGENCY MANAGEMENT'} title={titles[section] || 'Workspace'} description={section === '' ? 'Start with the essentials. Build your collection, get to know your customers, and keep things moving.' : undefined} action={section === '/products' ? <button className="button primary" onClick={() => setEditing(null)}><Plus size={17} />Add agent</button> : section === '/customers' ? <button className="button secondary" onClick={() => exportCsv('customers.csv', ['ID', 'Email', 'Name', 'Status', 'Registered'], items.map(u => [u.id, u.email, u.name, u.suspended ? 'suspended' : u.status || 'active', u.createdAt]))}><Download size={17} />Export CSV</button> : section === '/orders' ? <button className="button secondary" onClick={() => exportCsv('orders.csv', ['Order ID', 'Customer', 'Email', 'Product', 'Amount', 'Payment ID', 'Status', 'Date'], filtered.map(o => [o.id, o.customer, o.email || '', o.product, o.amount, o.providerPaymentId || '', o.status, o.createdAt]))}><Download size={17} />Export CSV</button> : section === '/licenses' && user.role !== 'support' ? <button className="button primary" onClick={() => setGiftModal(true)}><Plus size={17} />Gift License</button> : undefined} />{error ? <Notice kind="error">{error}</Notice> : !data ? <Loading /> : <>{feedback && <Notice>{feedback}</Notice>}
        {section === '' && <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 16 }}>
            <Stat label="Revenue (Today)" value={'₹' + (data?.metrics?.revenueToday ?? 0).toLocaleString()} icon={<CreditCard />} hint={(data?.metrics?.salesToday ?? 0) + ' paid orders'} />
            <Stat label="Revenue (7 Days)" value={'₹' + (data?.metrics?.revenue7d ?? 0).toLocaleString()} icon={<CreditCard />} hint={(data?.metrics?.sales7d ?? 0) + ' paid orders'} />
            <Stat label="Revenue (30 Days)" value={'₹' + (data?.metrics?.revenue30d ?? data?.metrics?.revenue ?? 0).toLocaleString()} icon={<CreditCard />} hint={(data?.metrics?.sales30d ?? data?.metrics?.recentSales ?? 0) + ' paid orders'} />
            <Stat label="Revenue (All-Time)" value={'₹' + (data?.metrics?.revenueAllTime ?? 0).toLocaleString()} icon={<CreditCard />} hint={(data?.metrics?.salesAllTime ?? 0) + ' paid orders'} />
          </div>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <Stat label="Active Licenses" value={data?.metrics?.activeLicenses || 0} icon={<KeyRound />} hint="Deployed machines" />
            <Stat label="Total Customers" value={data?.metrics?.totalCustomers || 0} icon={<Users />} hint="Registered accounts" />
            <Stat label="Total Orders (Paid)" value={data?.metrics?.salesAllTime ?? data?.metrics?.recentSales ?? 0} icon={<Activity />} hint={data?.metrics?.trialsAllTime ? `+${data.metrics.trialsAllTime} trials & gifts` : 'Commercial sales'} />
          </div>
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Top-Selling Agents Leaderboard</h3>
                <small style={{ color: 'var(--muted)' }}>Ranked by commercial revenue and active deployment licenses</small>
              </div>
              <a href="/admin/releases" className="text-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Manage Releases <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Paid Orders</th>
                    <th>Trials & Gifts</th>
                    <th>Active Licenses</th>
                    <th>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.leaderboard && data.leaderboard.length > 0) ? (
                    data.leaderboard.map((agent: any, idx: number) => (
                      <tr key={agent.id || agent.slug || idx}>
                        <td>
                          <span style={{ 
                            fontWeight: 700, 
                            color: idx === 0 ? 'var(--lime, #98e038)' : idx === 1 ? '#60a5fa' : idx === 2 ? '#c084fc' : 'var(--text-light)',
                            fontSize: 13 
                          }}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <b>{agent.name}</b>
                            <a href={`/agents/${agent.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--lime, #98e038)', textDecoration: 'none' }}>
                              /{agent.slug} ↗
                            </a>
                          </div>
                        </td>
                        <td><Badge>{agent.status || 'published'}</Badge></td>
                        <td>
                          <b style={{ color: Number(agent.paidOrders || 0) > 0 ? 'var(--lime, #98e038)' : 'inherit' }}>
                            {agent.paidOrders || 0}
                          </b>
                        </td>
                        <td>
                          <small style={{ color: Number(agent.trialOrders || 0) > 0 ? 'var(--text-light)' : 'var(--muted)' }}>
                            {agent.trialOrders || 0} {agent.trialOrders === 1 ? 'activation' : 'activations'}
                          </small>
                        </td>
                        <td>{agent.activeLicenses || 0}</td>
                        <td style={{ color: Number(agent.revenue || 0) > 0 ? 'var(--lime, #98e038)' : 'inherit', fontWeight: 600 }}>
                          ₹{Number(agent.revenue || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>
                        No commercial sales recorded yet. Leaderboard updates in real-time as orders arrive.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="workspace-welcome"><div><span className="eyebrow">A STRONG START</span><h2>Let’s make NORVI<br /><span className="serif">yours.</span></h2><p>Your website is taking shape. Add your product details and explore the customer journey.</p><a className="button primary" href={user.role === 'support' ? '/admin/customers' : '/admin/products'}>{user.role === 'support' ? 'Explore customers' : 'Manage your agents'}<ArrowUpRight size={17} /></a></div><div className="setup-list">{[['Website name', 'NORVI is ready', true], ['Product details', 'Names, features, prices, and releases', false], ['Secure accounts', 'Connect your authentication service', false], ['Payments & email', 'Connect your business accounts', false]].map(([title, desc, done]) => <div key={String(title)}><span className={done ? 'check-circle done' : 'check-circle'}>{done ? <Check size={14} /> : <span />}</span><div><b>{title}</b><small>{desc}</small></div></div>)}</div></div><div className="panel-heading"><h3>Find your next step</h3><a href="/" className="text-button">View website <ArrowUpRight size={15} /></a></div>{user.role !== 'support' && <SocialMediaForm settings={settings} onSave={onCatalogChange} />}
          <div className="quick-links">{(user.role === 'support' ? [['Customers', 'Find accounts, including non-buyers', '/admin/customers', Users], ['Licenses', 'Help with devices and access', '/admin/licenses', KeyRound]] : [['Your products', 'Add, edit, and publish your agents', '/admin/products', Box], ['Website content', 'Edit your headline and description', '/admin/content', FileText]]).map(([title, desc, href, Icon]: any) => <a className="panel" href={href} key={title}><Icon size={22} /><h3>{title}</h3><p>{desc}</p><ArrowUpRight size={19} /></a>)}</div></>}
        {['/products', '/releases', '/categories', '/customers', '/licenses', '/orders', '/activity'].includes(section) && <div className="catalog-toolbar"><label className="search"><Search size={17} /><input aria-label="Search records" placeholder={section === '/customers' ? 'Search name or email…' : section === '/orders' ? 'Search order ID, customer, email, payment ID…' : section === '/activity' ? 'Search action or actor…' : 'Search records…'} value={query} onChange={e => setQuery(e.target.value)} /></label>{section !== '/activity' && <select aria-label="Filter records" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All records</option>{['/products', '/releases'].includes(section) ? <><option value="published">Published</option><option value="draft">Drafts</option><option value="archived">Archived</option></> : section === '/customers' ? <option value="nonbuyers">No purchases</option> : section === '/orders' ? <><option value="paid">Paid (Commercial)</option><option value="trial">Free Trials</option><option value="gift">Gifted Licenses</option><option value="pending">Pending</option><option value="refunded">Refunded</option></> : <><option value="active">Active</option><option value="revoked">Revoked</option></>}</select>}</div>}
        {section === '/categories' && <CategoriesAdmin categories={data.categories} onSave={() => { reload(); onCatalogChange(); }} />}
        {section === '/products' && <><CatalogNoticeEditor settings={settings} onSave={onCatalogChange} /><div className="admin-products">{filtered.map((p: Product) => <div className="panel admin-product" key={p.id}><ProductIcon product={p} /><div className="grow" style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><h3>{p.name}</h3><select aria-label="Change agent status" value={p.status} style={{ width: 'auto', padding: '2px 8px', fontSize: '12px', borderRadius: '4px', background: 'var(--surface, #1e261a)', color: p.status === 'published' ? 'var(--lime, #98e038)' : 'var(--text-light)', border: '1px solid var(--border)' }} onChange={async e => { await action('/admin/products/' + p.id + '/status', { status: e.target.value }); onCatalogChange(); }}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div><p>{p.tagline}</p><span className="small-note">/{p.slug} · {p.price}</span></div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><a href={`/agents/${p.slug}`} target="_blank" rel="noopener noreferrer" className="button secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: '13px' }}>View Page <ExternalLink size={14} /></a><button className="button secondary" onClick={() => setEditing(p)}>Edit Content & SEO <ArrowUpRight size={15} /></button><button className="button secondary" style={{color: "var(--red)", borderColor: "var(--red)"}} onClick={() => { if(window.confirm("Are you sure you want to permanently delete this agent?")) { action("/admin/products/" + p.id, {}, "DELETE"); } }}>Delete</button></div></div>)}</div>{!filtered.length && <Empty title="No products match." description="Change your filters or add your first agent." />}</>}
        {section === '/releases' && <AgentReleasesAdmin products={filtered} onSave={() => { reload(); onCatalogChange(); }} />}
        {section === '/customers' && <><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Registered</th><th>Purchases & Spend</th><th>Licenses</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(u => <tr key={u.id}><td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><b>{u.name || 'Unnamed'}</b>{u.email && <button type="button" title="Copy email" aria-label="Copy customer email" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lime, #98e038)' }} onClick={() => { navigator.clipboard.writeText(u.email); setFeedback(`Copied email ${u.email}`); }}><Copy size={12} /></button>}</div><small className="block">{u.email}</small></td><td>{date(u.createdAt)}</td><td><div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}><b style={{ color: Number(u.totalSpent || 0) > 0 ? 'var(--lime, #98e038)' : 'var(--text-light)' }}>{Number(u.totalSpent || 0) > 0 ? `₹${Number(u.totalSpent).toLocaleString()}` : (u.orderCount > 0 ? 'Free / Trial' : '₹0')}</b><button type="button" className="button secondary small" style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => setViewingOrdersCustomer({ id: u.id, name: u.name || 'Customer', email: u.email })}><CreditCard size={12} /> {u.orderCount || 0} {u.orderCount === 1 ? 'order' : 'orders'}</button></div>{u.purchasedProducts && u.purchasedProducts.length > 0 ? <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{u.purchasedProducts.map((p: any) => <span key={p.slug || p.id} className="badge" style={{ fontSize: '10px', padding: '1px 6px' }}>{p.name}</span>)}</div> : <small style={{ color: 'var(--muted)', fontSize: '11px' }}>No purchases</small>}</div></td><td><b>{u.activeLicenses || u.licenseCount || 0}</b></td><td><Badge>{u.suspended ? 'suspended' : u.status || 'active'}</Badge></td><td><div className="row-actions"><button className="button secondary" onClick={() => action('/admin/customers/' + u.id + '/suspend', { suspended: !(u.suspended || u.status === 'suspended') })}>{(u.suspended || u.status === 'suspended') ? 'Restore account' : 'Suspend account'}</button>{(user.role === 'owner' || user.role === 'administrator') && <><button className="button secondary" onClick={async () => { await action('/admin/impersonate', { id: u.id }); window.location.href = u.role === 'customer' ? '/account' : '/admin'; }}>Login As</button><button className="button secondary" style={{ color: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }} onClick={() => { if (window.confirm(`⚠️ PERMANENT ACCOUNT DELETION\n\nAre you sure you want to permanently delete the account for "${u.name || u.email}"?\n\nThis will permanently destroy:\n• All licenses and key activations\n• All connected hardware devices\n• All orders and purchase receipts\n• Customer profile and login credentials\n\nThis action cannot be undone.`)) { action('/admin/customers/' + u.id + '/delete'); } }}>Delete account</button></>}</div></td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="No matching customers." description="Try a different search or filter." />}</>}
        {section === '/licenses' && (!filtered.length ? <Empty title="No licenses issued yet." description="Active customer licenses and key activations will appear here as orders are placed." href="/admin/orders" label="View orders" /> : <div className="license-list">{filtered.map(l => <AdminLicenseCard key={l.id} license={l} userRole={user.role} onAction={action} onBanDevice={dev => setBanningDevice(dev)} onUnbanDevice={async (deviceId, installationId) => { if (window.confirm(`Lift ban on hardware ID "${installationId}"?`)) { await action(`/admin/devices/${deviceId}/unban`); } }} onRemoveDevice={async (deviceId, installationId) => { if (window.confirm(`Unlink hardware ID "${installationId}" from this license?\n\nThis frees the slot cleanly so the customer can activate another machine.`)) { await action(`/admin/devices/${deviceId}/remove`); } }} onShowTelemetry={lic => setTelemetryLicense(lic)} onLicenseAction={(id, act) => setLicenseAction({ id, action: act })} onCopiedEmail={email => setFeedback(`Copied email ${email}`)} />)}</div>)}
        {section === '/orders' && <><div className="stat-grid" style={{ marginBottom: 16 }}><Stat label="Total Orders" value={filtered.length} icon={<CreditCard />} /><Stat label="Paid Commercial Volume" value={'₹' + (filtered.filter(o => o.status === 'paid' && Number(o.amountMinor || (parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, '')) * 100) || 0) > 0 && !String(o.providerPaymentId || '').startsWith('trial_') && !String(o.providerPaymentId || '').startsWith('gift_') && !String(o.providerPaymentId || '').startsWith('free_')).reduce((acc, o) => acc + (Number(o.amountMinor || (parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, '')) * 100)) || 0) / 100, 0)).toLocaleString()} icon={<Activity />} /></div><AdminOrderTable items={filtered} onCopied={msg => setFeedback(msg)} /></>}
        {section === '/inquiries' && <InquiriesAdmin onFeedback={setFeedback} />}
        {section === '/promotions' && <><PromotionsManager /><TrialManager /><CouponsManager /></>}
        {section === '/marketing' && <MarketingManager />}
          {section === '/ai-agent' && <AIAgentManager />}
          {section === '/affiliates' && <AffiliateManager />}
          {section === '/team' && <Team data={data} onAction={action} isOwner={user.role === 'owner'} settings={settings} />}
        {section === '/announcements' && <Announcements user={user} items={items} action={action} />}
        {section === '/content' && <SettingsForm initial={data.settings} contentOnly onSave={() => { reload(); onCatalogChange(); }} />}
        {section === '/settings' && <><SettingsForm initial={data.settings} onSave={() => { reload(); onCatalogChange(); }} /><div className="panel"><h3>Integration readiness</h3><div className="list-row"><span>Authentication · Supabase</span><Badge>Not connected</Badge></div><div className="list-row"><span>Payments · Razorpay</span><Badge>Not connected</Badge></div><div className="list-row"><span>Email · Resend</span><Badge>Not connected</Badge></div><p className="small-note">Provider secrets belong in protected server configuration, never in this form.</p></div></>}
        {section === '/activity' && <><div className="panel"><div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3>Activity log ({filtered.length})</h3></div>{!filtered.length ? <p>No changes match your filter.</p> : filtered.map(a => <div className="list-row" key={a.id}><span className="activity-icon"><Activity size={16} /></span><div className="grow" style={{ flex: 1, minWidth: 0 }}><b>{a.action}</b><p>{a.actor} · {a.target}</p></div><span className="small-note">{date(a.createdAt)}</span></div>)}</div><div className="panel"><h3>Email delivery</h3>{!data.emails.length ? <p>No purchase email jobs yet.</p> : data.emails.map((e: any) => <div className="list-row" key={e.id}><Mail size={16} /><span className="grow">Purchase confirmation · {e.orderId.slice(0, 8)}</span><Badge>{e.status}</Badge></div>)}</div></>}
    </>}{editing !== undefined && <Modal title={editing ? 'Edit agent' : 'Add an agent'} onClose={() => setEditing(undefined)} wide><ProductForm categories={data.categories} product={editing} onSave={() => { setEditing(undefined); reload(); onCatalogChange(); }} /></Modal>}{licenseAction && <Modal title={licenseAction.action === 'revoke' ? 'Revoke product access?' : licenseAction.action === 'rotate' ? 'Replace the activation key?' : licenseAction.action === 'delete' ? 'Permanently delete key?' : 'Restore product access?'} onClose={() => setLicenseAction(null)}><p>{licenseAction.action === 'delete' ? 'WARNING: This permanently deletes the license and device records. This action cannot be undone.' : 'This updates the customer license status. A reason will be recorded in the security audit log.'}</p><form onSubmit={async e => { e.preventDefault(); const reason = new FormData(e.currentTarget).get('reason'); await action('/admin/licenses/' + licenseAction.id + '/' + licenseAction.action, { reason }); setLicenseAction(null); }}><Field label="Reason"><textarea name="reason" required minLength={5} maxLength={250} rows={3} /></Field><button className="button primary">Confirm {licenseAction.action}</button></form></Modal>}
    {giftModal && <Modal title="Gift a License" onClose={() => setGiftModal(false)}><p>Manually generate and send an active license to a customer's email address. They must have a registered account.</p><form onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await action('/admin/licenses/gift', { email: d.get('email'), productSlug: d.get('productSlug'), duration: d.get('duration') }); setGiftModal(false); }}><Field label="Customer Email"><input name="email" type="email" required /></Field><Field label="Product Slug (URL)"><input name="productSlug" required placeholder="e.g. omnix-ai" /></Field><Field label="License Duration"><select name="duration" defaultValue="1_month"><option value="1_day">1 Day (Trial Key)</option><option value="1_month">1 Month</option><option value="3_months">3 Months</option><option value="lifetime">Lifetime</option></select></Field><button className="button primary" style={{marginTop: '1rem'}}>Generate and Gift Key</button></form></Modal>}
    {banningDevice && <BanDeviceModal device={banningDevice} onClose={() => setBanningDevice(null)} onConfirmBan={async (duration, reason) => { await action(`/admin/devices/${banningDevice.id}/ban`, { duration, reason }); }} />}
    {telemetryLicense && <LicenseTelemetryModal license={telemetryLicense} onClose={() => setTelemetryLicense(null)} />}
    {viewingOrdersCustomer && <CustomerOrdersModal customer={viewingOrdersCustomer} onClose={() => setViewingOrdersCustomer(null)} />}
    </>;
}
function OwnerReveal({ id }: { id: string }) { const [key, setKey] = useState(''), [error, setError] = useState(''); return <><button className="button secondary" onClick={async () => { try { setKey((await api('/licenses/' + id + '/reveal', { method: 'POST' })).key); } catch (e: any) { setError(e.message); } }}>Reveal key</button>{error && <span style={{color: 'var(--red)', fontSize: '13px'}}>{error}</span>}{key && <Modal title="Activation key" onClose={() => setKey('')}><code className="full-key">{key}</code><CopyButton text={key} /></Modal>}</>; }

function SocialMediaForm({ settings, onSave }: { settings: Settings; onSave: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <form className="panel" onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      const d = Object.fromEntries(new FormData(e.currentTarget));
      try {
        await api('/admin/settings', { method: 'PATCH', body: JSON.stringify({ ...settings, ...d }) });
        setMessage('Social links updated.');
        onSave();
      } catch (err: any) {
        setMessage(err.message);
      }
      setBusy(false);
    }}>
      <h3>Social Media Links</h3>
      <p>Add your full profile URLs here. Leave empty to hide the icon.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Instagram URL"><input type="url" name="socialInstagram" defaultValue={settings?.socialInstagram} placeholder="https://instagram.com/..." /></Field>
        <Field label="YouTube URL"><input type="url" name="socialYoutube" defaultValue={settings?.socialYoutube} placeholder="https://youtube.com/..." /></Field>
        <Field label="Facebook URL"><input type="url" name="socialFacebook" defaultValue={settings?.socialFacebook} placeholder="https://facebook.com/..." /></Field>
        <Field label="Twitter / X URL"><input type="url" name="socialTwitter" defaultValue={settings?.socialTwitter} placeholder="https://twitter.com/..." /></Field>
      </div>
      <button className="button primary" disabled={busy}>{busy ? 'Saving...' : 'Save links'}<Check size={16} /></button>
      {message && <Notice>{message}</Notice>}
    </form>
  );
}

export function CatalogNoticeEditor({ settings, onSave }: { settings: Settings; onSave: () => void }) {
  const [text, setText] = useState(settings?.bannerText || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (val: string) => {
    setBusy(true);
    setMessage('');
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ ...settings, bannerText: val })
      });
      setText(val);
      setMessage(val ? 'Notice published successfully to public website.' : 'Notice cleared from website.');
      onSave();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setBusy(false);
  };

  return (
    <div className="panel" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Agent Showcase Notice / Disclaimer</h3>
            {text ? (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 12, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 600 }}>Active on Website</span>
            ) : (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 12, background: 'var(--surface)', color: 'var(--text-light)', border: '1px solid var(--border)' }}>No Notice Set</span>
            )}
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-light)' }}>
            This message appears above your agent showcase on the homepage and catalog. Edit or remove it anytime.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <textarea
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. Omnix is in development. Voro and Rolvio are preparing for launch. Pricing and release requirements are being finalized."
          style={{ flex: 1, minWidth: '280px', padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.9rem' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="button primary small" disabled={busy} onClick={() => handleSave(text)}>
            {busy ? 'Saving...' : 'Save Notice'}<Check size={14} />
          </button>
          {text && (
            <button className="button secondary small" disabled={busy} onClick={() => handleSave('')}>
              Clear
            </button>
          )}
        </div>
      </div>
      {message && <Notice kind={message.startsWith('Error') ? 'error' : 'success'}>{message}</Notice>}
    </div>
  );
}

export function AgentReleasesAdmin({ products, onSave, initialExpandedId }: { products: Product[]; onSave: () => void; initialExpandedId?: string | null }) {
  const { data: aiData, error: aiError, reload: reloadAi } = useData('/admin/products/ai-policies');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() =>
    initialExpandedId ? { [initialExpandedId]: true } : {}
  );
  const policyMap = useMemo(() => {
    const map = new Map<string, AgentAiPolicy>();
    for (const item of ((aiData?.items || []) as AgentAiPolicy[])) {
      map.set(item.productId, item);
    }
    return map;
  }, [aiData]);
  const fallbackPolicyMap = useMemo(() => {
    const map = new Map<string, AgentAiPolicy>();
    for (const p of products) {
      map.set(p.id, createDefaultAgentAiPolicy(p));
    }
    return map;
  }, [products]);
  const allExpanded = products.length > 0 && products.every(p => !!expandedIds[p.id]);
  const toggleOne = (id: string) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds({});
    } else {
      const next: Record<string, boolean> = {};
      for (const p of products) next[p.id] = true;
      setExpandedIds(next);
    }
  };
  if (!products.length) {
    return <Empty title="No agents found." description="Create an agent in Products first to manage its releases." href="/admin/products" label="Go to Products" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel" style={{ background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
        <h3 style={{ margin: '0 0 0.25rem 0' }}>Agent Commercial Releases & Deployment</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-light)' }}>
          Select any agent below to expand its commercial release settings, OpenRouter AI task models, and hidden 1-day / 1-week / 1-month usage limits.
        </p>
          </div>
          <button type="button" className="button secondary small" onClick={toggleAll}>
            {allExpanded ? <><ChevronUp size={14} /> Collapse All</> : <><ChevronDown size={14} /> Expand All ({products.length})</>}
          </button>
        </div>
        {aiError && <Notice kind="error">Could not load OpenRouter AI policies: {aiError}</Notice>}
      </div>

      {products.map(p => (
        <AgentReleaseCard
          key={p.id}
          product={p}
          initialPolicy={policyMap.get(p.id) || fallbackPolicyMap.get(p.id)!}
          expanded={!!expandedIds[p.id]}
          onToggle={() => toggleOne(p.id)}
          onSave={onSave}
          onPolicySaved={reloadAi}
        />
      ))}
    </div>
  );
}

export function AgentReleaseCard({
  product,
  initialPolicy,
  expanded = false,
  onToggle,
  onSave,
  onPolicySaved,
}: {
  product: Product;
  initialPolicy: AgentAiPolicy;
  expanded?: boolean;
  onToggle?: () => void;
  onSave: () => void;
  onPolicySaved: () => void;
}) {
  const [releaseStatus, setReleaseStatus] = useState(product.releaseStatus || 'development');
  const [status, setStatus] = useState(product.status || 'published');
  const [version, setVersion] = useState(product.version || 'v1.0.0');
  const [requirements, setRequirements] = useState(product.requirements || 'Windows 10+ 64-bit / macOS 12+');
  const [price, setPrice] = useState(product.price || 'Starting at ₹499');
  const [price1m, setPrice1m] = useState(product.price1m || '0');
  const [price3m, setPrice3m] = useState(product.price3m || '0');
  const [priceLifetime, setPriceLifetime] = useState(product.price_lifetime || '999');
  const [aiUsage, setAiUsage] = useState(product.aiUsage || 'Unlimited local usage. Bring your own API keys.');
  const [deviceAllowance, setDeviceAllowance] = useState(product.deviceAllowance || '1 active device per license');
  const [trialActive, setTrialActive] = useState<boolean>(product.trialActive !== false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const [aiPolicy, setAiPolicy] = useState<AgentAiPolicy>(initialPolicy);
  const [aiDirty, setAiDirty] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [localExpanded, setLocalExpanded] = useState(expanded);
  const isExpanded = onToggle ? expanded : localExpanded;
  const handleToggle = () => (onToggle ? onToggle() : setLocalExpanded(v => !v));

  useEffect(() => {
    if (!aiDirty) setAiPolicy(initialPolicy);
  }, [initialPolicy, aiDirty]);

  const persistAiPolicy = async () => {
    if (!product.id) return;
    const parsed = normalizeAgentAiPolicyPayload(aiPolicy);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    await api(`/admin/products/${product.id}/ai-policy`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    setAiDirty(false);
    onPolicySaved();
  };

  const handleSaveAiOnly = async () => {
    setAiSaving(true);
    setAiFeedback('');
    try {
      await persistAiPolicy();
      setAiFeedback('OpenRouter AI models & hidden limits saved.');
    } catch (err: any) {
      setAiFeedback('Error: ' + err.message);
    }
    setAiSaving(false);
  };

  const statusColors = {
    development: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)', label: 'In Development' },
    prelaunch: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', label: 'Preparing for Launch' },
    live: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)', label: 'Live - Available' }
  };
  const sc = statusColors[releaseStatus as keyof typeof statusColors] || statusColors.development;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          ...product,
          releaseStatus,
          status,
          version,
          requirements,
          price,
          price_1m: price1m,
          price_3m: price3m,
          price_lifetime: priceLifetime,
          aiUsage,
          deviceAllowance,
          trialActive,
          extendedContent: product.extendedContent || {}
        })
      });
      if (product.id) {
        await api(`/admin/products/${product.id}/trial`, {
          method: 'POST',
          body: JSON.stringify({ trialActive })
        }).catch(() => {});
      }
      if (product.id && aiDirty) { await persistAiPolicy(); }
      setMessage('Release, AI models, and commercial settings saved successfully.');
      onSave();
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    }
    setBusy(false);
  };

  return (
    <form className="panel" onSubmit={handleSave} style={{ borderTop: `3px solid ${sc.text}`, padding: isExpanded ? undefined : '16px 20px', marginBottom: 0 }}>
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isExpanded ? '1.25rem' : 0,
          flexWrap: 'wrap',
          gap: '0.75rem',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 240 }}>
          <ProductIcon product={product} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{product.name}</h3>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 12, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, fontWeight: 600 }}>
                {sc.label}
              </span>
              <Badge>{status}</Badge>
              <span className={aiPolicy.aiEnabled ? 'badge good' : 'badge'}>
                {aiPolicy.aiEnabled ? 'AI Active' : 'AI Paused'}
              </span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              /{product.slug} · <b>{version}</b> · {price} · AI: <code>{aiPolicy.defaultModel}</code> ({aiPolicy.taskModels.length} task{aiPolicy.taskModels.length === 1 ? '' : 's'})
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          <a href={`/agents/${product.slug}`} target="_blank" className="text-button" style={{ fontSize: '13px' }} rel="noreferrer">
            View Public Page <ArrowUpRight size={14} />
          </a>
          <button
            type="button"
            className="button secondary small"
            aria-expanded={isExpanded}
            onClick={handleToggle}
          >
            {isExpanded ? <>Collapse <ChevronUp size={14} /></> : <>Edit Release &amp; AI <ChevronDown size={14} /></>}
          </button>
          {isExpanded && (
            <button className="button primary small" disabled={busy}>
              {busy ? 'Saving...' : 'Save Release'}<Check size={14} />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
          <div className="form-grid">
            <Field label="Release Status" hint="Controls public download ability and countdown flags">
              <select value={releaseStatus} onChange={e => setReleaseStatus(e.target.value as any)}>
                <option value="development">In development (Private / Testing)</option>
                <option value="prelaunch">Preparing for launch (Pre-launch waitlist)</option>
                <option value="live">Live - Available for download</option>
              </select>
            </Field>
            <Field label="Catalog Visibility">
              <select value={status} onChange={e => setStatus(e.target.value as any)}>
                <option value="published">Published (Visible in catalog)</option>
                <option value="draft">Draft (Hidden from public)</option>
                <option value="archived">Archived (Discontinue sales)</option>
              </select>
            </Field>
            <Field label="Current Release Version" hint="e.g. v1.2.0">
              <input value={version} onChange={e => setVersion(e.target.value)} required />
            </Field>
            <Field label="System Requirements" hint="e.g. Windows 10+ 64-bit / macOS 12+">
              <input value={requirements} onChange={e => setRequirements(e.target.value)} required />
            </Field>
          </div>

          <h4 style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.95rem' }}>Commercial Pricing Matrix</h4>
          <div className="form-grid">
            <Field label="Public Display Price" hint="Text shown on catalog cards">
              <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Starting at ₹499" required />
            </Field>
            <Field label="1-Month License Price (₹ / $)">
              <input type="number" value={price1m} onChange={e => setPrice1m(e.target.value)} />
            </Field>
            <Field label="3-Month License Price (₹ / $)">
              <input type="number" value={price3m} onChange={e => setPrice3m(e.target.value)} />
            </Field>
            <Field label="Lifetime License Price (₹ / $)">
              <input type="number" value={priceLifetime} onChange={e => setPriceLifetime(e.target.value)} />
            </Field>
          </div>

          <h4 style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.95rem' }}>License, Trial & Usage Limits</h4>
          <div className="form-grid">
            <Field label="1-Day Free Trial" hint="Allow new users to claim a 1-day trial key">
              <select value={trialActive ? 'active' : 'disabled'} onChange={e => setTrialActive(e.target.value === 'active')}>
                <option value="active">Active (Free trial enabled on public page)</option>
                <option value="disabled">Disabled (No free trial; paid checkout only)</option>
              </select>
            </Field>
            <Field label="Device Allowance" hint="Max simultaneous device hardware bindings">
              <input value={deviceAllowance} onChange={e => setDeviceAllowance(e.target.value)} placeholder="1 active device per license" />
            </Field>
          </div>

          <AgentAiPolicySection
            productId={product.id}
            productName={product.name}
            policy={aiPolicy}
            onChange={next => {
              setAiDirty(true);
              setAiPolicy(next);
            }}
            onSavePolicy={handleSaveAiOnly}
            saving={aiSaving}
            feedback={aiFeedback}
          />

          <Field label="AI Usage Policy" hint="Displayed during purchase and on product detail page">
            <input value={aiUsage} onChange={e => setAiUsage(e.target.value)} placeholder="Unlimited local usage. Bring your own API keys." />
          </Field>

          {message && <Notice kind={message.startsWith('Error') ? 'error' : 'success'}>{message}</Notice>}
        </div>
      )}
    </form>
  );
}

export function ProductForm({ product, onSave, categories }: { product: Product | null; onSave: () => void; categories: Category[] }) { 
  const [activeTab, setActiveTab] = useState<'overview' | 'media' | 'pillars' | 'platforms' | 'comparison' | 'faqs' | 'guide' | 'seo'>('overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Tab 1: Identity & Copy
  const [name, setName] = useState(product?.name || '');
  const [slug, setSlug] = useState(product?.slug || '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || categories[0]?.id || '');
  const ext = (product?.extendedContent || {}) as AgentExtendedContent;
  const [subHeading, setSubHeading] = useState(ext.subHeading || product?.subHeading || '');
  const [tagline, setTagline] = useState(product?.tagline || '');
  const [description, setDescription] = useState(product?.description || '');
  const [featurePills, setFeaturePills] = useState<string[]>(product?.features && product.features.length ? product.features : ['']);

  // Tab 2: Visual Media & Gallery
  const [logoUrl, setLogoUrl] = useState(product?.logoUrl || null);
  const [heroType, setHeroType] = useState<'video' | 'gif' | 'image'>(ext.heroMediaType || 'video');
  const [heroUrl, setHeroUrl] = useState(ext.heroMediaUrl || '');
  const [badgeText, setBadgeText] = useState(ext.badgeText || '');
  const [workflowHeading, setWorkflowHeading] = useState(product?.workflowHeading || 'Built for your workflow.');
  const [workflowDescription, setWorkflowDescription] = useState(product?.workflowDescription || '');
  const [workflowMediaUrl, setWorkflowMediaUrl] = useState(product?.workflowMediaUrl || null);
  const [workflowNote, setWorkflowNote] = useState(product?.workflowNote || '');
  const [gallery, setGallery] = useState<MediaGalleryItem[]>(ext.gallery || []);

  // Tab 3: Feature Pillars
  const [featurePillars, setFeaturePillars] = useState<FeaturePillar[]>(ext.featurePillars || []);

  // Tab 4: Platform Badges
  const [platformBadges, setPlatformBadges] = useState<string[]>(ext.platformBadges || []);
  const [newBadgeText, setNewBadgeText] = useState('');

  // Tab 5: Competitor Comparison
  const comp = ext.comparison || { competitor1Name: '', competitor2Name: '', rows: [] };
  const [comparisonHeadline, setComparisonHeadline] = useState(comp.headline || '');
  const [competitor1Name, setCompetitor1Name] = useState(comp.competitor1Name || '');
  const [competitor2Name, setCompetitor2Name] = useState(comp.competitor2Name || '');
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>(comp.rows || []);

  // Tab 6: FAQs
  const [faqs, setFaqs] = useState<AgentFaq[]>(ext.faqs || []);

  // Tab 7: Setup Guide
  const guide = ext.guide || { videoUrl: '', sections: [] };
  const [guideVideoUrl, setGuideVideoUrl] = useState(guide.videoUrl || '');
  const [guideSections, setGuideSections] = useState<GuideSection[]>(guide.sections || []);

  // Tab 8: SEO Engine
  const seo = ext.seo || {};
  const [metaTitle, setMetaTitle] = useState(seo.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(seo.metaDescription || '');
  const [focusKeywords, setFocusKeywords] = useState(seo.focusKeywords || '');
  const [ogImage, setOgImage] = useState(seo.ogImage || '');

  const handleFileUpload = async (file: File, callback: (url: string) => void) => {
    try {
      const url = await uploadFile(file);
      callback(url);
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updatedExtendedContent: AgentExtendedContent = {
        subHeading: subHeading.trim() || undefined,
        badgeText: badgeText || undefined,
        heroMediaType: heroUrl ? heroType : undefined,
        heroMediaUrl: heroUrl || null,
        platformBadges: platformBadges.length ? platformBadges : undefined,
        featurePillars: featurePillars.filter(p => p.title.trim()).length ? featurePillars.filter(p => p.title.trim()) : undefined,
        gallery: gallery.filter(g => g.url.trim()).length ? gallery.filter(g => g.url.trim()) : undefined,
        comparison: (comparisonHeadline || competitor1Name || comparisonRows.length) ? {
          headline: comparisonHeadline || `Why Choose ${name || 'Our Agent'}`,
          competitor1Name: competitor1Name || 'Alternatives',
          competitor2Name: competitor2Name || '',
          rows: comparisonRows.filter(r => r.feature.trim())
        } : undefined,
        faqs: faqs.filter(f => f.question.trim()).length ? faqs.filter(f => f.question.trim()) : undefined,
        guide: (guideVideoUrl.trim() || guideSections.filter(s => s.heading.trim()).length) ? {
          videoUrl: guideVideoUrl.trim() || null,
          sections: guideSections.filter(s => s.heading.trim())
        } : undefined,
        seo: (metaTitle || metaDescription || focusKeywords || ogImage) ? {
          metaTitle: metaTitle || undefined,
          metaDescription: metaDescription || undefined,
          focusKeywords: focusKeywords || undefined,
          ogImage: ogImage || undefined
        } : undefined
      };

      const payload = {
        id: product?.id,
        name,
        slug,
        categoryId,
        subHeading: subHeading.trim() || undefined,
        tagline,
        description,
        features: featurePills.map(s => s.trim()).filter(Boolean),
        logoUrl,
        workflowHeading,
        workflowDescription,
        workflowMediaUrl,
        workflowNote,
        // Preserve release & pricing settings
        price: product?.price || 'Starting at ₹499',
        price_1m: product?.price1m || '0',
        price_3m: product?.price3m || '0',
        price_lifetime: product?.price_lifetime || '999',
        version: product?.version || 'v1.0.0',
        requirements: product?.requirements || 'Windows 10+ 64-bit / macOS 12+',
        releaseStatus: product?.releaseStatus || 'development',
        status: product?.status || 'published',
        aiUsage: product?.aiUsage || '',
        deviceAllowance: product?.deviceAllowance || '',
        extendedContent: updatedExtendedContent
      };

      await api('/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      onSave();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const navTabs = [
    { id: 'overview', label: 'Identity & Copy' },
    { id: 'media', label: 'Media & Gallery' },
    { id: 'pillars', label: 'Feature Pillars' },
    { id: 'platforms', label: 'Platform Badges' },
    { id: 'comparison', label: 'Comparison Matrix' },
    { id: 'faqs', label: 'FAQs Builder' },
    { id: 'guide', label: 'Setup Guide' },
    { id: 'seo', label: 'Google SEO & Preview' }
  ];

  return (
    <form className="editor-form" onSubmit={handleSave}>
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '18px', overflowX: 'auto', flexWrap: 'wrap' }}>
        {navTabs.map(t => (
          <button
            key={t.id}
            type="button"
            className={`button ${activeTab === t.id ? 'primary' : 'secondary'} small`}
            onClick={() => setActiveTab(t.id as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-grid">
            <Field label="Agent Name"><input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} placeholder="e.g. Voro" /></Field>
            <Field label="URL Slug" hint="Lowercase words separated by hyphens"><input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. voro" /></Field>
            <Field label="Category" hint="Locked: Platform type reserved for future multi-platform expansion">
              <div>
                <select value={categoryId} disabled style={{ opacity: 0.7, cursor: 'not-allowed', background: 'rgba(255,255,255,0.03)' }}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>🔒 Locked (Desktop Apps)</span>
              </div>
            </Field>
            <Field label="Sub-heading / Agent Role" hint="Displayed on customer agent cards & detail pages">
              <input value={subHeading} onChange={e => setSubHeading(e.target.value)} placeholder="e.g. Interview Assistant" />
            </Field>
          </div>
          <Field label="Tagline / Short Introduction"><input value={tagline} onChange={e => setTagline(e.target.value)} required minLength={3} maxLength={140} placeholder="e.g. Real-time AI interview assistant & coding copilot" /></Field>
          <Field label="Full Overview Description"><textarea value={description} onChange={e => setDescription(e.target.value)} required minLength={10} maxLength={2000} rows={4} placeholder="Comprehensive description of what this agent does and who it's for..." /></Field>
          <div className="panel" style={{ background: 'var(--surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Card Highlights &amp; Feature Pills</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-light)' }}>
                  These quick badges appear directly on the agent card on the homepage and catalog (e.g. Invisible on Zoom &amp; Meet). You can add, edit, or remove pills below.
                </p>
              </div>
              <button
                type="button"
                className="button primary small"
                onClick={() => setFeaturePills([...featurePills, ''])}
              >
                <Plus size={14} /> Add Card Pill
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {featurePills.map((pill, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '20px', textAlign: 'center' }}>{idx + 1}.</span>
                  <input
                    value={pill}
                    onChange={e => setFeaturePills(featurePills.map((item, i) => i === idx ? e.target.value : item))}
                    placeholder="e.g. Invisible on Zoom & Meet"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setFeaturePills(featurePills.filter((_, i) => i !== idx))}
                    title="Remove pill"
                    aria-label={`Remove pill ${idx + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!featurePills.length && (
                <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                  No card pills configured. Click "Add Card Pill" above to add one.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'media' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="panel" style={{ background: 'var(--surface)' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Agent Icon / Logo</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', background: '#000' }} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={20} /></div>}
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], setLogoUrl); }} />
                <input style={{ marginTop: '6px' }} value={logoUrl || ''} onChange={e => setLogoUrl(e.target.value)} placeholder="Or paste public logo URL" />
              </div>
            </div>
          </div>

          <div className="panel" style={{ background: 'var(--surface)' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Hero Demo Media (Video / GIF / Image)</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-light)' }}>
              This displays prominently in the public hero section (like Parakeet.ai's animated video showcase).
            </p>
            <div className="form-grid">
              <Field label="Media Type">
                <select value={heroType} onChange={e => setHeroType(e.target.value as any)}>
                  <option value="video">MP4 / WebM Video</option>
                  <option value="gif">Animated GIF</option>
                  <option value="image">Still Screenshot (PNG / WebP)</option>
                </select>
              </Field>
              <Field label="Upload File">
                <input type="file" accept="video/mp4,video/webm,image/*" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], setHeroUrl); }} />
              </Field>
            </div>
            <Field label="Hero Media URL (YouTube link, MP4 video, or Image URL)">
              <input value={heroUrl} onChange={e => setHeroUrl(e.target.value)} placeholder="e.g. https://youtu.be/... or https://..." />
            </Field>
            <Field label="Hero Badge Text (e.g. ⚡ Real-Time HUD Overlay)">
              <input value={badgeText} onChange={e => setBadgeText(e.target.value)} placeholder="e.g. ⚡ Real-Time HUD Overlay" />
            </Field>
            {heroUrl && (
              <div style={{ marginTop: '10px', background: '#000', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {heroType === 'video' || parseYouTubeVideoId(heroUrl) ? (
                  <SmartVideoPlayer url={heroUrl} showExternalLink={false} />
                ) : (
                  <img src={heroUrl} alt="Preview" style={{ maxHeight: '160px', objectFit: 'contain' }} />
                )}
              </div>
            )}
          </div>

          <div className="panel" style={{ background: 'var(--surface)' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Walkthrough Section</h4>
            <Field label="Walkthrough Heading"><input value={workflowHeading} onChange={e => setWorkflowHeading(e.target.value)} placeholder="Built for your workflow." /></Field>
            <Field label="Walkthrough Description"><textarea rows={2} value={workflowDescription} onChange={e => setWorkflowDescription(e.target.value)} placeholder="How this agent fits into the user's daily operations..." /></Field>
            <div className="form-grid">
              <Field label="Walkthrough Media File">
                <input type="file" accept="video/mp4,video/webm,image/*" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], setWorkflowMediaUrl); }} />
              </Field>
              <Field label="Walkthrough Media URL (YouTube link, MP4, or Image)">
                <input value={workflowMediaUrl || ''} onChange={e => setWorkflowMediaUrl(e.target.value)} placeholder="e.g. https://youtu.be/... or https://..." />
              </Field>
            </div>
            {workflowMediaUrl && (
              <div style={{ marginTop: '10px', background: '#000', borderRadius: '6px', overflow: 'hidden' }}>
                <SmartVideoPlayer url={workflowMediaUrl} showExternalLink={false} />
              </div>
            )}
            <Field label="Walkthrough Note (optional)"><input value={workflowNote} onChange={e => setWorkflowNote(e.target.value)} placeholder="e.g. Windows installer includes auto-updater" /></Field>
          </div>

          <div className="panel" style={{ background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0 }}>Screenshot & Demo Gallery</h4>
              <button type="button" className="button secondary small" onClick={() => setGallery([...gallery, { id: 'gallery-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type: 'image', url: '', caption: '' }])}>
                <Plus size={14} /> Add Gallery Item
              </button>
            </div>
            {!gallery.length ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>No gallery items added yet. Click above to add screenshots or demo clips.</p>
            ) : (
              gallery.map((g, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', background: 'var(--background)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <select value={g.type} onChange={e => setGallery(gallery.map((item, i) => i === idx ? { ...item, type: e.target.value as any } : item))} style={{ width: 90 }}>
                    <option value="image">Image</option>
                    <option value="gif">GIF</option>
                    <option value="video">Video</option>
                  </select>
                  <input style={{ flex: 1, minWidth: 140 }} value={g.url} onChange={e => setGallery(gallery.map((item, i) => i === idx ? { ...item, url: e.target.value } : item))} placeholder="Media URL or upload file" />
                  <input type="file" style={{ width: 130 }} onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], url => setGallery(gallery.map((item, i) => i === idx ? { ...item, url } : item))); }} />
                  <input style={{ flex: 1, minWidth: 120 }} value={g.caption || ''} onChange={e => setGallery(gallery.map((item, i) => i === idx ? { ...item, caption: e.target.value } : item))} placeholder="Caption" />
                  <button type="button" className="icon-button" onClick={() => setGallery(gallery.filter((_, i) => i !== idx))} title="Delete item"><Trash2 size={16} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'pillars' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>
              Feature pillars display as high-impact cards on the public page with custom category tags and icons.
            </p>
            <button type="button" className="button primary small" onClick={() => setFeaturePillars([...featurePillars, { id: 'pillar-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), title: '', tag: '', icon: 'Shield', description: '' }])}>
              <Plus size={14} /> Add Feature Pillar
            </button>
          </div>
          {!featurePillars.length ? (
            <p style={{ padding: '20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 8, color: 'var(--text-light)' }}>No feature pillars configured yet.</p>
          ) : (
            featurePillars.map((p, idx) => (
              <div key={idx} className="panel" style={{ background: 'var(--surface)', padding: '14px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <button type="button" className="icon-button" onClick={() => setFeaturePillars(featurePillars.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
                </div>
                <div className="form-grid">
                  <Field label="Pillar Title"><input value={p.title} onChange={e => setFeaturePillars(featurePillars.map((item, i) => i === idx ? { ...item, title: e.target.value } : item))} placeholder="e.g. Invisible Screen OCR" required /></Field>
                  <Field label="Category Tag"><input value={p.tag || ''} onChange={e => setFeaturePillars(featurePillars.map((item, i) => i === idx ? { ...item, tag: e.target.value } : item))} placeholder="e.g. Anti-Detection" /></Field>
                  <Field label="Icon">
                    <select value={p.icon || 'Shield'} onChange={e => setFeaturePillars(featurePillars.map((item, i) => i === idx ? { ...item, icon: e.target.value } : item))}>
                      {['Shield', 'Code', 'Bot', 'Sparkles', 'Cpu', 'Eye', 'Check', 'Zap', 'Globe', 'Layers'].map(ic => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Description"><textarea rows={2} value={p.description} onChange={e => setFeaturePillars(featurePillars.map((item, i) => i === idx ? { ...item, description: e.target.value } : item))} placeholder="Detailed explanation of how this capability works..." required /></Field>
                <div className="form-grid" style={{ marginTop: '10px' }}>
                  <Field label="Upload Demo Media (Video / GIF / Image)" hint="Upload MP4, WebM, or PNG/JPG">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,image/*"
                      onChange={e => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(e.target.files[0], url => {
                            setFeaturePillars(featurePillars.map((item, i) => i === idx ? { ...item, mediaUrl: url } : item));
                          });
                        }
                      }}
                    />
                  </Field>
                  <Field label="Or Paste Media URL" hint="YouTube link or direct video/image URL">
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={p.mediaUrl || ''}
                        onChange={e => setFeaturePillars(featurePillars.map((item, i) => i === idx ? { ...item, mediaUrl: e.target.value } : item))}
                        placeholder="e.g. https://youtu.be/... or https://..."
                      />
                      {p.mediaUrl && (
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => setFeaturePillars(featurePillars.map((item, i) => i === idx ? { ...item, mediaUrl: undefined } : item))}
                          title="Remove media"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </Field>
                </div>
                {p.mediaUrl && (
                  <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--lime)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={14} /> Attached Media Preview (Customers view in detail modal):
                    </div>
                    {/\.(mp4|webm)$/i.test(p.mediaUrl) || /youtube\.com|youtu\.be/i.test(p.mediaUrl) ? (
                      <div style={{ maxWidth: '400px', maxHeight: '220px', overflow: 'hidden', borderRadius: '4px' }}>
                        <SmartVideoPlayer url={p.mediaUrl} showExternalLink={false} autoPlay={false} />
                      </div>
                    ) : (
                      <img src={p.mediaUrl} alt={p.title} style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px', objectFit: 'contain' }} />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'platforms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>
            Add platforms, video conferencing apps, or operating systems that this agent integrates with.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: 40, padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
            {!platformBadges.length ? <span style={{ color: 'var(--text-light)', fontSize: '13px' }}>No badges added. Click below or type custom platforms.</span> : platformBadges.map((badge, idx) => (
              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--background)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 16, fontSize: '12px' }}>
                <Check size={12} color="var(--accent)" /> {badge}
                <button type="button" onClick={() => setPlatformBadges(platformBadges.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={13} /></button>
              </span>
            ))}
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: 6, display: 'block' }}>Quick Add Common Badges:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Windows 11', 'macOS', 'Zoom', 'Microsoft Teams', 'Google Meet', 'HackerRank', 'LeetCode', 'LinkedIn', 'Indeed', 'Chrome'].map(b => (
                <button key={b} type="button" className="button secondary small" onClick={() => { if (!platformBadges.includes(b)) setPlatformBadges([...platformBadges, b]); }}>
                  + {b}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <input value={newBadgeText} onChange={e => setNewBadgeText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newBadgeText.trim() && !platformBadges.includes(newBadgeText.trim())) { setPlatformBadges([...platformBadges, newBadgeText.trim()]); setNewBadgeText(''); } } }} placeholder="Add custom platform (press Enter)" style={{ flex: 1 }} />
            <button type="button" className="button secondary" onClick={() => { if (newBadgeText.trim() && !platformBadges.includes(newBadgeText.trim())) { setPlatformBadges([...platformBadges, newBadgeText.trim()]); setNewBadgeText(''); } }}>Add</button>
          </div>
        </div>
      )}

      {activeTab === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>
            Build a side-by-side comparison matrix showing why your agent outperforms competitors (e.g. Voro vs Parakeet.ai).
          </p>
          <div className="form-grid">
            <Field label="Section Headline"><input value={comparisonHeadline} onChange={e => setComparisonHeadline(e.target.value)} placeholder={`e.g. Why Candidates Choose ${name || 'Our Agent'}`} /></Field>
            <Field label="Competitor 1 Name"><input value={competitor1Name} onChange={e => setCompetitor1Name(e.target.value)} placeholder="e.g. Parakeet.ai" /></Field>
            <Field label="Competitor 2 Name (optional)"><input value={competitor2Name} onChange={e => setCompetitor2Name(e.target.value)} placeholder="e.g. Generic ChatGPT" /></Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px' }}>Feature Comparison Rows</h4>
            <button type="button" className="button secondary small" onClick={() => setComparisonRows([...comparisonRows, { feature: '', us: 'Yes', comp1: 'No', comp2: 'No' }])}>
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.3fr 1.3fr 1.3fr 36px', gap: 8, padding: '0 8px', fontSize: '12px', color: 'var(--text-light)', fontWeight: 600 }}>
            <span>Feature / Capability</span>
            <span style={{ color: 'var(--accent)' }}>Our Agent ({name || 'Voro'})</span>
            <span>{competitor1Name || 'Competitor 1'}</span>
            <span>{competitor2Name || 'Competitor 2'}</span>
            <span></span>
          </div>

          {!comparisonRows.length ? <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>No rows yet. Click above to add feature comparisons.</p> : (
            comparisonRows.map((r, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.3fr 1.3fr 1.3fr 36px', gap: 8, alignItems: 'center', background: 'var(--surface)', padding: 8, borderRadius: 6 }}>
                <input value={r.feature} onChange={e => setComparisonRows(comparisonRows.map((item, i) => i === idx ? { ...item, feature: e.target.value } : item))} placeholder="Feature name (e.g. Invisible Screen OCR)" />
                <input value={String(r.us)} onChange={e => setComparisonRows(comparisonRows.map((item, i) => i === idx ? { ...item, us: e.target.value } : item))} placeholder="Our value (e.g. Yes - 100% Private)" />
                <input value={String(r.comp1)} onChange={e => setComparisonRows(comparisonRows.map((item, i) => i === idx ? { ...item, comp1: e.target.value } : item))} placeholder={`${competitor1Name || 'Competitor 1'} value`} />
                <input value={String(r.comp2 ?? '')} onChange={e => setComparisonRows(comparisonRows.map((item, i) => i === idx ? { ...item, comp2: e.target.value } : item))} placeholder={`${competitor2Name || 'Competitor 2'} value`} />
                <button type="button" className="icon-button" onClick={() => setComparisonRows(comparisonRows.filter((_, i) => i !== idx))} title="Delete row"><Trash2 size={16} /></button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'faqs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>
              These FAQs appear as expandable accordions on the public page and automatically generate Google FAQ rich snippets!
            </p>
            <button type="button" className="button primary small" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}>
              <Plus size={14} /> Add FAQ
            </button>
          </div>
          {!faqs.length ? <p style={{ fontSize: '13px', color: 'var(--text-light)', textAlign: 'center', padding: 20 }}>No FAQs added yet.</p> : (
            faqs.map((f, idx) => (
              <div key={idx} className="panel" style={{ background: 'var(--surface)', padding: 12, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                  <button type="button" className="icon-button" onClick={() => setFaqs(faqs.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
                </div>
                <Field label="Question"><input value={f.question} onChange={e => setFaqs(faqs.map((item, i) => i === idx ? { ...item, question: e.target.value } : item))} placeholder="e.g. Can Zoom or interviewers detect Voro?" required /></Field>
                <Field label="Answer"><textarea rows={2} value={f.answer} onChange={e => setFaqs(faqs.map((item, i) => i === idx ? { ...item, answer: e.target.value } : item))} placeholder="e.g. No. Voro runs in kernel-isolated memory with virtual audio loops..." required /></Field>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'guide' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="panel" style={{ background: 'var(--surface)' }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Agent Walkthrough & Setup Video</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-light)' }}>
              Add a YouTube video link or direct MP4/WebM video URL. Customers who own this agent can watch the full setup video here.
            </p>
            <div className="form-grid">
              <Field label="Video URL (YouTube or direct video file)">
                <input
                  value={guideVideoUrl}
                  onChange={e => setGuideVideoUrl(e.target.value)}
                  placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
                />
              </Field>
              <Field label="Or Upload Video File">
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], setGuideVideoUrl); }}
                />
              </Field>
            </div>
            {guideVideoUrl && (
              <div style={{ marginTop: '12px', maxWidth: '480px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>Video Preview:</span>
                <SmartVideoPlayer url={guideVideoUrl} title="Guide Video Preview" />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0 }}>Step-by-Step Guide Sections</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-light)' }}>
                Create sequential setup steps for your customers. Add clear headings, explanations, and optional screenshots.
              </p>
            </div>
            <button
              type="button"
              className="button primary small"
              onClick={() => setGuideSections([
                ...guideSections,
                { id: 'section-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), heading: '', content: '', imageUrl: null }
              ])}
            >
              <Plus size={14} /> Add Guide Section
            </button>
          </div>

          {!guideSections.length ? (
            <p style={{ fontSize: '13px', color: 'var(--text-light)', textAlign: 'center', padding: '30px 20px', background: 'var(--surface)', borderRadius: '8px' }}>
              No guide sections added yet. Click "+ Add Guide Section" above to create step-by-step instructions.
            </p>
          ) : (
            guideSections.map((s, idx) => (
              <div key={s.id || idx} className="panel" style={{ background: 'var(--surface)', padding: '16px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <button
                    type="button"
                    className="icon-button"
                    title="Delete section"
                    onClick={() => setGuideSections(guideSections.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span className="badge good" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Section {idx + 1}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Field label="Section Heading">
                    <input
                      value={s.heading}
                      onChange={e => setGuideSections(guideSections.map((item, i) => i === idx ? { ...item, heading: e.target.value } : item))}
                      placeholder="e.g. Step 1: Download & Extract Files"
                      required
                    />
                  </Field>
                  <Field label="Section Instructions / Details">
                    <textarea
                      rows={3}
                      value={s.content}
                      onChange={e => setGuideSections(guideSections.map((item, i) => i === idx ? { ...item, content: e.target.value } : item))}
                      placeholder="e.g. Download the package to your desktop, right-click, and select 'Extract All'..."
                      required
                    />
                  </Field>
                  <div className="panel" style={{ background: 'var(--background)', padding: '12px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                      Section Image (Optional)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <input
                        style={{ flex: 1, minWidth: '220px' }}
                        value={s.imageUrl || ''}
                        onChange={e => setGuideSections(guideSections.map((item, i) => i === idx ? { ...item, imageUrl: e.target.value || null } : item))}
                        placeholder="Paste image URL (https://...) or upload file"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        style={{ width: 'auto' }}
                        onChange={e => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(e.target.files[0], url => {
                              setGuideSections(guideSections.map((item, i) => i === idx ? { ...item, imageUrl: url } : item));
                            });
                          }
                        }}
                      />
                      {s.imageUrl && (
                        <button
                          type="button"
                          className="text-button bare"
                          style={{ color: 'var(--error)', fontSize: '12px' }}
                          onClick={() => setGuideSections(guideSections.map((item, i) => i === idx ? { ...item, imageUrl: null } : item))}
                        >
                          Remove image
                        </button>
                      )}
                    </div>
                    {s.imageUrl && (
                      <div style={{ marginTop: '10px', maxHeight: '140px', overflow: 'hidden', borderRadius: '4px', border: '1px solid var(--border)', display: 'inline-block' }}>
                        <img src={s.imageUrl} alt="Section preview" style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'seo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Live Google SERP Simulator</span>
            <span style={{ fontSize: '11px', color: 'var(--accent)' }}>Updates live as you type</span>
          </div>

          <div style={{ background: '#202124', border: '1px solid #3c4043', borderRadius: '8px', padding: '16px', color: '#e8eaed', fontFamily: 'arial, sans-serif' }}>
            <div style={{ fontSize: '12px', color: '#bdc1c6', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '4px' }}>
              <Globe size={14} color="#8ab4f8" />
              <span>https://nor-vi.in › agents › {slug || 'agent'}</span>
            </div>
            <div style={{ fontSize: '18px', color: '#8ab4f8', fontWeight: 500, lineHeight: 1.3, marginBottom: '6px', cursor: 'pointer', textDecoration: 'underline' }}>
              {metaTitle || `${name || 'Agent'} - ${tagline || 'AI Assistant'} | NORVI`}
            </div>
            <div style={{ fontSize: '12px', color: '#f28b82', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '6px' }}>
              <span style={{ color: '#fbbc04' }}>★★★★★</span>
              <span style={{ color: '#bdc1c6' }}>Rating: 4.9 · ‎128 reviews · ‎Free trial available</span>
            </div>
            <div style={{ fontSize: '14px', color: '#bdc1c6', lineHeight: 1.5 }}>
              {metaDescription || description || 'Explore high-performing autonomous AI agents on NORVI.'}
            </div>
          </div>

          <Field label={`SEO Meta Title (${(metaTitle || `${name} - ${tagline} | NORVI`).length}/60 chars)`} hint="Google cuts off titles beyond 60 characters">
            <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="e.g. Voro - #1 Real-Time AI Interview Assistant & Coding Copilot" />
          </Field>
          <Field label={`SEO Meta Description (${(metaDescription || description).length}/160 chars)`} hint="Recommended: 140-160 characters with focus keywords">
            <textarea rows={3} value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder="e.g. Master your live technical and behavioral interviews with Voro: the undetectable AI interview assistant with screen-aware OCR. Try free." />
          </Field>
          <Field label="Focus Target Keywords (comma-separated)" hint="Used for indexing and semantic search rank">
            <input value={focusKeywords} onChange={e => setFocusKeywords(e.target.value)} placeholder="e.g. interview assistant agent, ai coding copilot, parakeet ai alternative" />
          </Field>
          <Field label="Social Share Image (OG Image URL)">
            <input value={ogImage} onChange={e => setOgImage(e.target.value)} placeholder="https://..." />
          </Field>
        </div>
      )}


      {error && <Notice kind="error">{error}</Notice>}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? 'Saving...' : 'Save Agent Content'}<Check size={16} />
        </button>
      </div>
    </form>
  );
}
export function CategoriesAdmin({ categories, onSave }: { categories: Category[]; onSave: () => void }) {
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [error, setError] = useState('');
  
  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await api('/admin/categories/' + id, { method: 'DELETE' });
      onSave();
    } catch (e: any) { alert(e.message); }
  };

  return <div className="panel">
    <div className="panel-heading">
      <h3>Categories</h3>
      <button className="button primary button-small" onClick={() => setEditing(null)}>Add category</button>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Slug</th><th>Actions</th></tr></thead>
        <tbody>
          {categories.map(c => <tr key={c.id}>
            <td><b>{c.name}</b></td>
            <td>{c.slug}</td>
            <td>
              <button className="text-button bare" onClick={() => setEditing(c)}>Edit</button>
              <button className="text-button bare" onClick={() => deleteCategory(c.id)}>Delete</button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {editing !== undefined && <Modal title={editing ? 'Edit category' : 'Add category'} onClose={() => setEditing(undefined)}>
      <form onSubmit={async e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        try {
          await api('/admin/categories', { method: 'POST', body: JSON.stringify({ ...d, id: editing?.id }) });
          setEditing(undefined);
          onSave();
        } catch (e: any) { setError(e.message); }
      }}>
        <Field label="Category name"><input name="name" required defaultValue={editing?.name} /></Field>
        <Field label="URL slug"><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={editing?.slug} /></Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button className="button primary">Save category</button>
      </form>
    </Modal>}
  </div>;
}

export function RolePermissionsAdmin({ settings, onSave }: { settings: Settings; onSave: () => void }) {
  const [permissions, setPermissions] = useState(settings.permissions || { "support": ["/customers", "/licenses", "/orders"], "product_manager": ["/products", "/releases", "/content"], "administrator": ["/products", "/releases", "/customers", "/licenses", "/orders", "/subscriptions", "/team", "/content", "/settings", "/activity"] });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const roles = ['administrator', 'product_manager', 'support'];
  const sections = Object.fromEntries(staffNav.filter(s => s[0] !== '').map(s => [s[0], s[1]]));
  const toggle = (role: string, path: string) => {
    setPermissions(p => {
      const paths = p[role] || [];
      const updated = paths.includes(path) ? paths.filter(x => x !== path) : [...paths, path];
      return { ...p, [role]: [...new Set(['', ...updated])] };
    });
  };
  return <form className="panel" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await api('/admin/permissions', { method: 'PATCH', body: JSON.stringify(permissions) }); setMessage('Permissions saved successfully.'); onSave(); } catch(e: any) { setMessage(e.message); } setBusy(false); }}>
    <h3>Dynamic Role Permissions</h3>
    <p>Configure exactly which dashboard sections each role is allowed to access.</p>
    <div className="table-wrap"><table>
      <thead><tr><th>Section</th>{roles.map(r => <th key={r}>{r.replace('_', ' ')}</th>)}</tr></thead>
      <tbody>
        {Object.entries(sections).map(([path, label]) => <tr key={path}>
          <td><b>{label as string}</b></td>
          {roles.map(role => <td key={role}><input type="checkbox" checked={(permissions[role] || []).includes(path)} onChange={() => toggle(role, path)} /></td>)}
        </tr>)}
      </tbody>
    </table></div>
    <button className="button primary" disabled={busy}>Save permissions</button>
    {message && <Notice>{message}</Notice>}
  </form>;
}

export function SettingsForm({ initial, contentOnly = false, onSave }: { initial: Settings; contentOnly?: boolean; onSave: () => void }) { const [message, setMessage] = useState(''); return <form className="panel settings-form" onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); const d = { ...Object.fromEntries(form), maintenanceMode: form.get('maintenanceMode') === 'on' }; try { await api(contentOnly ? '/admin/content' : '/admin/settings', { method: 'PATCH', body: JSON.stringify(contentOnly ? d : { ...initial, ...d }) }); setMessage('Saved. Your website preview has been updated.'); onSave(); } catch (e: any) { setMessage(e.message); } }}><h3>{contentOnly ? 'Homepage copy' : 'Business details'}</h3>{!contentOnly && <div className="form-grid"><Field label="Website name"><input name="name" required defaultValue={initial.name} /></Field><Field label="Company name"><input name="company" defaultValue={initial.company} /></Field><Field label="Support email"><input name="email" defaultValue={initial.email} /></Field><Field label="Website domain"><input name="domain" defaultValue={initial.domain} /></Field></div>}<Field label="Homepage headline" hint="Use a new line to split the headline."><textarea name="headline" required rows={2} defaultValue={initial.headline} /></Field><Field label="Homepage description"><textarea name="description" required rows={3} defaultValue={initial.description} /></Field>{!contentOnly && <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '20px 0', background: 'var(--surface)', padding: 15, borderRadius: 8, border: '1px solid var(--border)' }}><input type="checkbox" name="maintenanceMode" defaultChecked={initial.maintenanceMode} style={{ width: 18, height: 18 }} /><div><b>Maintenance Mode</b><p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)' }}>When enabled, checkout and downloads are temporarily disabled for customers.</p></div></label>}<button className="button primary">Save changes <Check size={16} /></button>{message && <Notice>{message}</Notice>}</form>; }
function Team({ data, onAction, isOwner, settings }: { data: any; onAction: (path: string, body?: object, method?: string) => Promise<void>; isOwner: boolean; settings: Settings }) { return <><div className="panel"><h3>Your team</h3>{(data?.items || []).map((u: User) => <div className="list-row" key={u.id}><span className="avatar">{u?.name?.slice(0, 1) || '?'}</span><div className="grow" style={{ flex: 1, minWidth: 0 }}><b>{u?.name || 'Unnamed'}</b><p>{u?.email}</p></div>{u.role === 'owner' ? <Badge>Owner</Badge> : <select style={{ width: "auto", flex: "0 0 auto" }} value={u.role} onChange={(e) => onAction('/admin/team/' + u.id + '/role', { role: e.target.value })}><option value="support">Support</option><option value="product_manager">Product Manager</option><option value="administrator">Administrator</option></select>}<Badge>{u.status || 'active'}</Badge>{u.role !== 'owner' && <div style={{ display: 'flex', gap: 8 }}><button className="text-button bare" onClick={() => onAction('/admin/team/' + u.id + '/suspend')}>{u.status !== 'suspended' ? 'Suspend' : 'Restore'}</button>{isOwner && <button className="text-button bare" onClick={async () => { await onAction('/admin/impersonate', { id: u.id }); window.location.href = '/admin'; }}>Login As</button>}</div>}</div>)}</div><form className="panel" onSubmit={async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); await onAction('/admin/team/invite', d); }}><h3>Invite a teammate</h3><p>Send an invitation with a secure, expiring acceptance link.</p><div className="form-grid"><Field label="Teammate email"><input name="email" type="email" required /></Field><Field label="Role"><select name="role"><option value="support">Support</option><option value="product_manager">Product manager</option><option value="administrator">Administrator</option></select></Field></div><button className="button primary">Send invitation <Plus size={16} /></button></form><div className="panel"><h3>Pending invitations</h3>{!(data?.invitations || []).length ? <p>No pending invitations.</p> : (data?.invitations || []).map((i: any) => <div className="list-row" key={i.id}><span className="grow">{i.email}</span><Badge>{(i?.role || '').replace('_', ' ')}</Badge><Badge>Pending</Badge><button className="text-button bare" onClick={() => onAction('/admin/team/invite/' + i.id + '/resend')}>Resend</button><button className="text-button bare" onClick={() => onAction('/admin/team/invite/' + i.id, {}, 'DELETE')}>Cancel</button></div>)}</div>{isOwner && <RolePermissionsAdmin settings={settings} onSave={() => onAction('')} />}</>; }
export function OrderStatus() { const { data, error } = useData('/account'); const [orderId, setOrderId] = useState(''); useEffect(() => { setOrderId(new URLSearchParams(location.search).get('id') || ''); }, []); if (error) return <div className="container page"><Notice kind="error">{error}</Notice><a href="/login" className="button primary">Open account</a></div>; if (!data) return <Loading />; const order = data.orders.find((o: any) => o.id === orderId); return <div className="container page order-success">{order ? <><span className="success-symbol"><Check size={36} /></span><span className="eyebrow">ORDER CONFIRMED</span><h1>A little more possibility.<br />Now in your account.</h1><p>Your license key has been generated and dispatched to your account.</p><div className="panel"><div className="summary-row"><span>Order reference</span><code>#{order.id.slice(0, 8)}</code></div><div className="summary-row"><span>Amount charged</span><b>{order.amount || 'Verified Payment'}</b></div><div className="summary-row"><span>Order status</span><Badge>{order.status || 'paid'}</Badge></div></div><a href="/account/licenses" className="button primary">View your activation key <KeyRound size={18} /></a><a href="/account" className="text-button">Go to dashboard <ArrowRight size={16} /></a></> : <Empty title="Select an order from your account." description="Order details are private to the customer who placed them." href="/account/billing" label="View billing" />}</div>; }
function CopyButton({ text }: { text: string }) { const [message, setMessage] = useState('Copy key'); return <button className="button primary" onClick={async () => { try { await navigator.clipboard.writeText(text); setMessage('Copied'); } catch { setMessage('Select the key above to copy'); } }}>{message}<Copy size={16} /></button>; }
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); const prior = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prior; }; }, []); return <dialog ref={ref} className={'modal ' + (wide ? 'wide' : '')} onCancel={e => { e.preventDefault(); onClose(); }} aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} className="icon-button" aria-label="Close dialog"><X size={22} /></button></div>{children}</dialog>; }

function AccountDeletion() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function handleDelete() {
    if (!confirm('Are you absolutely sure you want to delete your account? This action is irreversible and will immediately log you out. All licenses and data will be permanently destroyed.')) return;
    setBusy(true); setError('');
    try {
      const result = await api('/auth/account', { method: 'DELETE' });
      if (result.ok) location.href = '/';
      else setError('Failed to delete account.');
    } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return <div className="panel"><ShieldCheck className="accent" /><h3>Privacy & Data</h3><p>Request an export of your personal data or permanently delete your account.</p><button className="button secondary" onClick={() => alert('Data export will be sent to your email.')}>Request data export</button><div style={{marginTop: '1rem'}}><button className="button secondary" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={busy} onClick={handleDelete}>{busy ? 'Deleting...' : 'Delete account'}</button></div>{error && <Notice kind="error">{error}</Notice>}</div>;
}
