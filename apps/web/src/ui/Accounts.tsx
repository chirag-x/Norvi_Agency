import { useEffect, useState, type FormEvent, useRef, type ReactNode } from 'react';
import { ArrowRight, ShieldCheck, Plus, ArrowUpRight, Copy, X, KeyRound } from 'lucide-react';
import { api, Badge, Field, Loading, Notice, PageHeading, useData, Empty } from './common';
import { ProductForm, SettingsForm, CategoriesAdmin } from './Workspace';
import { ProductIcon } from './App';

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); const prior = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prior; }; }, []); return <dialog ref={ref} className={'modal ' + (wide ? 'wide' : '')} onCancel={e => { e.preventDefault(); onClose(); }} aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} className="icon-button" aria-label="Close dialog"><X size={22} /></button></div>{children}</dialog>; }

export function safeNext(value: string | null, fallback = '/account') {
  // Only known internal destinations. Reject protocol-relative and backslash redirects.
  return value && /^\/(account(?:\/[a-z-]+)?|admin(?:\/[a-z-]+)?|checkout\/[a-z0-9-]+)$/.test(value) ? value : fallback;
}
export function AccountAuth({ path }: { path: string }) {
  const { data: config, error: configError } = useData('/auth/config');
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [token, setToken] = useState(''), [recovery, setRecovery] = useState(false);
  const staff = path === '/admin/login', register = path === '/register', reset = path === '/reset-password', verify = path === '/verify-email', confirm = path === '/auth/confirm' || path === '/update-password';
  useEffect(() => {
    if (confirm || path === '/update-password') {
      const params = new URLSearchParams(location.hash.slice(1));
      setToken(params.get('token_hash') || ''); setRecovery(path === '/update-password' || params.get('type') === 'recovery');
      history.replaceState(null, '', location.pathname); // Clear sensitive link material without a network request.
    }
  }, [path]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (confirm || path === '/update-password') {
        if (!token) throw Error('Open the complete link from your email. If it expired, request a new one.');
        await api(recovery ? '/auth/recover' : '/auth/confirm', { method: 'POST', body: JSON.stringify(recovery ? { token_hash: token, password } : { token_hash: token, type: 'email' }) });
        setToken(''); location.href = recovery ? '/login' : '/account'; return;
      }
      const action = register ? 'register' : reset ? 'reset' : verify ? 'resend' : 'login';
      const result = await api('/auth/' + action, { method: 'POST', body: JSON.stringify({ name, email, password }) });
      setPassword('');
      if (action === 'login') location.href = safeNext(new URLSearchParams(location.search).get('next'), staff ? '/admin' : '/account');
      else setMessage(result.message);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function preview(role: string) {
    setBusy(true); setError('');
    try { await api('/preview/session', { method: 'POST', body: JSON.stringify({ role }) }); location.href = safeNext(new URLSearchParams(location.search).get('next'), role === 'customer' ? '/account' : '/admin'); }
    catch (e: any) { setError(e.message); setBusy(false); }
  }
  const connected = config?.mode === 'supabase';
  const title = confirm ? (recovery ? 'Choose a new password.' : 'Confirm your email.') : register ? 'Create your account.' : reset ? 'Reset your password.' : verify ? 'Check your inbox.' : staff ? 'Admin sign in.' : 'Welcome back.';
  return <div className="auth-page container"><div className="auth-story"><span className="eyebrow">{staff ? 'THE NORVI WORKSPACE' : 'WELCOME TO NORVI'}</span><h1>Your next chapter.<br /><span className="serif">All in one place.</span></h1><p>Explore the agent collection. Keep your profile, future purchases, and product access together.</p><p><ShieldCheck size={18} /> Individual accounts. Administrator MFA.</p></div><div className="auth-card"><h2>{title}</h2>
    {!config && !configError && <Loading />}{configError && <Notice kind="error">{configError}</Notice>}
    {config && !connected && <Notice>{config.preview ? 'Local preview uses sample accounts. Real registration is disabled until Supabase is connected.' : 'Account setup is pending. Registration will open once the database and email service are configured.'}</Notice>}
    {connected && <p>{staff ? 'Use your invited staff account. Authenticator verification is required to access the workspace.' : 'Use your own email address. Purchases are not enabled yet.'}</p>}
    <form onSubmit={submit}>
      {register && <Field label="Full name"><input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={!connected || busy} /></Field>}
      {!confirm && path !== '/update-password' && <Field label="Email address"><input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!connected || busy} /></Field>}
      {(!reset && !verify && (!confirm || recovery)) && <Field label={recovery ? 'New password' : 'Password'} hint={register || recovery ? 'Use at least 12 characters.' : undefined}><input required type="password" minLength={register || recovery ? 12 : 1} maxLength={128} autoComplete={register || recovery ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} disabled={!connected || busy} /></Field>}
      {confirm && !token && <Notice>Open a valid confirmation or recovery link from your email.</Notice>}
      <button className="button primary full" disabled={!connected || busy || (confirm && !token)}>{busy ? 'Please waitâ€¦' : confirm ? (recovery ? 'Save new password' : 'Confirm email') : register ? 'Create account' : reset ? 'Send reset email' : verify ? 'Resend verification' : 'Sign in'}<ArrowRight size={17} /></button>
    </form>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    {config?.preview && <div className="preview-login"><span className="small-note">EXPLORE WITH SAMPLE DATA</span><button className="button secondary full" disabled={busy} onClick={() => preview(staff ? 'owner' : 'customer')}>{staff ? 'Preview owner workspace' : 'Preview customer account'}</button>{staff && <div className="role-previews"><button disabled={busy} onClick={() => preview('product_manager')}>Product manager</button><button disabled={busy} onClick={() => preview('support')}>Support role</button></div>}</div>}
    <p className="auth-bottom"><a href={register ? '/login' : '/register'}>{register ? 'Already registered? Sign in' : 'Create an account'}</a></p><a className="recovery-link" href="/reset-password">Forgot your password?</a><a className="recovery-link" href="/verify-email">Resend verification email</a>
  </div></div>;
}

export function AccountSecurity() {
  const { data: identity, error: identityError } = useData('/me');
  const { data, error, reload } = useData('/auth/mfa');
  const [enrollment, setEnrollment] = useState<{ id: string; secret: string; qr?: string } | null>(null), [code, setCode] = useState(''), [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false);
  const factor = enrollment?.id || data?.factors?.find((f: any) => f.status === 'verified')?.id;
  if (identity?.preview) return <div className="container page"><Notice>Authenticator setup requires a real account. Preview identities do not have passwords or MFA.</Notice><a href="/account">Back to account</a></div>;
  return <div className="container page"><PageHeading eyebrow="ACCOUNT SECURITY" title="Protect your NORVI account." description="Use a time-based authenticator app. Staff must complete this step before opening their workspace." />
    {(error || identityError) && <Notice kind="error">{error || identityError}</Notice>}
    {!identityError && !identity && <Loading />}
    {data && <div className="panel security-panel">{!factor && <button className="button primary" disabled={busy} onClick={async () => { setBusy(true); setFeedback(''); try { setEnrollment(await api('/auth/mfa/enroll', { method: 'POST' })); } catch (e: any) { setFeedback(e.message); } finally { setBusy(false); } }}>Set up authenticator</button>}
      {enrollment && <><p>Scan the QR code below with your Authenticator app (like Google Authenticator or Authy), or choose "Enter a setup key" and paste the secret code manually.</p>
      {enrollment.qr && <div className="qr-box" dangerouslySetInnerHTML={{ __html: enrollment.qr }} style={{ maxWidth: 200, margin: '20px 0' }} />}
      <code className="full-key">{enrollment.secret}</code></>}
      {factor && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setFeedback(''); try { await api('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ factorId: factor, code }) }); setEnrollment(null); setCode(''); location.href = identity?.user.role === 'customer' ? '/account' : '/admin'; } catch (e: any) { setFeedback(e.message); setCode(''); reload(); } finally { setBusy(false); } }}><Field label="Authenticator code"><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value)} /></Field><button className="button primary" disabled={busy}>Verify authenticator</button></form>}
      {feedback && <Notice kind="error">{feedback}</Notice>}<p>If you lose your authenticator, contact the owner for identity-verified recovery. Email reset alone does not remove MFA.</p>
    </div>}
    <p><a href="/account">Back to account</a></p>
  </div>;
}

export function LiveAdmin({ section }: { section: string }) {
  const [page, setPage] = useState(0);
  const endpoint = section === '/categories' ? '/admin/products' : section === '/products' ? '/admin/products' : section === '/content' ? '/admin/content' : section === '/settings' ? '/admin/settings' : section === '/customers' ? '/admin/customers?page=' + page : section === '/team' ? '/admin/team' : section === '/licenses' ? '/admin/licenses' : section === '/orders' ? '/admin/orders' : section === '/activity' ? '/admin/activity' : section === '' ? '/admin' : '/me';
  const { data, error, reload } = useData(endpoint);
  const [feedback, setFeedback] = useState('');
  const [editing, setEditing] = useState<any>(undefined);
  const [licenseAction, setLicenseAction] = useState<{ id: string; action: string } | null>(null);

  async function action(path: string, body?: object) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
      reload();
      setFeedback('Action successful.');
    } catch (e: any) {
      setFeedback(e.message);
    }
  }

  const titles: Record<string, string> = { '': 'Your agency, at a glance.', '/products': 'Your agent collection.', '/categories': 'Agent categories.', '/customers': 'Your customers.', '/team': 'Your team.', '/content': 'Make it sound like you.', '/settings': 'The details that make it yours.', '/licenses': 'Access, under your control.', '/orders': 'Every order, in one place.', '/activity': 'A clear record of every change.', '/subscriptions': 'Keep track of recurring access.' };

  const date = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return <><PageHeading eyebrow={section === '' ? 'WELCOME TO YOUR WORKSPACE' : 'AGENCY MANAGEMENT'} title={titles[section] || 'Your account foundation is ready.'} action={section === '/products' ? <button className="button primary" onClick={() => setEditing(null)}><Plus size={17} />Add agent</button> : undefined} />
    {error && <Notice kind="error">{error}</Notice>}
    {feedback && <Notice>{feedback}</Notice>}

    {section === '' && data?.customers !== undefined && <><div className="stat-grid"><div className="panel"><h3>Customers</h3><p className="stat-value">{data.customers}</p></div><div className="panel"><h3>Active Licenses</h3><p className="stat-value">{data.licenses}</p></div><div className="panel"><h3>Live Products</h3><p className="stat-value">{data.products}</p></div></div><div className="workspace-welcome"><div><span className="eyebrow">A STRONG START</span><h2>Letâ€™s make NORVI<br /><span className="serif">yours.</span></h2><p>Your business dashboard is fully active and connected to Supabase.</p></div></div></>}
    
    {section === '/categories' && (data?.categories ? <CategoriesAdmin categories={data.categories} onSave={reload} /> : <Notice kind="error">Categories data is missing. Please ensure you have run the latest database migration.</Notice>)}
    {section === '/products' && data?.items && <><div className="admin-products">{data.items.map((p: any) => <div className="panel admin-product" key={p.id || p.slug}><ProductIcon product={p} /><div className="grow"><h3>{p.name}</h3><p>{p.tagline}</p><span className="small-note">/{p.slug} Â· {p.price}</span></div><Badge>{p.status}</Badge><button className="button secondary" onClick={() => setEditing(p)}>Edit agent <ArrowUpRight size={15} /></button></div>)}</div>{!data.items.length && <Empty title="No products match." description="Change your filters or add your first agent." />}<Notice>This updates the live production catalog in the database.</Notice></>}
    
    {section === '/content' && data?.settings && <SettingsForm initial={data.settings} contentOnly onSave={reload} />}
    
    {section === '/settings' && data?.settings && <><SettingsForm initial={data.settings} onSave={reload} /><div className="panel"><h3>Integration readiness</h3><div className="list-row"><span>Authentication - Supabase</span><Badge kind={data.system?.supabase ? 'good' : 'default'}>{data.system?.supabase ? 'Connected' : 'Missing keys'}</Badge></div><div className="list-row"><span>Email - Resend</span><Badge kind={data.system?.resend ? 'good' : 'default'}>{data.system?.resend ? 'Connected' : 'Missing keys'}</Badge></div><div className="list-row"><span>Storage - GitHub</span><Badge kind={data.system?.github ? 'good' : 'default'}>{data.system?.github ? 'Connected' : 'Missing keys'}</Badge></div><div className="list-row"><span>Payments - Razorpay</span><Badge kind={data.system?.razorpay ? 'good' : 'default'}>{data.system?.razorpay ? 'Connected' : 'Missing keys'}</Badge></div><p className="small-note">Provider secrets belong in protected server configuration, never in this form.</p></div><AdminAccountDeletion /></>}

    {section === '/customers' && data?.items && <><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Status</th><th>Purchases</th></tr></thead><tbody>{data.items.map((u: any) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.status}</td><td>{u.purchases}</td></tr>)}</tbody></table></div>{!data.items.length && <p>No customers on this page.</p>}<div className="row-actions"><button className="button secondary" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button className="button secondary" disabled={data.items.length < 50} onClick={() => setPage(p => p + 1)}>Next</button></div></>}
    
    {section === '/licenses' && data?.items && (!data.items.length ? <Empty title="No licenses issued yet." description="Live purchases will appear here." /> : <div className="license-list">{data.items.map((l: any) => <div className="panel" key={l.id}><div className="panel-heading"><div><h3>{l.product}</h3><p>{l.customer}</p></div><Badge>{l.status}</Badge></div><code>NORVI_â€¢â€¢â€¢â€¢â€¢â€¢{l.suffix}</code><div className="row-actions"><button className="button secondary" onClick={() => setLicenseAction({ id: l.id, action: l.status === 'active' ? 'revoke' : 'restore' })}>{l.status === 'active' ? 'Revoke access' : 'Restore access'}</button><button className="button secondary" onClick={() => setLicenseAction({ id: l.id, action: 'rotate' })}>Rotate key</button><button className="button secondary" disabled={!l.device} onClick={() => action('/admin/licenses/' + l.id + '/device-reset')}>Reset device</button></div></div>)}</div>)}

    {section === '/orders' && data?.items && (!data.items.length ? <Empty title="No orders just yet." description="Live purchases will appear here." /> : <div className="table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.items.map((o: any) => <tr key={o.id}><td><code>{o.id.slice(0, 8)}</code></td><td>{o.product}</td><td>{o.customer}</td><td>{date(o.createdAt)}</td><td>{o.currency} {(o.amount / 100).toFixed(2)}</td><td><Badge>{o.status}</Badge></td></tr>)}</tbody></table></div>)}

    {section === '/subscriptions' && <Empty title="No recurring agreements yet." description="Real subscriptions will appear here after billing plans and the payment provider are configured. Simulated purchases do not create recurring charges." />}

    {section === '/activity' && data?.items && <><div className="panel"><h3>Activity log</h3>{!data.items.length ? <p>No changes recorded yet.</p> : data.items.map((a: any) => <div className="list-row" key={a.id}><div className="grow"><b>{a.action}</b><p>{a.actor} Â· {a.target}</p></div><span className="small-note">{date(a.createdAt)}</span></div>)}</div><div className="panel"><h3>Email delivery</h3>{!data.emails?.length ? <p>No purchase email jobs yet.</p> : data.emails.map((e: any) => <div className="list-row" key={e.id}><span className="grow">{e.kind} Â· {e.target_id}</span><Badge>{e.status}</Badge></div>)}</div></>}

    {section === '/team' && data?.items && <>
      <div className="panel">
        <h3>Your team</h3>
        {data.items.map((u: any) => <div className="list-row" key={u.id}><span className="avatar">{(u.name || u.email).slice(0, 1)}</span><div className="grow"><b>{u.name || 'No name'}</b><p>{u.email}</p></div><Badge>{u.role.replace('_', ' ')}</Badge><Badge>{u.status}</Badge>{u.role !== 'owner' && <button className="text-button bare" onClick={() => action('/admin/team/' + u.id + '/suspend')}>{u.status === 'active' ? 'Suspend' : 'Restore'}</button>}</div>)}
      </div>
      <form className="panel" onSubmit={async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)); await action('/admin/team/invite', d); e.currentTarget.reset(); }}>
        <h3>Invite a teammate</h3>
        <p>Send an invitation to join your workspace. (Requires email outbox processing)</p>
        <div className="form-grid">
          <Field label="Teammate email"><input name="email" type="email" required placeholder="teammate@example.com" /></Field>
          <Field label="Role">
            <select name="role">
              <option value="support">Support</option>
              <option value="product_manager">Product manager</option>
              <option value="administrator">Administrator</option>
            </select>
          </Field>
        </div>
        <button className="button primary">Send invitation</button>
      </form>
      <div className="panel">
        <h3>Pending invitations</h3>
        {!data.invitations?.length ? <p>No invitations yet.</p> : data.invitations.map((i: any) => <div className="list-row" key={i.id}><span className="grow">{i.email}</span><Badge>{i.role.replace('_', ' ')}</Badge><Badge>Pending</Badge></div>)}
      </div>
    </>}

    {editing !== undefined && <Modal title={editing ? 'Edit agent' : 'Add an agent'} onClose={() => setEditing(undefined)} wide><ProductForm product={editing} categories={data?.categories || []} onSave={() => { setEditing(undefined); reload(); }} /></Modal>}
    
    {licenseAction && <Modal title={licenseAction.action === 'revoke' ? 'Revoke product access?' : licenseAction.action === 'rotate' ? 'Replace the activation key?' : 'Restore product access?'} onClose={() => setLicenseAction(null)}><form onSubmit={async e => { e.preventDefault(); const reason = new FormData(e.currentTarget).get('reason'); await action('/admin/licenses/' + licenseAction.id + '/' + licenseAction.action, { reason }); setLicenseAction(null); }}><Field label="Reason"><textarea name="reason" required minLength={5} maxLength={250} rows={3} /></Field><button className="button primary">Confirm {licenseAction.action}</button></form></Modal>}
  </>;
}

export function AdminAccountDeletion() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function handleDelete() {
    if (!confirm('Are you absolutely sure you want to delete your account? This action is irreversible.')) return;
    setBusy(true); setError('');
    try {
      const result = await api('/auth/account', { method: 'DELETE' });
      if (result.ok) location.href = '/';
      else setError('Failed to delete account.');
    } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return <div className="panel"><h3>Danger zone</h3><p>Permanently delete this account.</p><div style={{marginTop: '1rem'}}><button className="button secondary" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={busy} onClick={handleDelete}>{busy ? 'Deleting...' : 'Delete account'}</button></div>{error && <Notice kind="error">{error}</Notice>}</div>;
}
