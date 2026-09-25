import { LiveAdmin } from './Accounts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, BookOpen, Box, Check, Copy, CreditCard, Download, Eye, FileText, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Plus, Search, Settings as SettingsIcon, ShieldCheck, Users, X, Monitor, SlidersHorizontal, Mail } from 'lucide-react';
import type { Category, Product, Settings, User } from '../../../../packages/shared/model';
import { ProductCard, ProductIcon } from './App';
import { api, Badge, date, Empty, Field, Loading, Notice, PageHeading, uploadFile, useData } from './common';
const customerNav = [['', 'Overview', LayoutDashboard], ['/agents', 'My agents', Box], ['/licenses', 'Keys & devices', KeyRound], ['/billing', 'Billing & orders', CreditCard], ['/support', 'Support', LifeBuoy], ['/settings', 'Profile & security', SettingsIcon]] as const;
const staffNav = [['', 'Overview', LayoutDashboard], ['/products', 'Products & releases', Box], ['/categories', 'Categories', Box], ['/customers', 'Customers', Users], ['/licenses', 'Licenses', KeyRound], ['/orders', 'Orders', CreditCard], ['/subscriptions', 'Subscriptions', Activity], ['/team', 'Team', Users], ['/announcements', 'Announcements', Mail], ['/content', 'Content', FileText], ['/activity', 'Audit & delivery', Activity], ['/settings', 'Settings', SettingsIcon]] as const;
const allowed: Record<string, string[]> = { owner: ['*'], administrator: ['', '/products', '/categories', '/customers', '/licenses', '/orders', '/subscriptions', '/announcements', '/content', '/activity'], product_manager: ['', '/products', '/categories', '/announcements', '/content'], support: ['', '/customers', '/licenses', '/orders', '/announcements'] };
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
  const adminLinks = [ { name: 'Go to Products', path: '/admin/products' }, { name: 'Go to Customers', path: '/admin/customers' }, { name: 'Go to Licenses', path: '/admin/licenses' }, { name: 'Go to Orders', path: '/admin/orders' }, { name: 'Go to Settings', path: '/admin/settings' } ].filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
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
    if (!identity) return <Loading />; if(identity.mfaRequired) return <div className="container page"><Notice>Complete authenticator verification to access your account.</Notice><a className="button primary" href="/account/security">Open account security</a></div>; const user: User = identity.user; if (admin && user.role === 'customer') return <div className="container page"><Notice kind="error">This account has no staff permissions.</Notice><a href="/admin/login" className="button secondary">Open staff preview</a></div>;
    const pMap = settings?.permissions || allowed;
    const nav = admin ? staffNav.filter(([slug]) => user.role === 'owner' || pMap[user.role]?.includes('*') || pMap[user.role]?.includes(slug)) : customerNav;
    const sectionAllowed = !admin || user.role === 'owner' || pMap[user.role]?.includes('*') || pMap[user.role]?.includes(section);
    return <div className="workspace"><CommandPalette user={user} /><aside className="sidebar"><div className="workspace-label">{admin ? 'AGENCY WORKSPACE' : 'PERSONAL WORKSPACE'}</div><nav aria-label="Workspace navigation">{nav.map(([slug, label, Icon]) => <a key={slug} href={base + slug} className={section === slug ? 'selected' : ''}><Icon size={18} />{label}{section === slug && <span className="nav-indicator" />}</a>)}</nav><div className="sidebar-bottom"><div className="preview-box"><ShieldCheck size={18} /><b>{identity.preview ? 'Local preview' : 'NORVI account'}</b><p>{identity.preview ? 'Sample data. No live payments or emails.' : 'Verified account. Sales are not open yet.'}</p></div><a href="/" className="text-button">Back to website <ArrowUpRight size={15} /></a><button className="logout" onClick={async () => { try { await api('/auth/logout', { method: 'POST' }); location.href = admin ? '/admin/login' : '/login'; } catch (e: any) { setLogoutError(e.message); } }}><LogOut size={16} />{identity.preview ? 'Sign out of preview' : 'Sign out'}</button>{logoutError && <Notice kind="error">{logoutError}</Notice>}</div></aside><div className="workspace-main">
        {(user as any).isImpersonated && <div style={{ background: '#f59e0b', color: 'black', padding: '12px 24px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>You are currently impersonating {user.name} ({user.role}).<button className="button primary" onClick={async () => { await api('/admin/impersonate', { method: 'DELETE' }); location.href = '/admin'; }}>Stop Impersonating</button></div>}
        <div className="workspace-topbar"><span>NORVI <span className="slash">/</span> {admin ? 'Agency workspace' : 'My account'}</span><span className="user-chip"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>{user.name}<Badge>{user.role.replace('_', ' ')}</Badge></span></div>{!sectionAllowed ? <Notice kind="error">Your role cannot open this section.</Notice> : admin ? <Admin section={section} user={user} settings={settings} onCatalogChange={onCatalogChange} /> : <Customer section={section} products={products} user={user} />}</div></div>;
}
function Customer({ section, products, user }: { section: string; products: Product[]; user: User }) {
    const { data, error, reload } = useData('/account'); const [feedback, setFeedback] = useState(''), [keyModal, setKeyModal] = useState<{ key: string; name: string } | null>(null); const [announcement, setAnnouncement] = useState<any>(null);
    useEffect(() => { const latest = data?.announcements?.[0]; if (latest && localStorage.getItem('dismissed_announcement') !== latest.id) setAnnouncement(latest); }, [data]);
    if (error) return <Notice kind="error">{error}</Notice>; if (!data) return <Loading />; const licenses = data.licenses as any[], orders = data.orders as any[]; const owned = products.filter(p => licenses.some(l => l.productId === p.id)); const product = (id: string) => products.find(p => p.id === id); async function action(path: string) { try { const result = await api(path, { method: 'POST' }); if (result?.url) { window.location.href = result.url; return; } reload(); return result; } catch (e: any) { setFeedback(e.message); } }
    return <><PageHeading eyebrow="YOUR PERSONAL WORKSPACE" title={section === '' ? 'A little more possibility.' : section === '/agents' ? 'Your agent collection.' : section === '/licenses' ? 'Your keys. Your access.' : section === '/billing' ? 'Everything accounted for.' : section === '/settings' ? 'Make yourself at home.' : 'How can we help?'} description={section === '' ? 'Welcome back, ' + user.name + '. Find everything you need for your next workflow.' : section === '/licenses' ? 'Your product-specific keys, access status, and active devices.' : undefined} />{feedback && <Notice>{feedback}</Notice>}{section === '' && <><div className="stat-grid"><Stat label="Your agents" value={licenses.length} icon={<Box />} /><Stat label="Active licenses" value={licenses.filter(l => l.status === 'active').length} icon={<KeyRound />} /><Stat label="Sample orders" value={orders.length} icon={<CreditCard />} /></div><div className="panel-heading"><h3>Ready for your next workflow</h3><a href="/agents" className="text-button">Explore agents <ArrowUpRight size={16} /></a></div>{!owned.length ? <Empty title="Your collection starts here." description="Explore the agents and simulate your first purchase to see licenses and orders appear here." href="/agents" /> : <div className="product-grid">{owned.map(p => <ProductCard key={p.id} product={p} />)}</div>}<div className="two-column"><div className="panel"><KeyRound className="accent" /><h3>One key. One product.</h3><p>Keep your activation keys private. Your account is always the place to find them.</p><a href="/account/licenses" className="text-button">Manage your keys <ArrowRight size={16} /></a></div><div className="panel"><LifeBuoy className="accent" /><h3>A little help, when you need it.</h3><p>Find the steps for installation, activation, and managing your device.</p><a href="/help" className="text-button">Visit the help center <ArrowRight size={16} /></a></div></div></>}
        {section === '/agents' && (!licenses.length ? <Empty title="No agents in your collection yet." description="Your purchased products and downloads will appear here." href="/agents" /> : <div className="owned-grid">{licenses.map(l => <div className="panel owned-card" key={l.id}>{product(l.productId) && <ProductIcon product={product(l.productId)!} />}<div><h3>{product(l.productId)?.name || 'Archived agent'}</h3><p>Added {date(l.createdAt)}</p></div><Badge>{l.status}</Badge><div className="owned-actions"><a className="button secondary" href="/account/licenses">View license <KeyRound size={16} /></a><button className="button primary" onClick={() => action('/licenses/' + l.id + '/download')}>Download <Download size={16} /></button></div></div>)}</div>)}
        {section === '/licenses' && (!licenses.length ? <Empty title="No activation keys yet." description="Your product-specific keys will appear here after purchases become available." href="/agents" /> : <div className="license-list">{licenses.map(l => <div className="panel" key={l.id}><div className="panel-heading"><h3>{product(l.productId)?.name || 'Archived agent'}</h3><Badge>{l.status}</Badge></div><div className="key-line"><code>NORVI-XXXX-XXXX-XXXX-{l.suffix}</code><button className="button secondary" onClick={async () => { const result = await action('/licenses/' + l.id + '/reveal'); if (result) setKeyModal({ key: result.key, name: product(l.productId)?.name || 'Agent' }); }}><Eye size={16} /> Reveal key</button></div><div className="license-meta" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem'}}><div><span>Issued {date(l.createdAt)}</span><span style={{marginLeft: '1rem'}}>{data.preview === false ? 'Product entitlement' : 'Preview entitlement'}</span></div>{l.devices && l.devices.length > 0 ? l.devices.map((d: any) => <div key={d.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--surface)', borderRadius: '4px'}}><span><Monitor size={15} /> {d.installation_id}</span><button className="text-button bare" onClick={() => action(`/licenses/${l.id}/device-reset?deviceId=${d.id}`)}>Release device <ArrowRight size={15} /></button></div>) : <span><Monitor size={15} /> No devices activated</span>}</div></div>)}</div>)}
        {section === '/billing' && <><Notice>All orders here are simulations. No money has been charged and no recurring billing agreement exists.</Notice><OrderTable items={orders.map(o => ({ ...o, product: product(o.productId)?.name }))} /><div className="panel"><h3>Subscriptions</h3><p>No live subscriptions. Real renewal and cancellation controls require the payment integration.</p></div></>}
        {section === '/settings' && <div className="two-column"><ProfileForm user={user} /><div className="panel"><ShieldCheck className="accent" /><h3>Account security</h3><p>Manage your authenticator and account access.</p><a className="button secondary" href="/account/security">Account security</a></div><AccountDeletion /></div>}
        {section === '/support' && <div className="two-column"><SupportForm onSave={reload} /><div className="panel"><h3>Your requests</h3>{!data.tickets.length ? <p>No requests yet.</p> : data.tickets.map((t: any) => <div className="list-row" key={t.id}><div><b>{t.subject}</b><p>{date(t.createdAt)}</p></div><Badge>{t.status}</Badge></div>)}</div></div>}
        {keyModal && <Modal title={keyModal.name + ' activation key'} onClose={() => setKeyModal(null)}><Notice>This key is synthetic and works only against the local preview API. Keep real activation keys private when live services are connected.</Notice><code className="full-key">{keyModal.key}</code><CopyButton text={keyModal.key} /></Modal>}
        {announcement && <Modal title="Important Announcement" onClose={() => { localStorage.setItem('dismissed_announcement', announcement.id); setAnnouncement(null); }}><div style={{ padding: '20px 0', fontSize: '16px', lineHeight: 1.6 }}>{announcement.message}</div><button className="button primary" style={{ width: '100%', marginTop: '20px' }} onClick={() => { localStorage.setItem('dismissed_announcement', announcement.id); setAnnouncement(null); }}>I understand</button></Modal>}
    </>;
}
function Stat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) { return <div className="stat"><div><span>{label}</span>{icon}</div><b>{value}</b><small>Local preview data</small></div>; }
function ProfileForm({ user }: { user: User }) { const [name, setName] = useState(user.name), [message, setMessage] = useState(''); return <form className="panel" onSubmit={async e => { e.preventDefault(); try { await api('/me', { method: 'PATCH', body: JSON.stringify({ name }) }); setMessage('Profile saved.'); } catch (e: any) { setMessage(e.message); } }}><h3>Your profile</h3><Field label="Display name"><input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Email address" hint="Email changes are not supported in this phase."><input value={user.email} disabled /></Field><button className="button primary">Save profile <Check size={16} /></button>{message && <Notice>{message}</Notice>}</form>; }
function SupportForm({ onSave }: { onSave: () => void }) { const [message, setMessage] = useState(''), [busy, setBusy] = useState(false); return <form className="panel" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const d = new FormData(form); setBusy(true); try { await api('/support', { method: 'POST', body: JSON.stringify({ subject: d.get('subject'), message: d.get('message') }) }); setMessage('Request saved in the local preview. No email has been sent.'); form.reset(); onSave(); } catch (e: any) { setMessage(e.message); } setBusy(false); }}><h3>Start a conversation</h3><p>Use sample information while exploring the preview.</p><Field label="Subject"><input name="subject" required minLength={3} maxLength={120} placeholder="What can we help with?" /></Field><Field label="Message"><textarea name="message" required minLength={10} maxLength={3000} rows={5} placeholder="Tell us a little more…" /></Field><button className="button primary" disabled={busy}>Save preview request <ArrowRight size={16} /></button>{message && <Notice>{message}</Notice>}</form>; }
function OrderTable({ items }: { items: any[] }) { return !items.length ? <Empty title="No orders just yet." description="Your purchase history will appear here after checkout." /> : <div className="table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{items.map(o => <tr key={o.id}><td><code>{o.id.slice(0, 8)}</code>{o.customer && <small className="block">{o.customer}</small>}</td><td>{o.product || o.productId}</td><td>{date(o.createdAt)}</td><td>{o.amount}</td><td><Badge>{o.status}</Badge></td></tr>)}</tbody></table></div>; }
function Announcements({ user, items, action }: { user: User; items: any[]; action: (path: string, body?: object, method?: string) => Promise<void> }) { const isOwner = user.role === 'owner'; return <><div className="panel"><h3>Team Announcements</h3>{!items.length ? <p>No internal announcements yet.</p> : items.map(a => <div className="list-row" key={a.id}><Mail size={16} /><div className="grow" style={{ flex: 1, minWidth: 0 }}><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.message}</p></div><span className="small-note">{date(a.createdAt)}</span>{isOwner && <button className="text-button bare" onClick={() => action('/admin/announcements/' + a.id, {}, 'DELETE')}><X size={14}/></button>}</div>)}</div>{isOwner && <form className="panel" onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; await action('/admin/announcements', { audience: 'team', message: new FormData(form).get('message') }); form.reset(); }}><h3>Post an announcement</h3><Field label="Message"><textarea name="message" required minLength={3} rows={3} placeholder="Tell your team what's new..." /></Field><button className="button primary">Broadcast to team</button></form>}</>; }
function exportCsv(filename: string, headers: string[], rows: any[][]) { const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = filename; a.click(); }
function Admin({ section, user, settings, onCatalogChange }: { section: string; user: User; settings: Settings; onCatalogChange: () => void }) {
    const map: Record<string, string> = { '': 'analytics', '/products': 'products', '/categories': 'categories', '/customers': 'customers', '/licenses': 'licenses', '/orders': 'orders', '/subscriptions': 'billing', '/team': 'team', '/announcements': 'announcements/team', '/content': 'content', '/activity': 'activity', '/settings': 'settings' }; const endpoint = section === '' && user.role === 'support' ? 'customers' : map[section] || 'products'; const { data, error, reload } = useData('/admin/' + endpoint); const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [editing, setEditing] = useState<Product | null | undefined>(undefined), [feedback, setFeedback] = useState(''), [licenseAction, setLicenseAction] = useState<{ id: string; action: string } | null>(null), [giftModal, setGiftModal] = useState(false);
    const titles: Record<string, string> = { '': 'Your agency, at a glance.', '/products': 'Your agent collection.', '/customers': 'The people behind the accounts.', '/licenses': 'Access, under your control.', '/orders': 'Every order, in one place.', '/subscriptions': 'Keep track of recurring access.', '/team': 'Good work takes a team.', '/announcements': 'Internal directives.', '/content': 'Make it sound like you.', '/activity': 'A clear record of every change.', '/settings': 'The details that make it yours.' };
    const items = (data?.items || []) as any[]; const filtered = items.filter(item => JSON.stringify(item).toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'nonbuyers' ? item.purchases === 0 : item.status === filter)));
    async function action(path: string, body?: object, method: string = 'POST') { try { await api(path, { method, body: Object.keys(body || {}).length ? JSON.stringify(body) : undefined }); reload(); setFeedback('Action completed successfully.'); } catch (e: any) { setFeedback(e.message); } }
    return <><PageHeading eyebrow={section === '' ? 'WELCOME TO YOUR WORKSPACE' : 'AGENCY MANAGEMENT'} title={titles[section] || 'Workspace'} description={section === '' ? 'Start with the essentials. Build your collection, get to know your customers, and keep things moving.' : undefined} action={section === '/products' ? <button className="button primary" onClick={() => setEditing(null)}><Plus size={17} />Add agent</button> : section === '/customers' ? <button className="button secondary" onClick={() => exportCsv('customers.csv', ['ID', 'Email', 'Name', 'Status', 'Registered'], items.map(u => [u.id, u.email, u.name, u.suspended ? 'suspended' : u.status || 'active', u.createdAt]))}><Download size={17} />Export CSV</button> : section === '/orders' ? <button className="button secondary" onClick={() => exportCsv('orders.csv', ['ID', 'Customer', 'Product', 'Amount', 'Date'], items.map(o => [o.id, o.customer, o.product, o.amount, o.createdAt]))}><Download size={17} />Export CSV</button> : section === '/licenses' && user.role !== 'support' ? <button className="button primary" onClick={() => setGiftModal(true)}><Plus size={17} />Gift License</button> : undefined} />{error ? <Notice kind="error">{error}</Notice> : !data ? <Loading /> : <>{feedback && <Notice>{feedback}</Notice>}
        {section === '' && <><div className="stat-grid"><Stat label="Total Revenue (30d)" value={'₹' + (data?.metrics?.revenue || 0).toLocaleString()} icon={<CreditCard />} /><Stat label="Active Licenses" value={data?.metrics?.activeLicenses || 0} icon={<KeyRound />} /><Stat label="Recent Sales (30d)" value={data?.metrics?.recentSales || 0} icon={<Activity />} /></div><div className="workspace-welcome"><div><span className="eyebrow">A STRONG START</span><h2>Let’s make NORVI<br /><span className="serif">yours.</span></h2><p>Your website is taking shape. Add your product details and explore the customer journey.</p><a className="button primary" href={user.role === 'support' ? '/admin/customers' : '/admin/products'}>{user.role === 'support' ? 'Explore customers' : 'Manage your agents'}<ArrowUpRight size={17} /></a></div><div className="setup-list">{[['Website name', 'NORVI is ready', true], ['Product details', 'Names, features, prices, and releases', false], ['Secure accounts', 'Connect your authentication service', false], ['Payments & email', 'Connect your business accounts', false]].map(([title, desc, done]) => <div key={String(title)}><span className={done ? 'check-circle done' : 'check-circle'}>{done ? <Check size={14} /> : <span />}</span><div><b>{title}</b><small>{desc}</small></div></div>)}</div></div><div className="panel-heading"><h3>Find your next step</h3><a href="/" className="text-button">View website <ArrowUpRight size={15} /></a></div><div className="quick-links">{(user.role === 'support' ? [['Customers', 'Find accounts, including non-buyers', '/admin/customers', Users], ['Licenses', 'Help with devices and access', '/admin/licenses', KeyRound]] : [['Your products', 'Add, edit, and publish your agents', '/admin/products', Box], ['Website content', 'Edit your headline and description', '/admin/content', FileText]]).map(([title, desc, href, Icon]: any) => <a className="panel" href={href} key={title}><Icon size={22} /><h3>{title}</h3><p>{desc}</p><ArrowUpRight size={19} /></a>)}</div></>}
        {['/products', '/categories', '/customers', '/licenses'].includes(section) && <div className="catalog-toolbar"><label className="search"><Search size={17} /><input aria-label="Search records" placeholder={section === '/customers' ? 'Search name or email…' : 'Search records…'} value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter records" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All records</option>{section === '/products' ? <><option value="published">Published</option><option value="draft">Drafts</option><option value="archived">Archived</option></> : section === '/customers' ? <option value="nonbuyers">No purchases</option> : <><option value="active">Active</option><option value="revoked">Revoked</option></>}</select></div>}
        {section === '/categories' && <CategoriesAdmin categories={data.categories} onSave={() => { reload(); onCatalogChange(); }} />}
        {section === '/products' && <><div className="admin-products">{filtered.map((p: Product) => <div className="panel admin-product" key={p.id}><ProductIcon product={p} /><div className="grow" style={{ flex: 1, minWidth: 0 }}><h3>{p.name}</h3><p>{p.tagline}</p><span className="small-note">/{p.slug} · {p.price}</span></div><Badge>{p.status}</Badge><button className="button secondary" onClick={() => setEditing(p)}>Edit agent <ArrowUpRight size={15} /></button></div>)}</div>{!filtered.length && <Empty title="No products match." description="Change your filters or add your first agent." />}<Notice>Publishing here updates the local catalog. Release uploads and public deployment are not connected yet.</Notice></>}
        {section === '/customers' && <><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Registered</th><th>Purchases</th><th>Licenses</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(u => <tr key={u.id}><td><b>{u.name || 'Unnamed'}</b><small className="block">{u.email}</small></td><td>{date(u.createdAt)}</td><td>{u.orderCount || u.purchases || 0}</td><td>{u.activeLicenses || u.licenseCount || 0}</td><td><Badge>{u.suspended ? 'suspended' : u.status || 'active'}</Badge></td><td><div className="row-actions"><button className="button secondary" onClick={() => action('/admin/customers/' + u.id + '/suspend', { suspended: !(u.suspended || u.status === 'suspended') })}>{(u.suspended || u.status === 'suspended') ? 'Restore account' : 'Suspend account'}</button>{user.role === 'owner' && <button className="button secondary" onClick={async () => { await action('/admin/impersonate', { id: u.id }); window.location.href = u.role === 'customer' ? '/account' : '/admin'; }}>Login As</button>}</div></td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="No matching customers." description="Try a different search or filter." />}</>}
        {section === '/licenses' && (!filtered.length ? <Empty title="No licenses issued yet." description="Open a customer preview and simulate a purchase. The resulting license will appear here." href="/login" label="Explore customer flow" /> : <div className="license-list">{filtered.map(l => <div className="panel" key={l.id}><div className="panel-heading"><div><h3>{l.product}</h3><p>{l.customer}</p></div><Badge>{l.status}</Badge></div><code>NORVI-XXXX-XXXX-XXXX-{l.suffix}</code><div className="row-actions">{user.role !== 'support' && <><button className="button secondary" onClick={() => setLicenseAction({ id: l.id, action: l.status === 'active' ? 'revoke' : 'restore' })}>{l.status === 'active' ? 'Revoke access' : 'Restore access'}</button><button className="button secondary" onClick={() => setLicenseAction({ id: l.id, action: 'rotate' })}>Rotate key</button></>}<button className="button secondary" style={{color: 'var(--red)', borderColor: 'var(--red)'}} onClick={() => setLicenseAction({ id: l.id, action: 'delete' })}>Delete</button><button className="button secondary" disabled={!l.device} onClick={() => action('/licenses/' + l.id + '/device-reset')}>Reset device</button>{user.role === 'owner' && <OwnerReveal id={l.id} />}</div></div>)}</div>)}
        {section === '/orders' && <><OrderTable items={items} /><Notice>Payment collection, refunds, and receipts remain disabled until the live payment provider is connected.</Notice></>}
        {section === '/subscriptions' && <Empty title="No recurring agreements yet." description="Real subscriptions will appear here after billing plans and the payment provider are configured. Simulated purchases do not create recurring charges." />}
        {section === '/team' && <Team data={data} onAction={action} isOwner={user.role === 'owner'} settings={settings} />}
        {section === '/announcements' && <Announcements user={user} items={items} action={action} />}
        {section === '/content' && <SettingsForm initial={data.settings} contentOnly onSave={() => { reload(); onCatalogChange(); }} />}
        {section === '/settings' && <><SettingsForm initial={data.settings} onSave={() => { reload(); onCatalogChange(); }} /><div className="panel"><h3>Integration readiness</h3><div className="list-row"><span>Authentication · Supabase</span><Badge>Not connected</Badge></div><div className="list-row"><span>Payments · Razorpay</span><Badge>Not connected</Badge></div><div className="list-row"><span>Email · Resend</span><Badge>Not connected</Badge></div><p className="small-note">Provider secrets belong in protected server configuration, never in this form.</p></div></>}
        {section === '/activity' && <><div className="panel"><h3>Activity log</h3>{!items.length ? <p>No changes recorded yet.</p> : items.map(a => <div className="list-row" key={a.id}><span className="activity-icon"><Activity size={16} /></span><div className="grow" style={{ flex: 1, minWidth: 0 }}><b>{a.action}</b><p>{a.actor} · {a.target}</p></div><span className="small-note">{date(a.createdAt)}</span></div>)}</div><div className="panel"><h3>Email delivery</h3>{!data.emails.length ? <p>No purchase email jobs yet.</p> : data.emails.map((e: any) => <div className="list-row" key={e.id}><Mail size={16} /><span className="grow">Purchase confirmation · {e.orderId.slice(0, 8)}</span><Badge>{e.status}</Badge></div>)}</div></>}
    </>}{editing !== undefined && <Modal title={editing ? 'Edit agent' : 'Add an agent'} onClose={() => setEditing(undefined)} wide><ProductForm categories={data.categories} product={editing} onSave={() => { setEditing(undefined); reload(); onCatalogChange(); }} /></Modal>}{licenseAction && <Modal title={licenseAction.action === 'revoke' ? 'Revoke product access?' : licenseAction.action === 'rotate' ? 'Replace the activation key?' : licenseAction.action === 'delete' ? 'Permanently delete key?' : 'Restore product access?'} onClose={() => setLicenseAction(null)}><p>{licenseAction.action === 'delete' ? 'WARNING: This permanently deletes the license and device records. This action cannot be undone.' : 'This changes the local preview license. Billing is separate. A reason is recorded in the audit log.'}</p><form onSubmit={async e => { e.preventDefault(); const reason = new FormData(e.currentTarget).get('reason'); await action('/admin/licenses/' + licenseAction.id + '/' + licenseAction.action, { reason }); setLicenseAction(null); }}><Field label="Reason"><textarea name="reason" required minLength={5} maxLength={250} rows={3} /></Field><button className="button primary">Confirm {licenseAction.action}</button></form></Modal>}
    {giftModal && <Modal title="Gift a License" onClose={() => setGiftModal(false)}><p>Manually generate and send an active license to a customer's email address. They must have a registered account.</p><form onSubmit={async e => { e.preventDefault(); const d = new FormData(e.currentTarget); await action('/admin/licenses/gift', { email: d.get('email'), productSlug: d.get('productSlug') }); setGiftModal(false); }}><Field label="Customer Email"><input name="email" type="email" required /></Field><Field label="Product Slug (URL)"><input name="productSlug" required placeholder="e.g. omnix-ai" /></Field><button className="button primary">Generate and Gift Key</button></form></Modal>}
    </>;
}
function OwnerReveal({ id }: { id: string }) { const [key, setKey] = useState(''), [error, setError] = useState(''); return <><button className="button secondary" onClick={async () => { try { setKey((await api('/licenses/' + id + '/reveal', { method: 'POST' })).key); } catch (e: any) { setError(e.message); } }}>Reveal key</button>{error && <span style={{color: 'var(--red)', fontSize: '13px'}}>{error}</span>}{key && <Modal title="Preview activation key" onClose={() => setKey('')}><code className="full-key">{key}</code><CopyButton text={key} /></Modal>}</>; }
export function ProductForm({ product, onSave, categories }: { product: Product | null; onSave: () => void; categories: Category[] }) { 
  const [error, setError] = useState(''), [busy, setBusy] = useState(false); 
  return <form className="editor-form" onSubmit={async e => { 
    e.preventDefault(); 
    setBusy(true); 
    const form = e.currentTarget as HTMLFormElement;
    const d = Object.fromEntries(new FormData(form)); 
    try { 
      let logoUrl = product?.logoUrl || null;
      if (d.logoFile && (d.logoFile as File).size > 0) {
        logoUrl = await uploadFile(d.logoFile as File);
      }
      let workflowMediaUrl = product?.workflowMediaUrl || null;
      if (d.workflowMediaFile && (d.workflowMediaFile as File).size > 0) {
        workflowMediaUrl = await uploadFile(d.workflowMediaFile as File);
      }
      await api('/admin/products', { 
        method: 'POST', 
        body: JSON.stringify({ 
          ...d, 
          id: product?.id, 
          features: String(d.features).split('\n').filter(Boolean),
          logoUrl,
          workflowMediaUrl
        }) 
      }); 
      onSave(); 
    } catch (e: any) { 
      setError(e.message); 
      setBusy(false); 
    } 
  }}>
    <div className="form-grid">
      <Field label="Agent name"><input name="name" required minLength={2} maxLength={80} defaultValue={product?.name} placeholder="name_Agent_4" /></Field>
      <Field label="URL slug" hint="Lowercase words separated by hyphens."><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={product?.slug} placeholder="agent-4" /></Field>
      <Field label="Category">
        <select name="categoryId" required defaultValue={product?.categoryId}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Price label"><input name="price" required defaultValue={product?.price} placeholder="price_Agent_4" /></Field>
    </div>
    <Field label="Logo image (optional)"><input name="logoFile" type="file" accept="image/*" /></Field>
    <Field label="Short introduction"><input name="tagline" required minLength={3} maxLength={140} defaultValue={product?.tagline} placeholder="A short description of the benefit" /></Field>
    <Field label="Description"><textarea name="description" required minLength={5} maxLength={2000} rows={3} defaultValue={product?.description} placeholder="description_Agent_4" /></Field>
    <Field label="Features" hint="One feature per line, up to eight."><textarea name="features" rows={3} defaultValue={product?.features?.join('\n')} placeholder="feature_Agent_4_1" /></Field>
    
    <div className="form-grid">
      <Field label="Requirements"><input name="requirements" defaultValue={product?.requirements || 'requirements_Agent_4'} /></Field>
      <Field label="Version"><input name="version" defaultValue={product?.version || 'version_Agent_4'} /></Field>
      <Field label="Release status">
        <select name="releaseStatus" defaultValue={product?.releaseStatus || 'development'}>
          <option value="development">In development</option>
          <option value="prelaunch">Preparing for launch</option>
          <option value="live">Live - Available for download</option>
        </select>
      </Field>
      <Field label="Publication status">
        <select name="status" defaultValue={product?.status || 'draft'}>
          <option value="draft">Draft — private</option>
          <option value="published">Published — local preview</option>
          <option value="archived">Archived — stop new sales</option>
        </select>
      </Field>
    </div>

    <h3>Walkthrough Section</h3>
    <Field label="Walkthrough Heading"><input name="workflowHeading" required defaultValue={product?.workflowHeading || 'Built for your workflow.'} /></Field>
    <Field label="Walkthrough Description"><textarea name="workflowDescription" required rows={2} defaultValue={product?.workflowDescription} /></Field>
    <Field label="Walkthrough Media (Video or Image)"><input name="workflowMediaFile" type="file" accept="video/mp4,video/webm,image/*" /></Field>
    <Field label="Walkthrough Note (optional)"><input name="workflowNote" defaultValue={product?.workflowNote} /></Field>

    <Notice>Agent binaries and verified payment prices will be connected separately. This editor manages the local preview catalog.</Notice>
    {error && <Notice kind="error">{error}</Notice>}
    <button className="button primary" disabled={busy}>{busy ? 'Saving...' : 'Save agent'}<Check size={16} /></button>
  </form>; 
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
  const [permissions, setPermissions] = useState(settings.permissions || { "support": ["/customers", "/licenses", "/orders"], "product_manager": ["/products", "/content"], "administrator": ["/products", "/customers", "/licenses", "/orders", "/subscriptions", "/team", "/content", "/settings", "/activity"] });
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
export function OrderStatus() { const { data, error } = useData('/account'); const [orderId, setOrderId] = useState(''); useEffect(() => { setOrderId(new URLSearchParams(location.search).get('id') || ''); }, []); if (error) return <div className="container page"><Notice kind="error">{error}</Notice><a href="/login" className="button primary">Open account</a></div>; if (!data) return <Loading />; const order = data.orders.find((o: any) => o.id === orderId); return <div className="container page order-success">{order ? <><span className="success-symbol"><Check size={36} /></span><span className="eyebrow">YOUR SAMPLE ORDER IS READY</span><h1>A little more possibility.<br />Now in your account.</h1><p>Your preview license has been created. No payment was taken and no email was sent.</p><div className="panel"><div className="summary-row"><span>Order reference</span><code>{order.id.slice(0, 8)}</code></div><div className="summary-row"><span>Amount charged</span><b>₹0 · Preview</b></div><div className="summary-row"><span>Purchase email</span><Badge>Preview job saved · not sent</Badge></div></div><a href="/account/licenses" className="button primary">View your activation key <KeyRound size={18} /></a><a href="/account" className="text-button">Go to dashboard <ArrowRight size={16} /></a></> : <Empty title="Select an order from your account." description="Order details are private to the customer who placed them." href="/account/billing" label="View billing" />}</div>; }
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
