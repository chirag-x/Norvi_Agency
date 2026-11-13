import { AccountAuth, AccountSecurity } from './Accounts';
import { ArrowUpRight, ArrowRight, Workflow, MessageSquare, Sparkles, ShieldCheck, KeyRound, Download, Check, Menu, X, Plus, Command, ChevronDown , Instagram, Youtube, Facebook, Twitter, Bot} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Catalog, Detail, PartnerProgram, About, Help, Contact, Legal, Checkout, NotFound } from './PublicPages';
import { Workspace, OrderStatus } from './Workspace';
import type { Product, Settings, User } from '../../../../packages/shared/model';
import catalogSnapshot from '../../../../packages/shared/catalog.json';
import { hasAdvertisingConsent, setAdvertisingConsent, getAdvertisingConsentPreference, trackMetaPageView } from './analytics';


function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{role: 'ai', content: 'Hi there! How can I help you today?'}]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (e: any) => {
    e.preventDefault();
    if(!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(p => [...p, {role: 'user', content: msg}]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
         method: 'POST', 
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ message: msg, history: messages.filter(m => m.role !== 'error') })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(()=>({error: 'Server error'}));
        throw new Error(err.error || 'Failed to connect');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      setMessages(p => [...p, {role: 'ai', content: ''}]);
      
      if (reader) {
        while(true) {
          const {done, value} = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setMessages(p => {
             const newArr = [...p];
             newArr[newArr.length - 1].content += chunk;
             return newArr;
          });
        }
      }
    } catch(err: any) {
      setMessages(p => [...p, {role: 'error', content: err.message}]);
    }
    setLoading(false);
  };

  return (
    <div 
      className="chat-widget" 
      style={{
        position: 'fixed', 
        bottom: 24, 
        right: 24, 
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!open && hovered && (
        <div style={{
          background: 'rgba(15, 20, 14, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#ecefe9',
          fontSize: 12,
          fontWeight: 500,
          padding: '7px 12px',
          borderRadius: 8,
          marginRight: 10,
          whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d4f89c', display: 'inline-block' }} />
          Ask AI Support
        </div>
      )}

      {!open && (
        <button 
          onClick={() => setOpen(true)} 
          aria-label="Open AI Support Chat"
          style={{
            width: 56, 
            height: 56, 
            borderRadius: 28, 
            background: 'linear-gradient(135deg, #d4f89c 0%, #b4ef54 100%)', 
            color: '#111411', 
            border: '1px solid rgba(255, 255, 255, 0.4)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(180, 239, 84, 0.45)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            transform: hovered ? 'scale(1.08)' : 'scale(1)'
          }}
        >
          <Bot size={28} strokeWidth={2.2} />
        </button>
      )}
      
      {open && (
        <div style={{
          width: 350, height: 500, background: 'rgba(13, 17, 12, 0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--border)', 
          borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          <div style={{background: 'rgba(255, 255, 255, 0.03)', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)'}}>
            <h3 style={{margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8}}>
              <Bot size={18} style={{color: 'var(--lime)'}} />
              <span>NORVI AI Support</span>
            </h3>
            <button onClick={() => setOpen(false)} style={{background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer'}}><X size={20}/></button>
          </div>
          
          <div style={{flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12}}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'var(--lime)' : 'var(--panel)',
                color: m.role === 'user' ? '#111411' : 'var(--text)',
                padding: '10px 14px', borderRadius: 12, maxWidth: '85%', fontSize: 14,
                fontWeight: m.role === 'user' ? 500 : 400,
                border: m.role === 'error' ? '1px solid var(--red)' : 'none'
              }}>
                <p style={{margin: 0, whiteSpace: 'pre-wrap'}}>{m.content}</p>
                {m.role === 'ai' && m.content.length > 30 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <a
                      href="https://wa.me/919893534314?text=Hi%20NORVI%20Support%2C%20I%20have%20a%20question."
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(37, 211, 102, 0.14)',
                        border: '1px solid rgba(37, 211, 102, 0.35)',
                        color: '#4ade80',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 5,
                        textDecoration: 'none'
                      }}
                    >
                      WhatsApp Support ↗
                    </a>
                    <a
                      href="/contact"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#e2e8f0',
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 5,
                        textDecoration: 'none'
                      }}
                    >
                      Contact Form
                    </a>
                  </div>
                )}
              </div>
            ))}
            {loading && messages[messages.length-1].role === 'user' && (
              <div style={{alignSelf: 'flex-start', background: 'var(--panel)', padding: '10px 14px', borderRadius: 12}}><span className="dot-typing">...</span></div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={send} style={{display: 'flex', padding: 12, borderTop: '1px solid var(--border)', background: 'rgba(0, 0, 0, 0.2)'}}>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question..." disabled={loading} 
              style={{flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', fontSize: 14}} />
            <button type="submit" disabled={loading || !input.trim()} style={{background: 'transparent', border: 'none', color: 'var(--lime)', cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1}}>
              <ArrowRight size={20} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function WhatsAppWidget() {
  const [hovered, setHovered] = useState(false);
  const phone = '919893534314';
  const defaultMsg = encodeURIComponent('Hi NORVI Agency, I have a question about your AI agents.');
  const href = `https://wa.me/${phone}?text=${defaultMsg}`;

  return (
    <div
      className="whatsapp-widget"
      style={{
        position: 'fixed',
        bottom: 94,
        right: 24,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <div
          style={{
            background: 'rgba(15, 20, 14, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#ecefe9',
            fontSize: 12,
            fontWeight: 500,
            padding: '7px 12px',
            borderRadius: 8,
            marginRight: 10,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366', display: 'inline-block' }} />
          Chat on WhatsApp (+91 9893534314)
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with NORVI Agency on WhatsApp"
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: '#25D366',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(37, 211, 102, 0.45)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          transform: hovered ? 'scale(1.08)' : 'scale(1)',
          textDecoration: 'none'
        }}
      >
        <svg width="30" height="30" viewBox="0 0 32 32" style={{ display: 'block' }}>
          <path fill="#FFFFFF" d="M23.21 8.79A10.15 10.15 0 0016 5.87a10.19 10.19 0 00-8.8 15.22L6 26l5.08-1.33a10.13 10.13 0 004.92 1.28h0a10.19 10.19 0 0010.21-10.21 10.14 10.14 0 00-3-7.95zM16 24.31a8.42 8.42 0 01-4.3-1.18l-.31-.18-3.21.84.86-3.13-.2-.32a8.47 8.47 0 117.26 3.97zm4.64-6.33c-.25-.13-1.5-.74-1.73-.83s-.4-.13-.57.13-.66.83-.81 1-.3.18-.55.05a6.92 6.92 0 01-2.04-1.26 7.62 7.62 0 01-1.41-1.75c-.15-.25 0-.38.11-.51s.25-.3.38-.45a1.72 1.72 0 00.25-.43.46.46 0 00-.02-.44c-.06-.13-.57-1.38-.79-1.89s-.43-.43-.57-.43h-.49a.94.94 0 00-.68.32 2.87 2.87 0 00-.9 2.13 5 5 0 001.05 2.64 10.87 10.87 0 004.13 3.65 14.71 14.71 0 001.46.55 3.52 3.52 0 001.62.1 2.72 2.72 0 001.78-1.24 2.22 2.22 0 00.15-1.24c-.07-.13-.25-.2-.5-.33z"/>
        </svg>
      </a>
    </div>
  );
}

function CookieConsentBanner({ showModal, onClose }: { showModal: boolean; onClose: () => void }) {
  const [pref, setPref] = useState<'granted' | 'denied' | 'unset'>('unset');

  useEffect(() => {
    setPref(getAdvertisingConsentPreference());
    const handler = () => setPref(getAdvertisingConsentPreference());
    window.addEventListener('norvi:consent-changed', handler);
    return () => window.removeEventListener('norvi:consent-changed', handler);
  }, []);

  if (pref !== 'unset' && !showModal) return null;

  return (
    <aside
      aria-label="Advertising and Cookie Preferences"
      className="cookie-banner-aside"
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        maxWidth: 440,
        zIndex: 10001,
        background: 'rgba(15, 20, 14, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🍪</span> Advertising & Privacy Preferences
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-light)', lineHeight: 1.5 }}>
          We use optional Meta Pixel tracking to measure advertising performance. We never share customer audio, interview transcripts, or private application data.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          className="button button-small"
          style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-light)', fontSize: 12, padding: '6px 12px' }}
          onClick={() => {
            setAdvertisingConsent(false);
            onClose();
          }}
        >
          Decline
        </button>
        <button
          className="button button-small primary"
          style={{ fontSize: 12, padding: '6px 16px' }}
          onClick={() => {
            setAdvertisingConsent(true);
            onClose();
          }}
        >
          Accept
        </button>
      </div>
    </aside>
  );
}

const initialProducts = (catalogSnapshot.products || []) as unknown as Product[];
const initialSettings = catalogSnapshot.settings as unknown as Settings;

export default function App({ initialPath }: { initialPath: string }) {
  const [path,setPath] = useState(initialPath); const [products,setProducts] = useState<Product[]>(initialProducts); const [settings,setSettings] = useState<Settings>(initialSettings); const [menu,setMenu]=useState(false); const [user,setUser]=useState<User|null>(null);
  const [verified, setVerified] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    if (hasAdvertisingConsent()) {
      trackMetaPageView();
    }
  }, [path]);
  useEffect(()=>{ 
      setPath(location.pathname.replace(/\/$/,'') || '/'); 
      const currentPath = location.pathname.replace(/\/$/, '') || '/';
      if (currentPath !== '/update-password' && ((location.hash.includes('type=signup') && location.hash.includes('access_token=')) || location.search.includes('code='))) {
          setVerified(true);
          history.replaceState(null, '', location.pathname);
      }
      fetch('/api/me')
        .then(r=>r.ok?r.json():null)
        .then(meData => {
          if(meData&&meData.user)setUser(meData.user);
        })
        .catch(()=>{})
        .finally(()=>{setIsAuthChecked(true);});
      fetch('/api/catalog')
        .then(r=>r.ok?r.json():null)
        .then(catalogData => {
          if(catalogData){setProducts(catalogData.products);setSettings(catalogData.settings);}
        })
        .catch(()=>{})
        .finally(()=>{setIsDataLoaded(true);});
  },[]);
  const refresh=()=>{fetch('/api/catalog').then(r=>r.json()).then(d=>{setProducts(d.products);setSettings(d.settings);}).catch(()=>{});};
  const workspace=(path.startsWith('/account')||path.startsWith('/admin'))&&path!=='/admin/login';
  const loadingScreen = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', backgroundColor: 'var(--bg)', color: 'var(--fg)' }}>
      <img src="/logo.jpg?v=2" alt="NORVI Agency" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "contain", marginBottom: '1.5rem', animation: 'pulse 2s infinite' }} />
      <style>{`@keyframes pulse { 0% { opacity: 0.6; transform: scale(0.98); } 50% { opacity: 1; transform: scale(1.02); } 100% { opacity: 0.6; transform: scale(0.98); } }`}</style>
    </div>
  );
  let content;
  if(path==='/') content=<Home products={products} settings={settings}/>;
  else if(path==='/agents') content=<Catalog products={products} settings={settings}/>;
  else if(path==='/pricing') {
    if (typeof window !== 'undefined') window.location.replace('/agents');
    content = <Catalog products={products} settings={settings}/>;
  }
  else if(path.startsWith('/agents/')) {
    const slugProduct = products.find(p=>p.slug===path.split('/')[2]);
    content = (!slugProduct && !isDataLoaded) ? loadingScreen : <Detail product={slugProduct} settings={settings} isCatalogLoaded={isDataLoaded}/>;
  }
  else if(path==='/partners') content=<PartnerProgram settings={settings} user={user}/>;
  else if(path==='/about') content=<About/>;
  else if(path==='/help') content=<Help/>;
  else if(path==='/contact') content=<Contact settings={settings}/>;
  else if(['/privacy','/terms','/refunds','/license','/delivery'].includes(path)) content=<Legal kind={path.slice(1)}/>;
  else if(['/login','/register','/reset-password','/verify-email','/admin/login','/auth/confirm','/update-password'].includes(path)) content=<AccountAuth path={path}/>;
  else if(path.startsWith('/checkout/')) {
    const slugProduct = products.find(p=>p.slug===path.split('/')[2]);
    content = !isDataLoaded ? loadingScreen : <Checkout product={slugProduct} settings={settings}/>;
  }
  else if(path==='/orders') content=<OrderStatus/>;
  else if(path==='/account/security') content=<AccountSecurity/>;
  else if(workspace||path==='/onboarding') content=<Workspace path={path==='/onboarding'?'/account/settings':path} products={products} settings={settings} onCatalogChange={refresh}/>;
  else content=<NotFound/>;
  return <><a className="skip-link" href="#main-content">Skip to content</a>{!workspace && settings.bannerText && (
      <div style={{ background: '#c5f042', color: '#000', padding: '10px 20px', textAlign: 'center', fontSize: 14, fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <span>📢</span>
        <span>{settings.bannerText}</span>
      </div>
    )}
    {!workspace && <header className="header"><a className="brand" href="/"><img src="/logo.jpg?v=2" alt="NORVI Agency" style={{width: 34, height: 34, borderRadius: 4, objectFit: "contain", marginRight: 10}}/>{settings.name}</a><nav className={menu?'nav open':'nav'} aria-label="Main navigation"><a className={path.startsWith('/agents')?'active':''} href="/agents">Explore agents</a><a href="/partners">Partner Program</a><a href="/about">Our story</a><a href="/help">Resources</a></nav><div className="header-actions"><span style={{display:'inline-flex',alignItems:'center',justifyContent:'flex-end',minWidth:44,opacity:isAuthChecked?1:0,transition:'opacity 0.15s ease'}}>{user?<a href={user.role==='customer'?'/account':'/admin'} className="user-avatar-link" title="My Account" style={{display:'flex',textDecoration:'none'}}><span className="avatar">{user.name.slice(0,1).toUpperCase()}</span></a>:<a href="/login" className="login-link">Log in</a>}</span><a className="button button-small primary" href="/agents">Find your agent <ArrowUpRight size={16}/></a><button className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>}<main id="main-content">{content}</main>{!workspace&&<Footer settings={settings} onOpenConsent={()=>setShowConsentModal(true)}/>}<WhatsAppWidget /><ChatWidget /><CookieConsentBanner showModal={showConsentModal} onClose={()=>setShowConsentModal(false)} />
      {verified && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div className="panel" style={{maxWidth: 420, width: '100%', textAlign:'center', padding:'40px 30px'}}>
            <div style={{color:'var(--accent)', marginBottom:'1.5rem'}}><Check size={56} style={{margin:'0 auto'}}/></div>
            <h2 style={{marginBottom:'0.5rem'}}>Verification Completed!</h2>
            <p style={{marginBottom:'2rem', color:'var(--text-light)'}}>Your email has been successfully verified.</p>
            <button className="button primary full" onClick={() => location.href = '/login'}>Log in to continue <ArrowRight size={17}/></button>
          </div>
        </div>
      )}
    </>;
}
export function ProductIcon({product,size=40}:{product:Product;size?:number}){
  if (product.logoUrl) {
    return <img src={product.logoUrl} alt={product.name} style={{ width: size, height: size, objectFit: 'contain' }} />;
  }
  return <span className={'product-icon lime'}><Workflow size={size}/></span>;
}
export function ProductCard({product}:{product:Product}){
  const startingPrice = Number(product.price1m) || Number(product.price3m) || Number(product.price_lifetime) || 0;
  return (
    <a className="product-card" href={'/agents/'+product.slug}>
      <div className="product-card-top">
        <ProductIcon product={product}/>
        <ArrowUpRight size={19}/>
      </div>
      <span className="category">{product.subHeading || product.extendedContent?.subHeading || (typeof product.category === 'string' ? product.category : product.category?.name) || 'Desktop Agent'}</span>
      <h3>{product.name}</h3>
      <p>{product.tagline}</p>

      {product.features && product.features.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 10px 0' }}>
          {product.features.map((feat, i) => (
            <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', color: 'var(--muted)', border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
              {feat}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 12 }}>
        {product.releaseStatus === 'live' && product.status !== 'archived' ? (
          <span className="badge" style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 6, 
            background: 'rgba(34, 197, 94, 0.14)', 
            color: '#4ade80', 
            borderColor: 'rgba(34, 197, 94, 0.45)', 
            fontWeight: 700,
            padding: '3px 9px',
            boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block' }} />
            Live
          </span>
        ) : (
          <span className="badge">
            {product.releaseStatus === 'development' ? 'In development' : product.releaseStatus === 'prelaunch' ? 'Preparing for launch' : product.status === 'archived' ? 'Sales paused' : 'Live'}
          </span>
        )}
        {startingPrice > 0 && product.releaseStatus !== 'development' && (
          <span className="badge" style={{ color: 'var(--lime)', borderColor: 'rgba(200,255,100,0.3)', fontWeight: 600 }}>
            From ₹{startingPrice.toLocaleString('en-IN')}/mo
          </span>
        )}
        {product.trialActive !== false && product.releaseStatus !== 'development' && (
          <span className="badge" style={{ background: 'rgba(147, 197, 253, 0.08)', color: '#93c5fd', borderColor: 'rgba(147, 197, 253, 0.25)' }}>
            1-Day Free Trial
          </span>
        )}
      </div>

      <div className="product-card-bottom">
        <span>Explore agent</span>
        <ArrowRight size={17}/>
      </div>
    </a>
  );
}

function Home({products,settings}:{products:Product[];settings:Settings}){return <><section className="hero container"><div className="hero-copy"><div className="eyebrow"><span className="tiny-spark">✦</span> A NEW WAY TO GET THINGS DONE</div><h1>{settings.headline==="Less busywork.\\nMore possibility." || settings.headline==="Less busywork.\nMore possibility."?<>Less busywork.<br/>More <span className="serif">possibility.</span></>:<span className="customheadline" dangerouslySetInnerHTML={{__html: settings.headline.replace(/\\n|\n/g, '<br/>')}} />}</h1><p>{settings.description}</p><div className="hero-buttons"><a className="button primary" href="/agents">Explore the agents <ArrowUpRight size={19}/></a><a className="text-button" href="#how-it-works">See how it works <ArrowRight size={17}/></a></div><div className="hero-note"><ShieldCheck size={16}/><span>Your account. Your agents. Your access.</span></div><div className="hero-social-links" style={{display:'flex',gap:'1.5rem',marginTop:'1.5rem'}}>{settings.socialInstagram && <a href={settings.socialInstagram} target="_blank" rel="noreferrer" style={{color:'#E1306C'}}><Instagram size={22}/></a>}{settings.socialYoutube && <a href={settings.socialYoutube} target="_blank" rel="noreferrer" style={{color:'#FF0000'}}><Youtube size={22}/></a>}{settings.socialFacebook && <a href={settings.socialFacebook} target="_blank" rel="noreferrer" style={{color:'#1877F2'}}><Facebook size={22}/></a>}{settings.socialTwitter && <a href={settings.socialTwitter} target="_blank" rel="noreferrer" style={{color:'#1DA1F2'}}><Twitter size={22}/></a>}</div></div><div className="hero-console"><div className="console-top"><span><span className="console-dot"/> YOUR NEXT WORKFLOW</span><span>01 / 03</span></div><div className="workflow-title"><span className="mini-label">FROM TO-DO TO DONE</span><h2>Give the routine<br/>a new routine.</h2><p>A simpler way to put your agents to work.</p></div><div className="flow-line"><div className="flow-node"><span className="node-symbol"><Plus size={19}/></span><span><b>Choose your task</b><small>Start with what slows you down</small></span><span className="step-index">01</span></div><div className="connector"/><div className="flow-node selected"><span className="node-symbol"><Sparkles size={19}/></span><span><b>Meet your agent</b><small>The right tool for the right work</small></span><span className="step-index">02</span></div><div className="connector"/><div className="flow-node"><span className="node-symbol"><Check size={19}/></span><span><b>Make space for more</b><small>Bring your focus back to you</small></span><span className="step-index">03</span></div></div><div className="console-bottom"><span>Designed around your workflow</span><Workflow size={17}/></div></div></section><div className="value-ribbon"><div className="container" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'16px',alignItems:'center'}}><span><Workflow size={18} style={{color:'var(--lime)'}}/> Autonomous Desktop AI Agents</span><span><ShieldCheck size={18} style={{color:'var(--lime)'}}/> 100% Private Local PC Execution</span><span><KeyRound size={18} style={{color:'var(--lime)'}}/> Instant License &amp; Key Activation</span><span><Sparkles size={18} style={{color:'var(--lime)'}}/> Transparent Pricing · Zero Hidden Fees</span></div></div><section className="section container" id="agents"><div className="section-heading"><div><span className="eyebrow">THE AGENT COLLECTION</span><h2>Small tools.<br/><span className="muted">Bigger possibilities.</span></h2></div><div className="section-aside"><p>Explore your next addition to the workday.<br/>One agent. One less thing on your list.</p><a className="text-button" href="/agents">View all agents <ArrowUpRight size={17}/></a></div></div><div className="product-grid">{products.slice(0,3).map(p=><ProductCard key={p.id} product={p}/>)}</div>{settings.bannerText ? <p className="fineprint">{settings.bannerText}</p> : null}</section><section className="how-section" id="how-it-works"><div className="container"><div className="section-heading"><div><span className="eyebrow">LESS SETUP. MORE MOMENTUM.</span><h2>A clear path to<br/>your next agent.</h2></div><p className="section-aside">From discovery to your desktop,<br/>everything has its place.</p></div><div className="steps">{[['01','Find your dedicated agent','Browse purpose-built agents like Voro (real-time interview & coding copilot), Rolvio (job hunter & tracker), or Nexus (viral content studio). Review transparent hardware specs, live demos, and capabilities.'],['02','Choose your license tier','Select flexible 1-Month, 3-Month, or Lifetime access with zero recurring surprise billing. Pay securely via Razorpay (UPI, Cards, Netbanking) for instant digital fulfillment.'],['03','Install & run locally','Download the lightweight native installer for Windows or macOS directly from your dashboard. Paste your activation key once to unlock full local PC execution with multi-device support.']].map(([n,t,d])=><div className="step" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div></div></section><section className="section container"><div className="faq-layout"><div><span className="eyebrow">GOOD QUESTIONS</span><h2>A little clarity<br/>goes a long way.</h2><a className="text-button" href="/help">Visit the help center <ArrowUpRight size={16}/></a></div><div className="faqs">{[['What makes NORVI desktop AI agents different from web chatbots?','Unlike web-based chatbots or browser extensions that require constant cloud uploads, NORVI agents are native desktop applications (Windows 10/11 64-bit and macOS). They run locally on your machine, process screen context and audio with low latency, and keep your sensitive work and private data on your device.'],['How do licenses and device activations work?','Every purchased license allows simultaneous activation on up to 3 of your personal computers (e.g., your desktop and laptop). If you change machines, you can release or rotate your active devices anytime with 1 click directly from your Keys & Devices dashboard.'],['Where and how do I receive my activation key after purchase?','Delivery is instant. The moment your checkout completes via Razorpay, your unique activation key (NORVI-••••-••••) is displayed on screen, added to your /account/licenses dashboard, and emailed to you. You can copy it with one click and activate your agent immediately.'],['Do I have to pay ongoing cloud token fees or hidden markups?','No. All NORVI agents include unlimited local PC execution with zero token markups. For features using high-speed cloud intelligence (such as live transcription or speech models), generous quotas are included or direct transparent routing is provided—with no surprise bills.'],['Can I use my agent offline without an internet connection?','Yes. Once activated, your agent can operate completely offline for up to 24 hours (1 day) before performing a brief background check. You can continue using your tools on your machine even if you are traveling or lose internet connectivity.'],['Can I upgrade my plan from 1-Month or 3-Month to Lifetime later?','Yes. You can renew or upgrade your license tier at any time from your account dashboard. Upgrading to Lifetime access unlocks permanent software updates and priority technical support.']].map(([q,a])=><details key={q}><summary>{q}<Plus size={18}/></summary><p>{a}</p></details>)}</div></div></section><section className="cta container"><div><span className="eyebrow">MAKE ROOM FOR YOUR NEXT BIG THING</span><h2>Your workday.<br/>With a little more <span className="serif">possibility.</span></h2></div><a className="button dark" href="/agents">Find your agent <ArrowUpRight size={19}/></a></section></>;}
function Footer({settings, onOpenConsent}:{settings:Settings; onOpenConsent?: () => void}){const brandLabel = settings.name === 'NORVI' ? 'NORVI Agency' : settings.name;return <footer className="footer container"><div className="footer-main"><div><a href="/" className="brand"><img src="/logo.jpg?v=2" alt="NORVI Agency" style={{width: 34, height: 34, borderRadius: 4, objectFit: "contain", marginRight: 10}}/>{settings.name}</a><p>A little less routine.<br/>A little more room for you.</p></div><div><b>Explore</b><a href="/agents">All agents</a><a href="/partners">Partner Program</a><a href="/about">Our story</a></div><div><b>Here to help</b><a href="/help">Help center</a><a href="/contact">Contact us</a><a href="/account">My account</a></div><div><b>The details</b><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/refunds">Refund policy</a><a href="/delivery">Shipping & delivery</a>{onOpenConsent && <button onClick={onOpenConsent} style={{background:'none',border:'none',padding:0,color:'inherit',font:'inherit',textAlign:'left',cursor:'pointer'}}>Cookie preferences</button>}</div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {brandLabel}. All rights reserved.</span><a href="/license">License agreement <ArrowUpRight size={13}/></a><span>Built for a better workday.</span></div></footer>;}
