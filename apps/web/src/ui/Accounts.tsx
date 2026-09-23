import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api, Field, Loading, Notice, PageHeading, useData } from './common';

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
  return <div className="auth-page container"><div className="auth-story"><span className="eyebrow">{staff ? 'THE NORVI WORKSPACE' : 'WELCOME TO NORVI'}</span><h1>Your next chapter.<br /><span className="serif">All in one place.</span></h1><p>Explore Omnix, Voro, and Rolvio. Keep your profile, future purchases, and product access together.</p><p><ShieldCheck size={18} /> Individual accounts. Administrator MFA.</p></div><div className="auth-card"><h2>{title}</h2>
    {!config && !configError && <Loading />}{configError && <Notice kind="error">{configError}</Notice>}
    {config && !connected && <Notice>{config.preview ? 'Local preview uses sample accounts. Real registration is disabled until Supabase is connected.' : 'Account setup is pending. Registration will open once the database and email service are configured.'}</Notice>}
    {connected && <p>{staff ? 'Use your invited staff account. Authenticator verification is required to access the workspace.' : 'Use your own email address. Purchases are not enabled yet.'}</p>}
    <form onSubmit={submit}>
      {register && <Field label="Full name"><input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={!connected || busy} /></Field>}
      {!confirm && path !== '/update-password' && <Field label="Email address"><input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!connected || busy} /></Field>}
      {(!reset && !verify && (!confirm || recovery)) && <Field label={recovery ? 'New password' : 'Password'} hint={register || recovery ? 'Use at least 12 characters.' : undefined}><input required type="password" minLength={register || recovery ? 12 : 1} maxLength={128} autoComplete={register || recovery ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} disabled={!connected || busy} /></Field>}
      {confirm && !token && <Notice>Open a valid confirmation or recovery link from your email.</Notice>}
      <button className="button primary full" disabled={!connected || busy || (confirm && !token)}>{busy ? 'Please wait…' : confirm ? (recovery ? 'Save new password' : 'Confirm email') : register ? 'Create account' : reset ? 'Send reset email' : verify ? 'Resend verification' : 'Sign in'}<ArrowRight size={17} /></button>
    </form>
    {error && <Notice kind="error">{error}</Notice>}{message && <Notice kind="success">{message}</Notice>}
    {config?.preview && <div className="preview-login"><span className="small-note">EXPLORE WITH SAMPLE DATA</span><button className="button secondary full" disabled={busy} onClick={() => preview(staff ? 'owner' : 'customer')}>{staff ? 'Preview owner workspace' : 'Preview customer account'}</button>{staff && <div className="role-previews"><button disabled={busy} onClick={() => preview('product_manager')}>Product manager</button><button disabled={busy} onClick={() => preview('support')}>Support role</button></div>}</div>}
    <p className="auth-bottom"><a href={register ? '/login' : '/register'}>{register ? 'Already registered? Sign in' : 'Create an account'}</a></p><a className="recovery-link" href="/reset-password">Forgot your password?</a><a className="recovery-link" href="/verify-email">Resend verification email</a>
  </div></div>;
}

export function AccountSecurity() {
  const { data: identity, error: identityError } = useData('/me');
  const { data, error, reload } = useData('/auth/mfa');
  const [enrollment, setEnrollment] = useState<{ id: string; secret: string } | null>(null), [code, setCode] = useState(''), [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false);
  const factor = enrollment?.id || data?.factors?.find((f: any) => f.status === 'verified')?.id;
  if (identity?.preview) return <div className="container page"><Notice>Authenticator setup requires a real account. Preview identities do not have passwords or MFA.</Notice><a href="/account">Back to account</a></div>;
  return <div className="container page"><PageHeading eyebrow="ACCOUNT SECURITY" title="Protect your NORVI account." description="Use a time-based authenticator app. Staff must complete this step before opening their workspace." />
    {(error || identityError) && <Notice kind="error">{error || identityError}</Notice>}
    {!identityError && !identity && <Loading />}
    {data && <div className="panel security-panel">{!factor && <button className="button primary" disabled={busy} onClick={async () => { setBusy(true); setFeedback(''); try { setEnrollment(await api('/auth/mfa/enroll', { method: 'POST' })); } catch (e: any) { setFeedback(e.message); } finally { setBusy(false); } }}>Set up authenticator</button>}
      {enrollment && <><p>In your authenticator app, add a time-based account named NORVI and enter this setup key. Keep it private.</p><code className="full-key">{enrollment.secret}</code></>}
      {factor && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setFeedback(''); try { await api('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ factorId: factor, code }) }); setEnrollment(null); setCode(''); location.href = identity?.user.role === 'customer' ? '/account' : '/admin'; } catch (e: any) { setFeedback(e.message); setCode(''); reload(); } finally { setBusy(false); } }}><Field label="Authenticator code"><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value)} /></Field><button className="button primary" disabled={busy}>Verify authenticator</button></form>}
      {feedback && <Notice kind="error">{feedback}</Notice>}<p>If you lose your authenticator, contact the owner for identity-verified recovery. Email reset alone does not remove MFA.</p>
    </div>}
    <p><a href="/account">Back to account</a></p>
  </div>;
}

export function LiveAdmin({ section }: { section: string }) {
  const [page, setPage] = useState(0);
  const { data, error } = useData(section === '/customers' ? '/admin/customers?page=' + page : '/me');
  return <><PageHeading eyebrow="NORVI WORKSPACE" title={section === '/customers' ? 'Your customers.' : 'Your account foundation is ready.'} />
    {error && <Notice kind="error">{error}</Notice>}
    {section === '/customers' && data?.items && <><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Status</th><th>Purchases</th></tr></thead><tbody>{data.items.map((u: any) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.status}</td><td>{u.purchases}</td></tr>)}</tbody></table></div>{!data.items.length && <p>No customers on this page.</p>}<div className="row-actions"><button className="button secondary" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button className="button secondary" disabled={data.items.length < 50} onClick={() => setPage(p => p + 1)}>Next</button></div></>}
    {section !== '/customers' && <Notice>Real account access and staff permissions are connected. Product editing, invitations, billing, and license administration remain separate integration phases. No sample records are shown in this workspace.</Notice>}
  </>;
}
