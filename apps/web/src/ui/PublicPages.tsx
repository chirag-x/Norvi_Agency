import { useState } from 'react';
import { ArrowRight,ArrowUpRight,Search,Check,ShieldCheck,KeyRound,Download,Mail,LifeBuoy,Workflow } from 'lucide-react';
import type { Product,Settings } from '../../../../packages/shared/model';
import { ProductCard,ProductIcon } from './App';
import { PageHeading,Notice,Field,Empty,api,useData } from './common';
export function Catalog({products}:{products:Product[]}){const [query,setQuery]=useState('');const filtered=products.filter(p=>(p.name+' '+p.category+' '+p.description).toLowerCase().includes(query.toLowerCase()));return <div className="container page"><PageHeading eyebrow="YOUR NEXT WORKFLOW STARTS HERE" title="Meet your next agent." description="— collection of tools for a little less routine and a lot more possibility."/><div className="catalog-toolbar"><span className="tab active">All agents <b>{products.length}</b></span><label className="search"><Search size={17}/><input aria-label="Search agents" placeholder="Find an agent…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="product-grid">{filtered.map(p=><ProductCard key={p.id} product={p}/>)}</div>{!filtered.length&&<Empty title="No matches just yet." description="Try another name or clear your search."/>}<div className="inline-callout"><div><h3>Not sure where to start?</h3><p>Learn how purchase, download, and activation will work.</p></div><a className="text-button" href="/help">Get a little guidance <ArrowUpRight size={18}/></a></div></div>;}
  export function Detail({product}:{product:Product|undefined}){
  const { data: account, reload } = useData('/account');
  const ownsProduct = account?.licenses?.some((l:any) => l.productId === product?.id && l.status === 'active');
  const [trialModal, setTrialModal] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState('');
  const [trialSuccess, setTrialSuccess] = useState(false);

  if(!product)return <NotFound/>;

  async function startTrial() {
    setTrialBusy(true); setTrialError('');
    try {
      if (!account) {
        location.href = '/login?next=/agents/' + product!.slug;
        return;
      }
      const data = await api('/store/trial/create', { method: 'POST', body: JSON.stringify({ productSlug: product!.slug }) });
      setTrialSuccess(true);
      reload(); // reload account data to update ownsProduct
    } catch (e: any) {
      setTrialError(e.message || 'Could not start trial.');
    } finally {
      setTrialBusy(false);
    }
  }

  return (
    <div className="container page">
      {trialModal && (
        <div className="modal-overlay">
          <div className="modal" style={{textAlign: 'center', maxWidth: 400}}>
            {trialSuccess ? (
              <>
                <div style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'var(--green)', color: 'var(--black)', marginBottom: 24}}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3>Trial Activated!</h3>
                <p style={{marginBottom: 24}}>Your 1-day free trial for <b>{product.name}</b> is ready. The unique activation key has been added to your dashboard.</p>
                <button className="button primary full" onClick={() => { setTrialModal(false); setTrialSuccess(false); }}>Close & View Agent</button>
              </>
            ) : (
              <>
                <h3>Start 1-Day Free Trial</h3>
                <p style={{marginBottom: 24}}>Are you sure you want to activate your trial for <b>{product.name}</b>? You can only claim this once.</p>
                {trialError && <div className="notice error" style={{marginBottom: 16}}>{trialError}</div>}
                <div style={{display: 'flex', gap: 12}}>
                  <button className="button secondary full" onClick={() => setTrialModal(false)} disabled={trialBusy}>Cancel</button>
                  <button className="button primary full" onClick={startTrial} disabled={trialBusy}>{trialBusy ? 'Activating...' : 'Activate Trial'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <a className="breadcrumb" href="/agents">&larr; All agents</a>
      <div className="detail-hero">
        <div>
          <ProductIcon product={product} size={48}/>
          <span className="category block">{product.category?.name || "Agent"} &middot; {product.releaseStatus === 'development' ? 'In development' : product.releaseStatus === 'prelaunch' ? 'Preparing for launch' : 'Live'}</span>
          <h1>{product.name}</h1>
          <p className="lead">{product.tagline}</p>
          <p>{product.description}</p>
          <div className="detail-features">{(product.features||[]).map(f=><span key={f}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>{f}</span>)}</div>
        </div>
        <aside className="purchase-panel">
          <span className="eyebrow">MAKE IT PART OF YOUR WORKDAY</span>
          {ownsProduct ? (
            <>
              <h2>Ready to go.</h2>
              <p>You already own a license for {product.name}.</p>
              <a className="button primary full" href="/account/agents">Download agent &amp; view key <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></a>
              <span className="small-note" style={{display: 'inline-block', marginTop: 8}}>Manage your installation in your workspace.</span>
            </>
          ) : (
            <>
              <h2>{product.price}</h2>
              <p>One-time purchase &middot; 1-day free trial included</p>
              {product.releaseStatus === 'development' ? (
                <button className="button secondary full" disabled>In development &mdash; sales unavailable</button>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <a className="button primary full" href={'/checkout/'+product.slug}>{product.releaseStatus === 'live' ? 'Buy now' : 'View availability'} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></a>
                  <button className="button secondary full" onClick={() => setTrialModal(true)}>Start free trial</button>
                </div>
              )}
            </>
          )}
          <hr/>
          <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"></path><circle cx="16.5" cy="7.5" r=".5"></circle></svg> Your own product activation key</div>
          <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Downloads in your account</div>
          <div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg> Account-based license management</div>
        </aside>
      </div>
      <div className="two-column">
        <section className="panel">
          <h2>{product.workflowHeading || 'Built for your workflow.'}</h2>
          <p>{product.workflowDescription || product.description}</p>
          <div className="demo-placeholder" style={{ position: "relative", padding: 0, overflow: "hidden" }}>
            {product.workflowMediaUrl ? (
              product.workflowMediaUrl.match(/\.(mp4|webm)$/i) ? 
              <video src={product.workflowMediaUrl} autoPlay muted loop playsInline style={{ width: "100%", height: "auto", display: "block" }} /> : 
              <img src={product.workflowMediaUrl} alt="Walkthrough" style={{ width: "100%", height: "auto", display: "block" }} />
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                <h3>{product.name} walkthrough</h3>
                <p>A product walkthrough will appear here.</p>
              </>
            )}
          </div>
          {product.workflowNote && <p className="small-note" style={{ marginTop: "1rem" }}>{product.workflowNote}</p>}
        </section>
        <section className="panel">
          <h3>Before you get started</h3>
          <dl>
            <dt>System requirements</dt><dd>{product.requirements}</dd>
            <dt>Current release</dt><dd>{product.version}</dd>
            <dt>AI usage</dt><dd>Unlimited local usage. Bring your own API keys.</dd>
            <dt>Device allowance</dt><dd>1 active device per license. Manage devices in your account.</dd>
          </dl>
          <a href="/help" className="text-button">Installation &amp; activation <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></a>
        </section>
      </div>
    </div>
  );
}
export function Pricing({products}:{products:Product[]}){return <div className="container page"><PageHeading eyebrow="— TOOL THAT FITS. — PRICE THAT MAKES SENSE." title="Your work. Your choice." description="Choose the agent you need. Every product has its own license and account access."/><div className="product-grid pricing-grid">{products.map(p=><div className="panel price-card" key={p.id}><ProductIcon product={p}/><h3>{p.name}</h3><p>{p.tagline}</p><div className="price">{p.price}</div><span className="small-note">One-time purchase (1-day free trial)</span><a className="button primary full" href={'/agents/'+p.slug}>View agent <ArrowUpRight size={17}/></a><ul className="check-list">{['Personal activation key','Account access to your license','Product-specific download',...(p.features||[])].map(f=><li key={f}><Check size={15}/>{f}</li>)}</ul></div>)}</div><div className="inline-callout"><div><h3>Clarity before checkout.</h3><p>UPI, cards, and international methods will be available subject to payment-provider approval.</p></div><a href="/refunds" className="text-button">Refund policy <ArrowUpRight size={17}/></a></div></div>;}
const helpItems=[['Getting started','Create your account, verify your email, and explore the collection. Each product page will show its requirements before you buy.'],['Finding your key','Open My account → Keys & devices. Choose Reveal key for the product you purchased. Never share the key publicly.'],['Installing an agent','Download the correct version from My agents. Open the agent and enter the key for that product. Download the installer for your OS once activated.'],['Device limits','Each license supports 1 active device. Release an old device from Keys & devices before moving to a new one.'],['Payments and renewals','Your billing page keeps purchase records. Purchases are one-time payments. You also get a 1-day free trial.'],['Trouble activating?','Check that you selected the correct product and have an internet connection. An expired, revoked, or wrong-product key cannot activate the agent.']];
export function Help(){const [query,setQuery]=useState('');return <div className="container page"><PageHeading eyebrow="THE NORVI HELP CENTER" title="— little help goes a long way." description="Find your way from your first visit to your first activation."/><label className="search large-search"><Search size={20}/><input aria-label="Search help" placeholder="Search activation, downloads, payments…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="help-grid">{helpItems.filter(([t,d])=>(t+d).toLowerCase().includes(query.toLowerCase())).map(([t,d],i)=><article className="panel" key={t}><span className="help-number">0{i+1}</span><h3>{t}</h3><p>{d}</p></article>)}</div><div className="inline-callout"><div><h3>Still need a hand?</h3><p>Your account keeps your support requests together.</p></div><a className="button secondary" href="/account/support">Contact support <ArrowRight size={16}/></a></div></div>;}
export function About(){return <div className="container page"><PageHeading eyebrow="THE IDE— BEHIND NORVI" title="More room for meaningful work." description="We’re building a collection of AI agents to help people spend less time on repetitive tasks."/><div className="about-feature"><span className="serif">Possibility<br/>starts with<br/>a little space.</span><div><span className="eyebrow">OUR STARTING POINT</span><h2>Useful tools.<br/>— human purpose.</h2><p>NORVI is taking its first steps. Our aim is simple: make it easier to discover, purchase, and manage AI agents that fit the way you work.</p><p>Every product will have a clear purpose, an honest demonstration, and an explanation of what you need to use it.</p></div></div><div className="steps"><div className="step"><span>01</span><h3>Start with the task.</h3><p>Build around a real problem, not a list of buzzwords.</p></div><div className="step"><span>02</span><h3>Keep things clear.</h3><p>Explain capabilities, requirements, usage, and access before purchase.</p></div><div className="step"><span>03</span><h3>Grow thoughtfully.</h3><p>Learn from customers and make the useful things better.</p></div></div><div className="panel"><h3>Norvi AI Agency</h3><p>Based in India. Founded by <a href="https://chirag-portfolio-v3.netlify.app/" target="_blank" rel="noreferrer" style={{textDecoration:"underline", color:"inherit"}}>Chirag Sharma</a> to simplify workflows and make AI accessible.</p></div></div>;}
export function Contact({settings}:{settings:Settings}){
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData as any).toString()
      });
      if (!response.ok) throw new Error('Form submission failed.');
      setSent(true);
      form.reset();
    } catch (err) {
      setError('Sorry, we could not send your message. Please email us directly.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="container page"><PageHeading eyebrow="LET'S TALK" title="Good work starts with a conversation." description="Questions about an agent or your account? Find the right place to start."/><div className="two-column"><div className="panel"><Mail className="accent"/><h3>Get in touch</h3><p><strong>Norvi AI Agency</strong><br/>Kunj Vihar, Gole ka mandir<br/>Gwalior, Madhya Pradesh<br/>India, 474005<br/>Phone: +91-8305525932</p><p>Email: {settings.email}</p><p>Support hours: Mon-Fri, 9am-6pm IST</p><form name="contact" data-netlify="true" onSubmit={handleSubmit}><input type="hidden" name="form-name" value="contact" /><Field label="Your name"><input type="text" name="name" required placeholder="Your name" disabled={busy}/></Field><Field label="Email address"><input type="email" name="email" required placeholder="you@example.com" disabled={busy}/></Field><Field label="Your message"><textarea name="message" required minLength={10} placeholder="What can we help you with?" rows={4} disabled={busy}/></Field><button className="button secondary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send message'} <ArrowRight size={16}/></button>{error&&<Notice kind="error">{error}</Notice>}{sent&&<Notice kind="success">Your message has been sent to our support team. We'll be in touch shortly!</Notice>}</form></div><div><div className="panel"><LifeBuoy className="accent"/><h3>Already have an account?</h3><p>Keep your questions and purchase details in one place.</p><a href="/account/support" className="text-button">Open account support <ArrowUpRight size={17}/></a></div><div className="panel"><h3>Prefer a quick answer?</h3><p>Our help center covers accounts, keys, devices, and downloads.</p><a href="/help" className="text-button">Browse the help center <ArrowUpRight size={17}/></a></div></div></div></div>;
}
const legal:Record<string,{title:string;sections:[string,string][]}>={privacy:{title:'Privacy policy',sections:[['Data we expect to collect','Account identity, profile details, purchase references, licenses, device activation records, and support requests.'],['How information will be used','To operate accounts, fulfill purchases, validate access, deliver support, and protect the service. Registration will not automatically opt you into marketing.'],['Service providers','We use secure providers like Supabase for accounts, Razorpay for payments, and Resend for email.'],['Retention and requests','You can delete your account at any time from your dashboard. For privacy inquiries, email chiragsharmawork95@gmail.com.'],['Grievance Officer','In accordance with the Information Technology Act 2000, the name and contact details of the Grievance Officer are provided below.\n\nName: Gopal Ji Yadav\nEmail: Gopal2nd5654@gmail.com\nPhone: +91-6397916325\nAddress: Norvi AI Agency, Kunj Vihar, Gole ka mandir, Gwalior, Madhya Pradesh, India, 474005.']]},terms:{title:'Terms of service',sections:[['Business and Jurisdiction','These Terms govern your use of products and services offered by Norvi AI Agency, a registered entity in India. These Terms are subject to the exclusive jurisdiction of the courts in Gwalior, Madhya Pradesh, India.'],['Service scope','Norvi sells access to AI agents. Each product includes a 1-day free trial.'],['Accounts and acceptable use','Customers will be responsible for keeping account credentials and activation keys private and using the products under their agreed license.'],['Payments and access','Payments are handled securely via Razorpay. All sales are final after the trial period.']]},refunds:{title:'Refund & Cancellation Policy',sections:[['Eligibility','Because we offer a 1-day free trial, all sales are final once the purchase is completed. We do not offer refunds.'],['Cancellation','As our products are digital AI agents, orders cannot be cancelled once the payment is processed and the unique license key is generated and dispatched to your dashboard.'],['Request process','For technical issues preventing you from accessing the software, contact chiragsharmawork95@gmail.com within 7 days.']]},delivery:{title:'Shipping & Delivery Policy',sections:[['Digital Delivery','We sell digital AI agent software and license keys. We do not ship physical products.'],['Instant Fulfillment','Upon successful payment, your unique activation key is delivered instantly to your registered email address.'],['Dashboard Access','Your purchased license key and the software download links will be immediately available in your account dashboard under "Keys & devices".']]},license:{title:'License agreement',sections:[['Product-specific access','Each license belongs to a customer and a particular product. — key for one agent cannot unlock another.'],['Devices and sharing','Each license is valid for 1 active device. You may rotate devices from your dashboard.'],['Connection requirements','The agent requires periodic online validation. An offline authorization lease lasts for 7 days.'],['Expiry and revocation','Licenses may be revoked for fraud or violation of terms.'],['Updates and support','Lifetime access to the purchased major version.']]}};
export function Legal({kind}:{kind:string}){const doc=legal[kind];return <div className="container page legal"><PageHeading eyebrow="THE DETAILS" title={doc.title}/>{doc.sections.map(([title,body],i)=><section key={title}><h2>{i+1}. {title}</h2><p style={{whiteSpace:"pre-wrap"}}>{body}</p></section>)}<a href="/contact" className="text-button">Questions? Contact us <ArrowRight size={16}/></a></div>;}
export function Checkout({product}:{product:Product|undefined}){
  const {data:config}=useData('/auth/config');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[accepted,setAccepted]=useState(false),[success,setSuccess]=useState(false);
  
        if (success) {
      return (
        <div className="container page" style={{textAlign: 'center', maxWidth: 500, margin: '80px auto'}}>
          <div style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'var(--green)', color: 'var(--black)', marginBottom: 24}}>
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style={{fontSize: 32, marginBottom: 16}}>Payment Successful!</h2>
          <p style={{marginBottom: 32}}>Thank you for your purchase. Your unique activation key for <b>{product.name}</b> has been generated instantly.</p>
          <a className="button primary" href="/account/licenses" style={{display: 'inline-flex', width: '100%', justifyContent: 'center', padding: '16px'}}>View License Key & Download</a>
        </div>
      );
    }
    if(!product)return <NotFound/>;

  if(product.releaseStatus==='development')return <div className="container page"><PageHeading title={product.name} description={'In development. Purchasing is unavailable.'}/><a className="button secondary" href={'/agents/'+product.slug}>Back to agent</a></div>;

  async function purchase(){
    setBusy(true);setError('');
    try{
      if(config?.preview){
        const {order}=await api('/preview/purchase',{method:'POST',body:JSON.stringify({productId:product!.id})});
        location.href='/orders?id='+order.id;
      }else{
        const data=await api('/checkout/create',{method:'POST',body:JSON.stringify({productId:product!.id})});
        
        if (data.mock) {
          // MOCK CHECKOUT FLOW (Keys are missing in .env)
          console.log('Running mock checkout simulation...');
          await api('/internal/mock-webhook', { method: 'POST', body: JSON.stringify({ order_id: data.order_id, payment_id: 'mock_payment_' + Date.now() }) });
          location.href = '/account?success=true';
          return;
        }

        if(!(window as any).Razorpay){
          await new Promise((res, rej) => {
            const script=document.createElement('script');
            script.src='https://checkout.razorpay.com/v1/checkout.js';
            script.onload=res; script.onerror=rej;
            document.body.appendChild(script);
          });
        }
        
        const options={
          key:data.key_id, amount:data.amount, currency:data.currency, name:"NORVI", description:`Purchase of ${product?.name}`, order_id:data.razorpay_order_id,
          handler: async function(res:any){
              try {
                setBusy(true);
                await api('/checkout/verify', { method: 'POST', body: JSON.stringify({ 
                  orderId: data.order_id, 
                  razorpay_payment_id: res.razorpay_payment_id, 
                  razorpay_order_id: res.razorpay_order_id, 
                  razorpay_signature: res.razorpay_signature 
                })});
                setSuccess(true);
                setBusy(false);
              } catch (e: any) {
                setBusy(false);
                setError("API Error: " + (e.message || "Unknown error"));
              }
            },
            theme:{color:"#C6F077"}
        };
        const rzp=new (window as any).Razorpay(options);
        rzp.on('payment.failed', function(res:any){setError(res.error.description||"Payment failed.");});
        rzp.open();
        setBusy(false);
      }
    }catch(e:any){
      setError(e.message||'Checkout failed. Please try again.');
      setBusy(false);
    }
  }

  const isPreview=config?.preview;
  return <div className="container page">
    <PageHeading eyebrow="YOUR NEXT AGENT" title="One step closer." description="Review your selection and complete your purchase securely."/>
    <div className="checkout-grid">
      <div className="panel">
        <h3>Payment details</h3>
        {isPreview?<Notice>Local checkout demonstration. No payment is collected. Switch to live mode for real checkout.</Notice>:<Notice kind="success">Secure checkout via Razorpay. UPI, Cards, and Netbanking supported.</Notice>}
        <div className="payment-options"><span>UPI</span><span>Credit / debit card</span><span>Netbanking</span></div>
        <p className="small-note">Payments processed securely by Razorpay.</p>
        <hr/>
        <h3>Terms & Conditions</h3>
        <label className="checkbox-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>I agree to the terms of service and refund policy.</label>
        {error&&<Notice kind="error">{error}</Notice>}
        <button className="button primary full" disabled={busy||!accepted} onClick={purchase}>{busy?'Processing...':(isPreview?'Simulate purchase — no charge':`Pay Securely`)}<ArrowRight size={17}/></button>
      </div>
      <aside className="panel order-summary">
        <ProductIcon product={product}/>
        <h3>{product.name}</h3>
        <p>{product.tagline}</p>
        <hr/>
        <div className="summary-row"><span>Price</span><b>{product.price || '₹0.00'}</b></div>
        <div className="summary-row total"><span>Total today</span><b>{product.price || '₹0.00'}</b></div>
        <p className="small-note">Includes a product-specific activation key to unlock the agent on your desktop.</p>
        <a href="/terms" className="text-button">Read terms <ArrowUpRight size={15}/></a>
      </aside>
    </div>
  </div>;
}
export function NotFound(){return <div className="container page"><Empty title="This page took a different path." description="The page or agent could not be found." href="/agents" label="Back to the collection"/></div>;}
