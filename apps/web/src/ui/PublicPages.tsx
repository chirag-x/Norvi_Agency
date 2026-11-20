import { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, ArrowUpRight, Search, Check, ShieldCheck, KeyRound, Download, 
  Mail, LifeBuoy, Workflow, Activity, Instagram, Youtube, Facebook, Twitter,
  Sparkles, Plus, Code, Mic, Bot, Film, Cpu, Zap, Monitor, Layers, Lock, Terminal, Eye, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDurationLabel, getDefaultAgentPaidHighlights, getDefaultAgentTrialHighlights, getDefaultAgentTrialNotice, type Product, type Settings, type User, type FeaturePillar, type AgentExtendedContent } from '../../../../packages/shared/model';
import { ProductCard,ProductIcon } from './App';
import { PageHeading, Notice, Field, Empty, api, useData, Badge, SmartVideoPlayer, parseYouTubeVideoId } from './common';
import { trackMetaPurchase, trackMetaViewContent, hasAdvertisingConsent, getProductDisplayPrice } from './analytics';
import { SupportChatBox } from './SupportChat';
export function Catalog({products, settings}:{products:Product[]; settings?:Settings}){const [query,setQuery]=useState('');const filtered=products.filter(p=>{const sub=p.subHeading||p.extendedContent?.subHeading||'';const catName=typeof p.category==='string'?p.category:(p.category?.name||'');return (p.name+' '+sub+' '+catName+' '+p.description).toLowerCase().includes(query.toLowerCase());});return <div className="container page"><PageHeading eyebrow="YOUR NEXT WORKFLOW STARTS HERE" title="Meet your next agent." description="A collection of tools for a little less routine and a lot more possibility."/><div className="catalog-toolbar"><span className="tab active">All agents <b>{products.length}</b></span><label className="search"><Search size={17}/><input aria-label="Search agents" placeholder="Find an agent…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><div className="product-grid">{filtered.map(p=><ProductCard key={p.id} product={p}/>)}</div>{!filtered.length&&<Empty title="No matches just yet." description="Try another name or clear your search."/>}<div className="inline-callout"><div><h3>Not sure where to start?</h3><p>Learn how purchase, download, and activation will work.</p></div><a className="text-button" href="/help">Get a little guidance <ArrowUpRight size={18}/></a></div></div>;}
function PillarIcon({ name, size = 20 }: { name?: string; size?: number }) {
  const icon = (name || '').toLowerCase();
  if (icon.includes('shield') || icon.includes('security')) return <ShieldCheck size={size} />;
  if (icon.includes('code') || icon.includes('developer')) return <Code size={size} />;
  if (icon.includes('mic') || icon.includes('audio') || icon.includes('voice')) return <Mic size={size} />;
  if (icon.includes('bot') || icon.includes('ai') || icon.includes('agent')) return <Bot size={size} />;
  if (icon.includes('film') || icon.includes('video') || icon.includes('media')) return <Film size={size} />;
  if (icon.includes('cpu') || icon.includes('hardware') || icon.includes('chip')) return <Cpu size={size} />;
  if (icon.includes('zap') || icon.includes('fast') || icon.includes('speed')) return <Zap size={size} />;
  if (icon.includes('monitor') || icon.includes('screen') || icon.includes('display')) return <Monitor size={size} />;
  if (icon.includes('layer') || icon.includes('stack')) return <Layers size={size} />;
  if (icon.includes('lock') || icon.includes('private')) return <Lock size={size} />;
  if (icon.includes('terminal') || icon.includes('cli')) return <Terminal size={size} />;
  if (icon.includes('eye') || icon.includes('vision') || icon.includes('scan')) return <Eye size={size} />;
  if (icon.includes('activity')) return <Activity size={size} />;
  return <Sparkles size={size} />;
}

export function OfficialWhatsAppIcon({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      <path fill={color} d="M23.21 8.79A10.15 10.15 0 0016 5.87a10.19 10.19 0 00-8.8 15.22L6 26l5.08-1.33a10.13 10.13 0 004.92 1.28h0a10.19 10.19 0 0010.21-10.21 10.14 10.14 0 00-3-7.95zM16 24.31a8.42 8.42 0 01-4.3-1.18l-.31-.18-3.21.84.86-3.13-.2-.32a8.47 8.47 0 117.26 3.97zm4.64-6.33c-.25-.13-1.5-.74-1.73-.83s-.4-.13-.57.13-.66.83-.81 1-.3.18-.55.05a6.92 6.92 0 01-2.04-1.26 7.62 7.62 0 01-1.41-1.75c-.15-.25 0-.38.11-.51s.25-.3.38-.45a1.72 1.72 0 00.25-.43.46.46 0 00-.02-.44c-.06-.13-.57-1.38-.79-1.89s-.43-.43-.57-.43h-.49a.94.94 0 00-.68.32 2.87 2.87 0 00-.9 2.13 5 5 0 001.05 2.64 10.87 10.87 0 004.13 3.65 14.71 14.71 0 001.46.55 3.52 3.52 0 001.62.1 2.72 2.72 0 001.78-1.24 2.22 2.22 0 00.15-1.24c-.07-.13-.25-.2-.5-.33z"/>
    </svg>
  );
}

function renderComparisonCell(val: boolean | string | undefined | null, isUs: boolean) {
  if (val === true) {
    return <Check size={18} style={{ color: 'var(--lime)', verticalAlign: 'middle' }} />;
  }
  if (val === false) {
    return <span style={{ opacity: 0.35 }}>&mdash;</span>;
  }
  if (!val) {
    return <span style={{ opacity: 0.35 }}>&mdash;</span>;
  }
  return <span>{val}</span>;
}

export function Detail({product, settings, isCatalogLoaded = true}:{product:Product|undefined; settings?:Settings; isCatalogLoaded?:boolean}){
  const { data: account, loading: accountLoading, reload } = useData('/account');
  const ownsProduct = account?.licenses?.some((l:any) => l.productId === product?.id && l.status === 'active');
  const [trialModal, setTrialModal] = useState(false);
  const [trialSuccess, setTrialSuccess] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState('');
  const [selectedPillar, setSelectedPillar] = useState<FeaturePillar | null>(null);
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCatalogLoaded || !product || !product.slug || !product.name) return;

    const fireViewContent = () => {
      if (hasAdvertisingConsent()) {
        const displayPrice = getProductDisplayPrice(product, settings);
        trackMetaViewContent({
          productName: product.name,
          productSlug: product.slug,
          productId: product.id,
          price: displayPrice,
          currency: 'INR'
        });
      }
    };

    fireViewContent();

    const handleConsentChange = (e: any) => {
      if (e?.detail?.granted) {
        fireViewContent();
      }
    };
    window.addEventListener('norvi:consent-changed', handleConsentChange);
    return () => {
      window.removeEventListener('norvi:consent-changed', handleConsentChange);
    };
  }, [isCatalogLoaded, product?.slug, product?.name, settings?.saleActive, settings?.salePercentage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('trial') === 'true' && account && !ownsProduct) {
      setTrialModal(true);
    }
  }, [account, ownsProduct]);

  async function startTrial() {
    setTrialBusy(true);
    setTrialError('');
    try {
      if (!account) {
        location.href = '/register?next=' + encodeURIComponent('/agents/' + product!.slug + '?trial=true');
        return;
      }
      await api('/store/trial/create', { method: 'POST', body: JSON.stringify({ productSlug: product!.slug }) });
      setTrialSuccess(true);
      reload();
    } catch (e: any) {
      setTrialError(e.message || 'Could not start trial.');
    } finally {
      setTrialBusy(false);
    }
  }

  if(!product) return <NotFound/>;

  const ext = (product.extendedContent || (product as any)?.extended_content) as AgentExtendedContent | undefined;
  const isVideo = ext?.heroMediaType === 'video' || (ext?.heroMediaUrl && (/\.(mp4|webm)$/i.test(ext.heroMediaUrl) || Boolean(parseYouTubeVideoId(ext.heroMediaUrl))));

  useEffect(() => {
    if (selectedGalleryIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGalleryIndex(null);
      } else if (e.key === 'ArrowLeft' && ext?.gallery?.length) {
        setSelectedGalleryIndex(prev => prev !== null ? (prev - 1 + ext.gallery!.length) % ext.gallery!.length : null);
      } else if (e.key === 'ArrowRight' && ext?.gallery?.length) {
        setSelectedGalleryIndex(prev => prev !== null ? (prev + 1) % ext.gallery!.length : null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGalleryIndex, ext?.gallery]);

  return (
    <div className="container page">
      {trialModal && (
        <div className="modal-overlay" style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
          <div className="panel" style={{maxWidth: 420, width: '100%', textAlign:'center', padding:'40px 30px', position:'relative'}}>
            {trialSuccess ? (
              <>
                <div style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'var(--green)', color: 'var(--black)', marginBottom: 24}}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3>Trial Activated!</h3>
                <p style={{marginBottom: 24}}>Your free trial for <b>{product.name}</b> is ready. The unique activation key has been added to your dashboard.</p>
                <a className="button primary full" href="/account/agents" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
                  Download Desktop App &amp; View Key <ArrowUpRight size={17} />
                </a>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'left', marginBottom: 20, background: 'rgba(255,255,255,0.03)', padding: '18px 20px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 14px 0', fontSize: 17, color: 'var(--lime, #98e038)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🎁 What&apos;s Included in your 1-Day Free Trial
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {((ext?.trial_highlights && ext.trial_highlights.length > 0) ? ext.trial_highlights : getDefaultAgentTrialHighlights(product.slug)).map((hl: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text, #f0f3ee)', lineHeight: 1.5 }}>
                        <Check size={16} style={{ color: 'var(--lime, #98e038)', flexShrink: 0, marginTop: 2.5 }} />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-light, #99a890)', borderTop: '1px solid var(--border)', paddingTop: 12, lineHeight: 1.5 }}>
                    💡 <b>Note:</b> {ext?.trial_notice || getDefaultAgentTrialNotice(product.slug)}
                  </div>
                </div>
                {trialError && <div className="notice error" style={{marginBottom: 16}}>{trialError}</div>}
                <div style={{display: 'flex', gap: 12}}>
                  <a className="button secondary full" href={`/checkout/${product.slug}`} style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    View Paid Plans ↗
                  </a>
                  <button className="button primary full" onClick={startTrial} disabled={trialBusy}>
                    {trialBusy ? 'Activating...' : 'Activate 1-Day Trial'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedPillar && (
        <div 
          className="modal-overlay" 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setSelectedPillar(null)}
        >
          <div 
            className="panel" 
            style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '32px 28px', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedPillar(null)} 
              className="icon-button" 
              aria-label="Close dialog"
              style={{ position: 'absolute', top: 16, right: 16 }}
            >
              <X size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="pillar-icon-box" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(212, 248, 156, 0.1)', color: 'var(--lime)' }}>
                <PillarIcon name={selectedPillar.icon} size={20} />
              </div>
              {selectedPillar.tag && <span className="pillar-tag">{selectedPillar.tag}</span>}
            </div>
            <h2 style={{ fontSize: 24, letterSpacing: '-0.5px', marginBottom: 14 }}>{selectedPillar.title}</h2>
            {selectedPillar.mediaUrl && (
              <div style={{ margin: '18px 0', borderRadius: 8, overflow: 'hidden', background: '#000', border: '1px solid var(--border)' }}>
                {/\.(mp4|webm)$/i.test(selectedPillar.mediaUrl) || Boolean(parseYouTubeVideoId(selectedPillar.mediaUrl)) ? (
                  <SmartVideoPlayer url={selectedPillar.mediaUrl} title={selectedPillar.title} showExternalLink={false} autoPlay={false} />
                ) : (
                  <img src={selectedPillar.mediaUrl} alt={selectedPillar.title} style={{ width: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }} />
                )}
              </div>
            )}
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-light)', marginTop: 14, whiteSpace: 'pre-line' }}>
              {selectedPillar.description}
            </p>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="button secondary" onClick={() => setSelectedPillar(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {selectedGalleryIndex !== null && ext?.gallery && ext.gallery[selectedGalleryIndex] && (() => {
        const currentItem = ext.gallery[selectedGalleryIndex];
        const hasMultiple = ext.gallery.length > 1;
        const totalItems = ext.gallery.length;

        const handlePrev = (e?: React.MouseEvent) => {
          e?.stopPropagation();
          setSelectedGalleryIndex((selectedGalleryIndex - 1 + totalItems) % totalItems);
        };

        const handleNext = (e?: React.MouseEvent) => {
          e?.stopPropagation();
          setSelectedGalleryIndex((selectedGalleryIndex + 1) % totalItems);
        };

        return (
          <div
            className="modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.92)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backdropFilter: 'blur(6px)',
            }}
            onClick={() => setSelectedGalleryIndex(null)}
          >
            <div
              className="panel gallery-lightbox-panel"
              style={{
                maxWidth: 1040,
                width: '100%',
                maxHeight: '94vh',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                padding: '24px',
                background: 'var(--panel, #121711)',
                border: '1px solid var(--line, #2a3824)',
                borderRadius: 14,
                overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(152, 224, 56, 0.12)', border: '1px solid rgba(152, 224, 56, 0.25)', color: 'var(--lime, #98e038)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Visual #{selectedGalleryIndex + 1} of {totalItems}
                  </span>
                  {currentItem.type && currentItem.type !== 'image' && (
                    <span className="badge" style={{ textTransform: 'uppercase', fontSize: 11 }}>
                      {currentItem.type}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {hasMultiple && (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={handlePrev}
                        title="Previous visual (←)"
                        aria-label="Previous visual"
                        style={{ width: 34, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={handleNext}
                        title="Next visual (→)"
                        aria-label="Next visual"
                        style={{ width: 34, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedGalleryIndex(null)}
                    className="icon-button"
                    aria-label="Close dialog"
                    style={{ width: 34, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {currentItem.title && (
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 14px 0', color: '#f0f3ee', letterSpacing: '-0.3px' }}>
                  {currentItem.title}
                </h2>
              )}

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  background: '#070a06',
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 280,
                  maxHeight: '66vh',
                }}
              >
                {currentItem.type === 'video' || /\.(mp4|webm)$/i.test(currentItem.url) || Boolean(parseYouTubeVideoId(currentItem.url)) ? (
                  <SmartVideoPlayer url={currentItem.url} controls title={currentItem.title || currentItem.caption || `${product.name} visual`} />
                ) : (
                  <img
                    src={currentItem.url}
                    alt={currentItem.title || currentItem.caption || `${product.name} interface visual`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '66vh',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                )}

                {hasMultiple && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous visual"
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.65)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next visual"
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.65)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <ChevronRight size={22} />
                    </button>
                  </>
                )}
              </div>

              {currentItem.caption && (
                <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#ced6c7', whiteSpace: 'pre-line' }}>
                    {currentItem.caption}
                  </p>
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Tip: Use Left (←) / Right (→) keys to navigate · Esc to close
                </span>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setSelectedGalleryIndex(null)}
                  style={{ fontSize: 13, padding: '6px 18px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <a className="breadcrumb" href="/agents" style={{ marginBottom: 0 }}>&larr; All agents</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {ext?.social_proof_text && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: 'rgba(152, 224, 56, 0.08)',
              border: '1px solid rgba(152, 224, 56, 0.25)',
              color: 'var(--lime, #98e038)',
              fontSize: 12.5,
              fontWeight: 600,
            }}>
              <span>{ext.social_proof_text}</span>
            </div>
          )}
          {ext?.badgeText && (
            <div className="agent-badge-pill" style={{ marginBottom: 0 }}>
              <Sparkles size={14} style={{ color: 'var(--lime)' }} />
              <span>{ext.badgeText}</span>
            </div>
          )}
        </div>
      </div>

      <div className="detail-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <ProductIcon product={product} size={48}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="category" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                {product.subHeading || product.extendedContent?.subHeading || (typeof product.category === 'string' ? product.category : product.category?.name) || 'Desktop Agent'}
              </span>
              <span style={{ color: 'var(--border)' }}>&middot;</span>
              {product.releaseStatus === 'live' && product.status !== 'archived' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#4ade80', fontWeight: 700, fontSize: 13 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block' }} />
                  Live
                </span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{product.releaseStatus === 'development' ? 'In development' : product.releaseStatus === 'prelaunch' ? 'Preparing for launch' : 'Sales paused'}</span>
              )}
            </div>
          </div>
          <h1>{product.name}</h1>
          <p className="lead">{product.tagline}</p>
          <p>{product.description}</p>

          {ext?.platformBadges && ext.platformBadges.length > 0 && (
            <div className="agent-platform-chips">
              <span style={{ fontSize: 11, letterSpacing: 0.8, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Works With:</span>
              {ext.platformBadges.map((badge, idx) => (
                <span key={idx} className="platform-chip">
                  <Check size={13} />
                  {badge}
                </span>
              ))}
            </div>
          )}

          <div className="detail-features">
            {(product.features||[]).map(f=>(
              <span key={f}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                {f}
              </span>
            ))}
          </div>

          {ext?.heroMediaUrl && (
            <div className="hero-showcase-media">
              {isVideo ? (
                <SmartVideoPlayer url={ext.heroMediaUrl} autoPlay loop muted controls title={`${product.name} showcase`} />
              ) : (
                <img src={ext.heroMediaUrl} alt={`${product.name} showcase`} style={{ width: '100%', height: 'auto', display: 'block' }} />
              )}
            </div>
          )}
        </div>

        <aside className="purchase-panel">
          <span className="eyebrow">MAKE IT PART OF YOUR WORKDAY</span>
          {accountLoading && !account ? (
            <div className="purchase-skeleton" style={{ padding: '8px 0 12px 0' }}>
              <div style={{ height: '30px', width: '55%', background: 'rgba(255,255,255,0.08)', borderRadius: 6, marginBottom: 12, animation: 'pulse 1.8s infinite ease-in-out' }} />
              <div style={{ height: '16px', width: '75%', background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 18, animation: 'pulse 1.8s infinite ease-in-out' }} />
              <div style={{ height: '42px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 8, animation: 'pulse 1.8s infinite ease-in-out' }} />
            </div>
          ) : ownsProduct ? (
            <>
              <h2>Ready to go.</h2>
              <p>You already own a license for {product.name}.</p>
              <a className="button primary full" href="/account/agents">Download agent &amp; view key <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></a>
              <span className="small-note" style={{display: 'inline-block', marginTop: 8}}>Manage your installation in your workspace.</span>
            </>
          ) : (
            <>
              <h2 style={{display:'flex', flexDirection:'column'}}>
                {(settings?.saleActive && settings?.salePercentage && product.is_on_sale && /\d/.test(product.price || '')) ? (
                  <>
                    <span style={{textDecoration:'line-through', fontSize:'0.5em', opacity:0.6, marginBottom: '-10px'}}>{product.price}</span>
                    <span style={{color:'var(--green)'}}>
                      {product.price?.replace(/(\d+(?:,\d+)?)/, (match: string) => Math.floor(parseFloat(match.replace(/,/g, '')) * (1 - (settings?.salePercentage || 0) / 100)).toLocaleString())}
                    </span>
                  </>
                ) : product.price}
              </h2>
              <p>Flexible access &middot; Try before you buy</p>
              {product.releaseStatus === 'prelaunch' ? (
                <button className="button secondary full" disabled style={{ opacity: 0.9, borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}>
                  🚀 Preparing for Launch &mdash; Available Soon
                </button>
              ) : product.releaseStatus === 'development' ? (
                <button className="button secondary full" disabled>In development &mdash; sales unavailable</button>
              ) : product.status === 'archived' ? (
                <button className="button secondary full" disabled>Archived &mdash; sales paused</button>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <a className="button primary full" href={'/checkout/'+product.slug}>{product.releaseStatus === 'live' ? 'Buy now' : 'View availability'} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></a>
                  {product.trialActive !== false && <button className="button secondary full" onClick={() => setTrialModal(true)}>Start free trial</button>}
                </div>
              )}
              {ext?.guarantee_badge && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: 12,
                  color: 'var(--muted, #8e9e87)',
                  textAlign: 'center'
                }}>
                  <span>{ext.guarantee_badge}</span>
                </div>
              )}
            </>
          )}
          {(() => {
            const highlights = (ext?.paid_highlights && ext.paid_highlights.length > 0)
              ? ext.paid_highlights
              : getDefaultAgentPaidHighlights(product.slug);
            return (
              <div className="paid-highlights-box" style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, color: 'var(--lime, #98e038)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  👑 What&apos;s Included in Paid Licenses:
                </h4>
                <div className="highlights-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                  {highlights.map((hl: string, idx: number) => (
                    <div key={idx} className="highlight-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, color: 'var(--text, #f0f3ee)' }}>
                      <Check size={16} style={{ color: 'var(--lime, #98e038)', flexShrink: 0, marginTop: 2.5 }} />
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </aside>
      </div>

      {ext?.featurePillars && ext.featurePillars.length > 0 && (
        <section className="pillars-section">
          <div className="section-heading" style={{ marginBottom: 20 }}>
            <div>
              <span className="eyebrow">BUILT DIFFERENT</span>
              <h2>Core Capabilities</h2>
            </div>
            <p className="section-aside">Engineered for precision, high throughput, and effortless execution.</p>
          </div>
          <div className="pillars-grid">
            {ext.featurePillars.map(pillar => (
              <div 
                key={pillar.id} 
                className="pillar-card"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth > 768) {
                    setSelectedPillar(pillar);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedPillar(pillar); }}
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div className="pillar-header">
                  <div className="pillar-icon-box">
                    <PillarIcon name={pillar.icon} size={20} />
                  </div>
                  {pillar.tag && <span className="pillar-tag">{pillar.tag}</span>}
                </div>
                <h3>{pillar.title}</h3>
                <p>{pillar.shortDescription || pillar.description}</p>
                <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                  <button
                    type="button"
                    className="pillar-action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPillar(pillar);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12.5,
                      color: 'var(--lime, #98e038)',
                      fontWeight: 600,
                      fontFamily: 'inherit'
                    }}
                  >
                    <span>{pillar.mediaUrl ? 'View demo & details' : 'Explore capability'}</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {ext?.gallery && ext.gallery.length > 0 && (
        <section className="gallery-section">
          <div className="section-heading" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="eyebrow">SEE IT IN ACTION</span>
              <h2>Interface &amp; Visuals</h2>
              <p className="section-aside" style={{ margin: '4px 0 0 0' }}>
                A closer look at how {product.name} operates on your desktop.
              </p>
            </div>
            {ext.gallery.length > 1 && (
              <div className="gallery-nav-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>
                  {ext.gallery.length} visual{ext.gallery.length === 1 ? '' : 's'} &middot; Scroll to explore
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Scroll visuals left"
                  onClick={() => {
                    galleryScrollRef.current?.scrollBy({ left: -380, behavior: 'smooth' });
                  }}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Scroll visuals right"
                  onClick={() => {
                    galleryScrollRef.current?.scrollBy({ left: 380, behavior: 'smooth' });
                  }}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="gallery-track gallery-scroll" ref={galleryScrollRef}>
            {ext.gallery.map((item, idx) => (
              <div
                key={item.id}
                className="gallery-card"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth > 768) {
                    setSelectedGalleryIndex(idx);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedGalleryIndex(idx);
                  }
                }}
              >
                <div className="gallery-media-wrap">
                  {item.type === 'video' || /\.(mp4|webm)$/i.test(item.url) || Boolean(parseYouTubeVideoId(item.url)) ? (
                    <SmartVideoPlayer url={item.url} controls title={item.title || item.caption || `${product.name} visual #${idx + 1}`} />
                  ) : (
                    <img src={item.url} alt={item.title || item.caption || `${product.name} visual #${idx + 1}`} loading="lazy" />
                  )}
                  <div className="gallery-zoom-badge">
                    <Eye size={13} />
                    <span>Expand view</span>
                  </div>
                </div>

                <div className="gallery-card-body">
                  <h3 className="gallery-item-title">
                    {item.title ? item.title : `Visual #${idx + 1}`}
                  </h3>
                  {item.caption && (
                    <p className="gallery-item-caption">
                      {item.caption}
                    </p>
                  )}
                  <div className="gallery-card-footer">
                    <span className="gallery-desktop-hint">
                      <span>Click to view in high-res</span>
                      <ArrowUpRight size={13} />
                    </span>
                    <button
                      type="button"
                      className="gallery-mobile-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGalleryIndex(idx);
                      }}
                    >
                      <span>View Visual</span>
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {ext?.comparison && ext.comparison.rows && ext.comparison.rows.length > 0 && (
        <section className="comparison-section">
          <div className="section-heading" style={{ marginBottom: 20 }}>
            <div>
              <span className="eyebrow">HEAD-TO-HEAD BREAKDOWN</span>
              <h2>{ext.comparison.headline || `Why ${product.name} Leads the Industry`}</h2>
            </div>
            <p className="section-aside">Transparent side-by-side comparison with traditional alternatives.</p>
          </div>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Feature / Capability</th>
                  <th className="us-col" style={{ width: '24%' }}>{product.name} (NORVI)</th>
                  <th style={{ width: '18%' }}>{ext.comparison.competitor1Name || 'Alternative 1'}</th>
                  <th style={{ width: '18%' }}>{ext.comparison.competitor2Name || 'Alternative 2'}</th>
                </tr>
              </thead>
              <tbody>
                {ext.comparison.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td><b>{row.feature}</b></td>
                    <td className="us-col">{renderComparisonCell(row.us, true)}</td>
                    <td>{renderComparisonCell(row.comp1, false)}</td>
                    <td>{renderComparisonCell(row.comp2, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ext?.workflowSteps && ext.workflowSteps.length > 0 && (
        <section className="agent-workflow-section">
          <div className="section-heading" style={{ marginBottom: 20 }}>
            <div>
              <span className="eyebrow">SIMPLE SETUP</span>
              <h2>How It Works</h2>
            </div>
            <p className="section-aside">Up and running on your system in under two minutes.</p>
          </div>
          <div className="agent-steps-grid">
            {ext.workflowSteps.map((step, idx) => (
              <div key={idx} className="agent-step-card">
                <span className="agent-step-number">{step.step || `0${idx + 1}`}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="two-column">
        <section className="panel">
          <h2>{product.workflowHeading || 'Built for your workflow.'}</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{product.workflowDescription || product.description}</p>
          <div className="demo-placeholder" style={{ position: "relative", padding: 0, overflow: "hidden" }}>
            {product.workflowMediaUrl ? (
              (product.workflowMediaUrl.match(/\.(mp4|webm)$/i) || Boolean(parseYouTubeVideoId(product.workflowMediaUrl))) ? 
              <SmartVideoPlayer url={product.workflowMediaUrl} controls title={`${product.name} walkthrough`} /> : 
              <img src={product.workflowMediaUrl} alt="Walkthrough" style={{ width: "100%", height: "auto", display: "block" }} />
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                <h3>{product.name} walkthrough</h3>
                <p>A product walkthrough will appear here.</p>
              </>
            )}
          </div>
          {product.workflowNote && <p className="small-note" style={{ marginTop: "1rem", whiteSpace: "pre-line" }}>{product.workflowNote}</p>}
        </section>
        <section className="panel">
          <h3>Before you get started</h3>
          <dl>
            <dt>System requirements</dt><dd>{product.requirements}</dd>
            <dt>Current release</dt><dd>{product.version}</dd>
            <dt>AI usage</dt><dd>{product.aiUsage || 'Unlimited Cloud AI Usage Included · Zero Token Surcharges'}</dd>
            <dt>Device allowance</dt><dd>{product.deviceAllowance || 'Up to 3 active personal computers per license.'}</dd>
          </dl>
          <a href="/help" className="text-button">Installation &amp; activation <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></a>
        </section>
      </div>

      {ext?.faqs && ext.faqs.length > 0 && (
        <section className="agent-faq-section">
          <div className="section-heading" style={{ marginBottom: 20 }}>
            <div>
              <span className="eyebrow">COMMON QUESTIONS</span>
              <h2>Frequently Asked Questions</h2>
            </div>
            <p className="section-aside">Everything you need to know about {product.name}.</p>
          </div>
          <div className="agent-faq-list">
            {ext.faqs.map((faq, idx) => (
              <details key={idx}>
                <summary>
                  <span>{faq.question}</span>
                  <Plus size={18} />
                </summary>
                <p style={{ whiteSpace: 'pre-line' }}>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="agent-cta-banner">
        <div>
          <span className="eyebrow" style={{ color: 'var(--lime)', marginBottom: 8 }}>
            {accountLoading && !account ? 'CHECKING ACCESS' : ownsProduct ? 'READY IN YOUR ACCOUNT' : 'GET STARTED TODAY'}
          </span>
          <h2>Ready to deploy {product.name}?</h2>
          <p>
            {ownsProduct
              ? `You already own an active license for ${product.name}. Access your installer and personal activation key in your dashboard.`
              : 'Join professionals using NORVI autonomous agents to streamline their daily routine.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {accountLoading && !account ? (
            <div style={{ height: '42px', width: '180px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, animation: 'pulse 1.8s infinite ease-in-out' }} />
          ) : ownsProduct ? (
            <a className="button primary" href="/account/agents">
              Download agent &amp; view key <ArrowUpRight size={18} />
            </a>
          ) : (
            <>
              {product.releaseStatus === 'prelaunch' ? (
                <button className="button secondary" disabled style={{ opacity: 0.9, borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}>
                  🚀 Preparing for Launch &mdash; Available Soon
                </button>
              ) : product.releaseStatus === 'development' ? (
                <button className="button secondary" disabled>
                  In Development &mdash; Sales Unavailable
                </button>
              ) : product.status === 'archived' ? (
                <button className="button secondary" disabled>
                  Archived &mdash; Sales Paused
                </button>
              ) : (
                <>
                  <a className="button primary" href={'/checkout/' + product.slug}>
                    Get {product.name} <ArrowUpRight size={18} />
                  </a>
                  {product.trialActive !== false && (
                    <button className="button secondary" onClick={() => setTrialModal(true)}>
                      Start free trial
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const helpItems=[
  ['Getting started & account setup','Create your verified account in 30 seconds. Explore our catalog of desktop agents, check the operating system requirements (Windows 10/11 64-bit or macOS 12+), and choose your preferred license tier.'],
  ['Instant key delivery & retrieval','Your unique license key (NORVI-••••-••••) is generated instantly upon payment. You can find it anytime in your dashboard under "Keys & devices", where you can reveal or copy it with a single click.'],
  ['Installing on Windows & macOS','Download the installer from "My agents". On Windows, because agent builds are regularly updated, SmartScreen may show an alert—click "More info" followed by "Run anyway". On macOS, open the DMG and move the app to Applications.'],
  ['Multi-device management (up to 3 PCs)','Each license includes activation on up to 3 personal machines simultaneously. If you upgrade your PC or need to switch machines, open your "Keys & devices" dashboard and click "Release device" with zero hassle.'],
  ['1-Day offline license lease','Our desktop apps are engineered for daily reliability. Once activated, your agent\'s license authorization remains valid on your machine for 24 hours before a background check, allowing uninterrupted workflow management.'],
  ['Payment methods & Razorpay security','We support instant checkout via UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards, and Netbanking powered by Razorpay. Verified invoices are available in your Billing tab.'],
  ['Partner program & referral earnings','Earn 15% commission on every customer referral while giving your audience an exclusive 10% discount. Generate your unique referral code from the Partner tab in your account dashboard.'],
  ['Trouble activating or running an agent?','Ensure you are entering the key for the matching agent product and that your machine has an internet connection for initial verification. If you run into issues, message our WhatsApp support for live troubleshooting.']
];
export function Help(){
  const [query,setQuery]=useState('');
  return (
    <div className="container page">
      <PageHeading eyebrow="THE NORVI HELP CENTER" title="A little help goes a long way." description="Find your way from your first visit to your first activation."/>
      
      <div style={{ marginBottom: 32 }}>
        <SupportChatBox
          context="help"
          title="Ask NORVI AI Support Assistant"
          subtitle="Instant 24/7 answers for agent setup, 1-day offline mode, machine activations, and payments. If our AI cannot resolve your issue, it will connect you with our engineering team on WhatsApp or via support ticket."
          quickQuestions={[
            "How does 1-day offline mode work?",
            "Can I run my license on 2 or 3 computers?",
            "How does Voro work in interviews?",
            "Where is my activation key delivered?"
          ]}
        />
      </div>

      <label className="search large-search"><Search size={20}/><input aria-label="Search help" placeholder="Search activation, downloads, payments..." value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="help-grid">{helpItems.filter(([t,d])=>(t+d).toLowerCase().includes(query.toLowerCase())).map(([t,d],i)=><article className="panel" key={t}><span className="help-number">0{i+1}</span><h3>{t}</h3><p>{d}</p></article>)}</div><div className="inline-callout" style={{marginTop:24,border:'1px solid rgba(37, 211, 102, 0.3)',background:'rgba(37, 211, 102, 0.05)'}}><div><h3 style={{display:'flex',alignItems:'center',gap:8,color:'#25D366'}}><span style={{width:8,height:8,borderRadius:'50%',background:'#25D366',display:'inline-block'}}/>Need fast assistance? Connect on WhatsApp</h3><p>Our engineering support team is available Mon–Sat, 10 AM – 8 PM IST. Typical response time is under 30 minutes.</p></div><a className="button primary" style={{background:'#25D366',color:'#000',borderColor:'transparent',gap:8}} href="https://wa.me/919893534314?text=Hi%20NORVI%20Agency%2C%20I%20need%20help%20with%20an%20agent." target="_blank" rel="noopener noreferrer"><OfficialWhatsAppIcon size={18} color="#000000"/> Chat on WhatsApp <ArrowUpRight size={16}/></a></div><div className="inline-callout"><div><h3>Still need a hand?</h3><p>Your account keeps your support requests together.</p></div><a className="button secondary" href="/account/support">Contact support <ArrowRight size={16}/></a></div></div>
  );
}

export function PartnerProgram({settings, user}: {settings?: any; user?: User | null}) {
  const { data: partnerData } = useData('/partner/stats');
  const isPartner = Boolean(partnerData?.active);
  const isLoggedIn = Boolean(user);

  return (
    <div className="container page">
      <PageHeading
        eyebrow="PARTNER PROGRAM"
        title="Grow with NORVI."
        description="Join our affiliate program and earn commissions by recommending our AI agents."
      />
      <div className="two-column" style={{marginTop: '40px'}}>
        <div className="panel" style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <h3><Activity className="accent" size={24} style={{verticalAlign: 'middle', marginRight: '10px'}}/>How it works</h3>
          <p>We believe in rewarding those who help us grow. By joining the NORVI Partner Program, you receive a unique referral code. When new customers use your code to purchase an agent, they get a discount, and you earn a direct commission on the sale.</p>
          <ul style={{paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <li><b>Generous Commissions:</b> Earn a 15% commission on every successful referral.</li>
            <li><b>Customer Discounts:</b> Your audience gets an exclusive 10% discount.</li>
            <li><b>Transparent Payouts:</b> Track your earnings and payouts directly from your dashboard.</li>
          </ul>

          {isPartner ? (
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="badge good" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12 }}>
                  <Check size={14} /> You are an Active Partner
                </span>
                {partnerData?.code && (
                  <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
                    Referral Code: <code style={{ color: 'var(--lime)', fontWeight: 700, padding: '2px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>{partnerData.code}</code>
                  </span>
                )}
              </div>
              <a href="/account/partner" className="button primary" style={{ alignSelf: 'flex-start' }}>
                Go to Partner Dashboard <ArrowRight size={17}/>
              </a>
            </div>
          ) : isLoggedIn ? (
            <a href="/account/partner" className="button primary" style={{marginTop: 'auto', alignSelf: 'flex-start'}}>
              Activate Your Partner Code <ArrowRight size={17}/>
            </a>
          ) : (
            <a href="/register" className="button primary" style={{marginTop: 'auto', alignSelf: 'flex-start'}}>
              Join the Partner Program <ArrowUpRight size={17}/>
            </a>
          )}
        </div>

        <div className="panel" style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <h3><ShieldCheck className="accent" size={24} style={{verticalAlign: 'middle', marginRight: '10px'}}/>Program Criteria &amp; Status</h3>
          <p>Our program is designed for creators, agencies, and tech enthusiasts who understand the value of AI automation.</p>
          
          {isPartner ? (
            <div style={{background: 'rgba(200, 255, 100, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(200, 255, 100, 0.25)'}}>
              <h4 style={{margin: '0 0 10px 0', color: 'var(--lime)', display: 'flex', alignItems: 'center', gap: 6}}>
                <Check size={16} /> Partner Account Active
              </h4>
              <p style={{margin: 0, fontSize: '14px', color: 'var(--text-light)', lineHeight: 1.6}}>
                You are already registered in the NORVI Partner Program with active code <b>{partnerData?.code}</b>. You can track your referrals, view real-time commission earnings, and request payouts directly from your account.
              </p>
            </div>
          ) : (
            <div style={{background: 'rgba(200, 255, 100, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)'}}>
              <h4 style={{margin: '0 0 10px 0'}}>Getting Started</h4>
              <p style={{margin: 0, fontSize: '14px', color: 'var(--text-light)'}}>
                {isLoggedIn
                  ? `Signed in as ${user?.name || user?.email}. Open your dashboard and navigate to the Partner Program tab to generate your unique referral code instantly.`
                  : 'Create a standard NORVI account, then navigate to your dashboard and open the "Partners & Payouts" tab to generate your unique referral code instantly.'}
              </p>
            </div>
          )}

          {isPartner ? (
            <a href="/account/partner" className="text-button" style={{marginTop: 'auto', alignSelf: 'flex-start'}}>
              View Referrals &amp; Payouts <ArrowRight size={16}/>
            </a>
          ) : isLoggedIn ? (
            <a href="/account/partner" className="text-button" style={{marginTop: 'auto', alignSelf: 'flex-start'}}>
              Open Partner Tab <ArrowRight size={16}/>
            </a>
          ) : (
            <a href="/login" className="text-button" style={{marginTop: 'auto', alignSelf: 'flex-start'}}>
              Already a partner? Sign in <ArrowRight size={16}/>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function About(){
  return (
    <div className="container page">
      <PageHeading
        eyebrow="THE IDEA BEHIND NORVI"
        title="More room for meaningful work."
        description="We’re building a collection of AI agents to help people spend less time on repetitive tasks."
      />
      <div className="about-feature">
        <span className="serif">
          Possibility<br />starts with<br />a little space.
        </span>
        <div>
          <span className="eyebrow">OUR STARTING POINT</span>
          <h2>Useful tools.<br />A human purpose.</h2>
          <p>
            NORVI is taking its first steps. Our aim is simple: make it easier to discover, purchase, and manage AI agents that fit the way you work.
          </p>
          <p>
            Every product will have a clear purpose, an honest demonstration, and an explanation of what you need to use it.
          </p>
        </div>
      </div>

      <div className="steps">
        <div className="step">
          <span>01</span>
          <h3>Start with the task.</h3>
          <p>Build around a real problem, not a list of buzzwords.</p>
        </div>
        <div className="step">
          <span>02</span>
          <h3>Keep things clear.</h3>
          <p>Explain capabilities, requirements, usage, and access before purchase.</p>
        </div>
        <div className="step">
          <span>03</span>
          <h3>Grow thoughtfully.</h3>
          <p>Learn from customers and make the useful things better.</p>
        </div>
      </div>

      {/* Meet the Founder Section */}
      <div className="panel" style={{ marginTop: '40px', padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--lime)' }} />
          <span className="eyebrow" style={{ color: 'var(--lime)', margin: 0, fontSize: '11px', letterSpacing: '1px' }}>
            FOUNDER &amp; ARCHITECT
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '26px' }}>Chirag Sharma</h2>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '14px' }}>
              Founder &amp; Lead AI Engineer &middot; Based in India 🇮🇳
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href="https://chirag-portfolio-v3.netlify.app/"
              target="_blank"
              rel="noreferrer"
              className="button primary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              Founder Portfolio <ArrowUpRight size={15} />
            </a>
            <a
              href="https://www.instagram.com/norviagency/?hl=en"
              target="_blank"
              rel="noreferrer"
              className="button secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Instagram size={15} style={{ color: '#E1306C' }} /> Instagram
            </a>
            <a
              href="https://www.youtube.com/@NorviAgency"
              target="_blank"
              rel="noreferrer"
              className="button secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Youtube size={15} style={{ color: '#FF0000' }} /> YouTube
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-light)', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <p style={{ margin: 0 }}>
            NORVI Agency was founded by <b>Chirag Sharma</b> with a single focused vision: to engineer autonomous desktop AI agents that combine native system-level capabilities (like invisible screen capture, earpiece whisper, and desktop automation) with powerful, fully managed cloud AI intelligence—without forcing professionals to pay per-token fees, configure complex models, or buy expensive GPUs.
          </p>
          <p style={{ margin: 0 }}>
            Every product in the agency—including <b>Voro</b> (the discreet real-time coding copilot and interview assistant), <b>Rolvio</b> (the autonomous job application hunter), and <b>Nexus</b> (the 24/7 video-to-shorts content studio)—is personally designed, built, and maintained with a privacy-respecting native desktop architecture.
          </p>
          <p style={{ margin: 0 }}>
            As the solo creator and lead architect behind the NORVI platform, Chirag actively oversees development, release hardening, and customer support. If you have questions, partnerships, or custom enterprise inquiries, reach out directly through the portfolio link or our contact center.
          </p>
        </div>
      </div>
    </div>
  );
}
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
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const message = String(formData.get('message') || '').trim();

    try {
      // 1. Submit to API to trigger Discord Webhook (# │ norvi-contact)
      const apiPromise = api('/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, message }),
      }).catch(err => {
        console.warn('API contact notification warning:', err);
      });

      // 2. Submit to Netlify Forms endpoint for dashboard tracking
      const netlifyPromise = fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form) as any).toString(),
      }).catch(err => {
        console.warn('Netlify form submission warning:', err);
      });

      await Promise.all([apiPromise, netlifyPromise]);

      setSent(true);
      form.reset();
    } catch (err) {
      setError('Sorry, we could not send your message. Please email us directly.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <PageHeading eyebrow="LET'S TALK" title="Good work starts with a conversation." description="Questions about an agent or your account? Find the right place to start."/>

      <div style={{ marginBottom: 32 }}>
        <SupportChatBox
          context="contact"
          title="Try Instant AI Resolution First"
          subtitle="Ask our AI agent your question before sending a message—get verified answers in 3 seconds. If your issue requires manual engineering assistance, use the contact form or WhatsApp below."
          quickQuestions={[
            "How do I switch machines with my key?",
            "Can I use agents offline without WiFi?",
            "What payment methods do you accept?",
            "How does Voro keep interviews private?"
          ]}
          onEscalateToContact={() => {
            const form = document.getElementById('contact-form');
            if (form) form.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      <div className="two-column">
        <div className="panel">
          <Mail className="accent"/>
          <h3>Get in touch</h3>
          <p><strong>Norvi AI Agency</strong><br/>Kunj Vihar, Gole ka mandir<br/>Gwalior, Madhya Pradesh<br/>India, 474005<br/>Phone: +91-9893534314</p>
          <p>Email: {settings.email}</p>
          <p>Support hours: Mon-Sat, 10am-8pm IST</p>
          <div className="contact-social-links" style={{display:'flex',gap:'1.2rem',marginTop:'1.5rem',marginBottom:'1.5rem'}}>
            {settings.socialInstagram && <a href={settings.socialInstagram} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Instagram size={22}/></a>}
            {settings.socialYoutube && <a href={settings.socialYoutube} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Youtube size={22}/></a>}
            {settings.socialFacebook && <a href={settings.socialFacebook} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Facebook size={22}/></a>}
            {settings.socialTwitter && <a href={settings.socialTwitter} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Twitter size={22}/></a>}
          </div>
          <form id="contact-form" name="contact" method="POST" data-netlify="true" onSubmit={handleSubmit}>
            <input type="hidden" name="form-name" value="contact" />
            <Field label="Your name"><input type="text" name="name" required placeholder="Your name" disabled={busy}/></Field>
            <Field label="Email address"><input type="email" name="email" required placeholder="you@example.com" disabled={busy}/></Field>
            <Field label="Your message"><textarea name="message" required minLength={3} placeholder="What can we help you with?" rows={4} disabled={busy}/></Field>
            <button className="button secondary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send message'} <ArrowRight size={16}/></button>
            {error&&<Notice kind="error">{error}</Notice>}
            {sent&&<Notice kind="success">Your message has been sent to our support team. We'll be in touch shortly!</Notice>}
          </form>
        </div>
        <div>
          <div className="panel" style={{background:'rgba(37, 211, 102, 0.05)',border:'1px solid rgba(37, 211, 102, 0.3)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'#25D366',display:'inline-block'}}/>
              <span className="eyebrow" style={{color:'#25D366',margin:0,fontSize:11,letterSpacing:'1px'}}>FASTEST RESPONSE</span>
            </div>
            <h3 style={{margin:'0 0 8px 0'}}>Chat on WhatsApp</h3>
            <p style={{margin:'0 0 16px 0',fontSize:14}}>Have questions before purchasing or need immediate setup assistance? Reach out directly to our engineering support team.</p>
            <div style={{fontSize:13,color:'var(--text-light)',marginBottom:16,lineHeight:1.7}}>
              <div><b>Direct WhatsApp:</b> +91 9893534314</div>
              <div><b>Hours:</b> Mon–Sat, 10:00 AM – 8:00 PM IST</div>
              <div><b>Typical Reply:</b> Within 30 minutes</div>
            </div>
            <a href="https://wa.me/919893534314?text=Hi%20NORVI%20Agency%2C%20I%20have%20a%20question%20about%20your%20AI%20agents." target="_blank" rel="noopener noreferrer" className="button primary" style={{background:'#25D366',color:'#000',width:'100%',justifyContent:'center',gap:8}}>
              <OfficialWhatsAppIcon size={18} color="#000000"/> Start WhatsApp Chat <ArrowUpRight size={16}/>
            </a>
          </div>
          <div className="panel">
            <LifeBuoy className="accent"/>
            <h3>Already have an account?</h3>
            <p>Keep your questions and purchase details in one place.</p>
            <a href="/account/support" className="text-button">Open account support <ArrowUpRight size={17}/></a>
          </div>
          <div className="panel">
            <h3>Prefer a quick answer?</h3>
            <p>Our help center covers accounts, keys, devices, and downloads.</p>
            <a href="/help" className="text-button">Browse the help center <ArrowUpRight size={17}/></a>
          </div>
        </div>
      </div>
    </div>
  );
}
const legal:Record<string,{title:string;sections:[string,string][]}>={privacy:{title:'Privacy policy',sections:[['Data we expect to collect','Account identity, profile details, purchase references, licenses, device activation records, and support requests.'],['How information will be used','To operate accounts, fulfill purchases, validate access, deliver support, and protect the service. Registration will not automatically opt you into marketing.'],['Service providers','We use trusted enterprise infrastructure for account security, Razorpay for encrypted payment processing, and verified services for transactional email delivery.'],['Retention and requests','You can delete your account at any time from your dashboard. For privacy inquiries, email norviagency@gmail.com.'],['Grievance Officer','In accordance with the Information Technology Act 2000, the name and contact details of the Grievance Officer are provided below.\n\nName: Gopal Ji Yadav\nEmail: Gopal2nd5654@gmail.com\nPhone: +91-6397916325\nAddress: Norvi AI Agency, Kunj Vihar, Gole ka mandir, Gwalior, Madhya Pradesh, India, 474005.']]},terms:{title:'Terms of service',sections:[['Business and Jurisdiction','These Terms govern your use of products and services offered by Norvi AI Agency, a registered entity in India. These Terms are subject to the exclusive jurisdiction of the courts in Gwalior, Madhya Pradesh, India.'],['Service scope','Norvi sells access to AI agents under flexible terms, including 1-Month, 3-Month, and Lifetime licenses. Product features, requirements, and duration are explicitly defined at checkout and on your dashboard.'],['Accounts and acceptable use','Customers will be responsible for keeping account credentials and activation keys private and using the products under their agreed license.'],['Payments and access','Payments are handled securely via Razorpay. All sales are final once the transaction is completed and the digital key is generated.']]},refunds:{title:'Refund & Cancellation Policy',sections:[['Eligibility','All sales are final once the purchase is completed and your unique license key is securely generated. Please review product details and any available promotions before purchasing. Digital delivery means we do not offer refunds once access is granted.'],['Cancellation','As our products are digital AI agents, orders cannot be cancelled once the payment is processed and the unique license key is generated and dispatched to your dashboard.'],['Request process','For technical issues preventing you from accessing the software, contact norviagency@gmail.com within 7 days.']]},delivery:{title:'Shipping & Delivery Policy',sections:[['Digital Delivery','We sell digital AI agent software and license keys. We do not ship physical products.'],['Instant Fulfillment','Upon successful payment, your unique activation key is delivered instantly to your registered email address.'],['Dashboard Access','Your purchased license key and the software download links will be immediately available in your account dashboard under "Keys & devices".']]},license:{title:'License agreement',sections:[['Product-specific access','Each license belongs to a customer and a particular product. A key for one agent cannot unlock another.'],['Devices and sharing','Your license is valid for your authorized devices based on the product. You may rotate or release active devices directly from your dashboard to manage your software connections securely.'],['Connection requirements','The agent requires periodic online validation. Once activated, your agent can operate offline for up to 24 hours (1 day) before performing a brief background license check.'],['Expiry and revocation','Licenses may be revoked for fraud or violation of terms. Subscriptions will expire at the end of their billing cycle unless renewed.'],['Updates and support','Access to updates and support corresponds to your active subscription tier or lifetime access rights.']]}};
export function Legal({kind}:{kind:string}){const doc=legal[kind];return <div className="container page legal"><PageHeading eyebrow="THE DETAILS" title={doc.title}/>{doc.sections.map(([title,body],i)=><section key={title}><h2>{i+1}. {title}</h2><p style={{whiteSpace:"pre-wrap"}}>{body}</p></section>)}<a href="/contact" className="text-button">Questions? Contact us <ArrowRight size={16}/></a></div>;}
export function Checkout({product, settings}:{product:Product|undefined; settings?:Settings}){
  const {data:config}=useData('/auth/config');
  const {data:account}=useData('/account');
  const ext = (product?.extendedContent || (product as any)?.extended_content) as AgentExtendedContent | undefined;
  const ownsLifetime = account?.licenses?.some((l:any) => l.productId === product?.id && l.status === 'active' && !l.expiresAt);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[accepted,setAccepted]=useState(false),[success,setSuccess]=useState(false);
  const [duration, setDuration] = useState<string>(() => {
    if (Number(product?.price_lifetime) > 0) return 'lifetime';
    if (Number(product?.price1m) > 0) return '1_month';
    if (Number((product as any)?.price1w || (product as any)?.price_1w) > 0) return '1_week';
    if (Number(product?.price3m) > 0) return '3_months';
    return 'lifetime';
  });
    const [referralCode, setReferralCode] = useState('');
    const [referralValid, setReferralValid] = useState<{valid: boolean; type?: string; discount?: number; reason?: string; allowedDurations?: string[]}|null>(null);
    const [checkingRef, setCheckingRef] = useState(false);
    const lastCodeRef = useRef<string>('');

    useEffect(() => {
      if (!referralCode || referralCode.trim() === '') {
        setReferralValid(null);
        lastCodeRef.current = '';
        return;
      }
      const delay = setTimeout(async () => {
        setCheckingRef(true);
        try {
          const res = await api('/checkout/validate-code', { method: 'POST', body: JSON.stringify({ code: referralCode, productId: product?.id, duration }) });
          if (res.valid) {
            setReferralValid(res);
            lastCodeRef.current = referralCode;
          } else if (res.reason === 'duration_mismatch' && res.allowedDurations && res.allowedDurations.length > 0) {
            if (lastCodeRef.current !== referralCode && !res.allowedDurations.includes(duration)) {
              lastCodeRef.current = referralCode;
              setDuration(res.allowedDurations[0]);
              setReferralValid({ valid: true, type: res.type, discount: res.discount, allowedDurations: res.allowedDurations });
            } else {
              setReferralValid(res);
            }
          } else {
            setReferralValid({ valid: false, reason: res.reason || 'not_found' });
            lastCodeRef.current = referralCode;
          }
        } catch {
          setReferralValid({ valid: false });
        }
        setCheckingRef(false);
      }, 400);
      return () => clearTimeout(delay);
    }, [referralCode, duration, product?.id]);

    const isTrialDuration = duration === '1_week_trial' || duration === '1_month_trial';
    const basePrice = isTrialDuration
      ? 0
      : duration === '1_week'
      ? Number((product as any)?.price1w || (product as any)?.price_1w) || 0
      : duration === '1_month'
      ? Number(product?.price1m) || 0
      : duration === '3_months'
      ? Number(product?.price3m) || 0
      : Number(product?.price_lifetime) || 0;

    const hasSale = !isTrialDuration && Boolean(settings?.saleActive && settings?.salePercentage && product?.is_on_sale);
    const saleDiscountPercent = hasSale ? (settings?.salePercentage || 0) : 0;
    const saleDiscountAmount = hasSale ? Math.round((basePrice * saleDiscountPercent) / 100) : 0;
    const priceAfterSale = Math.max(0, basePrice - saleDiscountAmount);

    const isAllowedCoupon = !referralValid?.allowedDurations || referralValid.allowedDurations.includes(duration);
    const couponDiscountPercent = (referralValid?.valid && isAllowedCoupon && referralValid?.discount) 
      ? referralValid.discount 
      : (referralValid?.valid && isAllowedCoupon ? 10 : 0);
    const isFreeTrialCoupon = isTrialDuration || (referralValid?.valid && isAllowedCoupon && couponDiscountPercent === 100);

    const couponDiscountAmount = (referralValid?.valid && isAllowedCoupon)
      ? (isFreeTrialCoupon ? priceAfterSale : Math.round((priceAfterSale * couponDiscountPercent) / 100))
      : 0;

    const grandTotal = isFreeTrialCoupon ? 0 : Math.max(0, priceAfterSale - couponDiscountAmount);
    const totalSavings = isTrialDuration ? 0 : (basePrice - grandTotal);
    const currentFinalPrice = grandTotal;
  const [renewalId, setRenewalId] = useState<string|null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('renew')) setRenewalId(params.get('renew'));
    if (params.has('duration')) setDuration(params.get('duration')!);
    if (params.has('coupon')) setReferralCode(params.get('coupon')!.toUpperCase());
  }, []);
  
        if (success) {
      return (
        <div className="container page" style={{textAlign: 'center', maxWidth: 500, margin: '80px auto'}}>
          <div style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'var(--green)', color: 'var(--black)', marginBottom: 24}}>
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style={{fontSize: 32, marginBottom: 16}}>Payment Successful!</h2>
          <p style={{marginBottom: 32}}>Thank you for your purchase. Your unique activation key for <b>{product?.name}</b> has been generated instantly.</p>
          <a className="button primary" href="/account/licenses" style={{display: 'inline-flex', width: '100%', justifyContent: 'center', padding: '16px'}}>View License Key & Download</a>
        </div>
      );
    }
    if(!product)return <NotFound/>;

  if(product.releaseStatus==='prelaunch')return <div className="container page"><PageHeading title={product.name} description={'Preparing for launch. Public access and checkout will be open soon.'}/><a className="button secondary" href={'/agents/'+product.slug}>Back to agent</a></div>;
  if(product.releaseStatus==='development')return <div className="container page"><PageHeading title={product.name} description={'In development. Purchasing is unavailable.'}/><a className="button secondary" href={'/agents/'+product.slug}>Back to agent</a></div>;
  if(product.status==='archived')return <div className="container page"><PageHeading title={product.name} description={'Sales are currently paused for this agent.'}/><a className="button secondary" href={'/agents/'+product.slug}>Back to agent</a></div>;

  async function purchase(){
    setBusy(true);setError('');
    if (!account) {
      const nextUrl = `/checkout/${product!.slug}?duration=${duration}${referralCode ? `&coupon=${encodeURIComponent(referralCode)}` : ''}`;
      window.location.href = `/login?next=${encodeURIComponent(nextUrl)}`;
      return;
    }
    try{
      if(config?.preview){
        const {order}=await api('/preview/purchase',{method:'POST',body:JSON.stringify({productId:product!.id})});
        location.href='/orders?id='+order.id;
      }else{
        const data=await api('/checkout/create',{method:'POST',body:JSON.stringify({
          productId:product!.id, 
            duration,
            renewalLicenseId: renewalId,
            referralCode: referralValid?.valid ? referralCode : null
        })});
        
        if (data.skipped_payment) {
            setSuccess(true);
            setBusy(false);
            return;
          }
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
                const verifyRes = await api('/checkout/verify', { method: 'POST', body: JSON.stringify({ 
                  orderId: data.order_id, 
                  razorpay_payment_id: res.razorpay_payment_id, 
                  razorpay_order_id: res.razorpay_order_id, 
                  razorpay_signature: res.razorpay_signature 
                })});

                // Fire Meta Purchase ONLY if backend confirmed verified capture and complete product metadata
                if (verifyRes && verifyRes.captured) {
                  const verifiedSlug = verifyRes.productSlug || product?.slug;
                  const verifiedName = verifyRes.productName || product?.name;
                  if (verifiedSlug && verifiedName) {
                    trackMetaPurchase({
                      orderId: verifyRes.orderId || data.order_id,
                      amount: typeof verifyRes.amount === 'number' ? verifyRes.amount : data.amount / 100,
                      currency: verifyRes.currency || data.currency || 'INR',
                      productName: verifiedName,
                      productSlug: verifiedSlug,
                      productId: verifyRes.productId || product?.id
                    });
                  } else {
                    console.warn('[NORVI Analytics] Missing verified product metadata on order. Purchase event suppressed.');
                  }
                }

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
        {ownsLifetime && (
          <div className="notice" style={{ marginBottom: 16, borderLeft: '3px solid var(--lime)' }}>
            <strong>You already own an active lifetime license for {product?.name}.</strong>
            <p style={{ margin: '4px 0 10px 0', fontSize: 13, color: 'var(--text-light)' }}>
              Your activation key and downloads are ready in your account. You do not need to purchase it again.
            </p>
            <a className="button primary button-small" href="/account/agents" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Go to my agents <ArrowRight size={14} />
            </a>
          </div>
        )}
        {isPreview?<Notice>Local checkout demonstration. No payment is collected. Switch to live mode for real checkout.</Notice>:<Notice kind="success">Secure checkout via Razorpay. UPI, Cards, and Netbanking supported.</Notice>}
        <div className="payment-options"><span>UPI</span><span>Credit / debit card</span><span>Netbanking</span></div>
        <p className="small-note">Payments processed securely by Razorpay.</p>
          <hr/>
          <h3>Coupon or Referral Code</h3>
            <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px'}}>
              <input type="text" placeholder="Enter code" value={referralCode} onChange={e=>setReferralCode(e.target.value.toUpperCase())} style={{flex:1, textTransform:'uppercase'}} />
              {checkingRef ? (
                <span style={{color:'var(--text-light)'}}>Checking...</span>
              ) : referralValid?.valid === true ? (
                <span style={{color:'var(--green)'}}>
                  &#10004; Applied (-{referralValid.discount || 10}%)
                  {referralValid.allowedDurations && referralValid.allowedDurations.length < 3 && (
                    <small style={{display: 'block', fontSize: '11px', opacity: 0.85}}>
                      Valid for: {referralValid.allowedDurations.map((d: string) => formatDurationLabel(d)).join(', ')}
                    </small>
                  )}
                </span>
              ) : referralValid?.reason === 'duration_mismatch' && referralValid?.allowedDurations ? (
                <span style={{color:'var(--error)', fontSize: '13px'}}>
                  &#10008; Only valid for {referralValid.allowedDurations.map((d: string) => formatDurationLabel(d)).join(', ')}
                </span>
              ) : referralValid?.reason === 'usage_limit_reached' ? (
                <span style={{color:'var(--error)', fontSize: '13px'}}>
                  &#10008; Coupon has reached its maximum redemptions limit
                </span>
              ) : referralValid?.reason === 'self_referral' ? (
                <span style={{color:'var(--error)', fontSize: '13px'}}>
                  &#10008; You cannot use your own referral code
                </span>
              ) : referralValid?.reason === 'inactive' ? (
                <span style={{color:'var(--error)', fontSize: '13px'}}>
                  &#10008; Partner code is inactive
                </span>
              ) : referralValid?.valid === false ? (
                <span style={{color:'var(--error)'}}>&#10008; Invalid code</span>
              ) : null}
            </div>
          {/* Dynamic Order Bill Breakdown */}
          <div className="bill-breakdown-card" style={{
            marginTop: 18,
            marginBottom: 18,
            padding: '16px 18px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lime, #98e038)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Order Bill Breakdown
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-light, #99a890)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>
                {formatDurationLabel(duration) || 'License'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-light, #99a890)' }}>
              <span>Base Catalog Price</span>
              <span style={{ color: '#fff', fontWeight: 500 }}>
                {basePrice === 0 ? 'FREE (₹0)' : `₹${basePrice.toLocaleString()}`}
              </span>
            </div>

            {hasSale && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--lime, #98e038)' }}>
                <span>Storefront Flash Sale (-{saleDiscountPercent}%)</span>
                <span style={{ fontWeight: 600 }}>-₹{saleDiscountAmount.toLocaleString()}</span>
              </div>
            )}

            {referralValid?.valid && isAllowedCoupon && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--lime, #98e038)' }}>
                <span>
                  {isFreeTrialCoupon ? '🎁 Promotional Coupon (-100%)' : `🎟️ Discount Code (${referralCode}) (-${couponDiscountPercent}%)`}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {isFreeTrialCoupon ? `-₹${priceAfterSale.toLocaleString()} (FREE)` : `-₹${couponDiscountAmount.toLocaleString()}`}
                </span>
              </div>
            )}

            <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.12)', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Total Amount Due:</span>
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {totalSavings > 0 && (
                  <span style={{ textDecoration: 'line-through', fontSize: 14, color: 'var(--muted, #667560)' }}>
                    ₹{basePrice.toLocaleString()}
                  </span>
                )}
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--lime, #98e038)' }}>
                  {grandTotal === 0 ? 'FREE (₹0)' : `₹${grandTotal.toLocaleString()}`}
                </span>
              </div>
            </div>

            {totalSavings > 0 && (
              <div style={{
                marginTop: 4,
                padding: '6px 12px',
                background: 'rgba(152, 224, 56, 0.1)',
                borderRadius: 6,
                border: '1px solid rgba(152, 224, 56, 0.25)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--lime, #98e038)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span>🎉</span>
                <span>
                  You save ₹{totalSavings.toLocaleString()} ({Math.round((totalSavings / basePrice) * 100)}% off catalog price)
                </span>
              </div>
            )}
          </div>
          <hr/>
          {!account && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🔐</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>
                    Account required for instant license activation
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Sign in or create an account to link your license and unlock desktop downloads.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={`/login?next=${encodeURIComponent(`/checkout/${product!.slug}?duration=${duration}${referralCode ? `&coupon=${referralCode}` : ''}`)}`}
                  className="button secondary small"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  Sign In
                </a>
                <a
                  href={`/register?next=${encodeURIComponent(`/checkout/${product!.slug}?duration=${duration}${referralCode ? `&coupon=${referralCode}` : ''}`)}`}
                  className="button primary small"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  Register
                </a>
              </div>
            </div>
          )}
          <h3>Terms & Conditions</h3>
        <label className="checkbox-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>I agree to the terms of service and refund policy.</label>
        {error&&<Notice kind="error">{error}</Notice>}
        <button className="button primary full" disabled={busy||!accepted} onClick={purchase}>{busy?'Processing...':(grandTotal === 0 ? 'Claim Free Access (₹0)' : (isPreview?'Simulate purchase — no charge':`Pay Securely (₹${grandTotal.toLocaleString()})`))}<ArrowRight size={17}/></button>
        {ext?.guarantee_badge && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            fontSize: 12,
            color: 'var(--muted, #8e9e87)',
            textAlign: 'center'
          }}>
            <span>{ext.guarantee_badge}</span>
          </div>
        )}
      </div>
      <aside className="panel order-summary">
          <ProductIcon product={product!}/>
          <div>
            <h3>{renewalId ? `Renew ${product!.name}` : product!.name}</h3>
            {ext?.social_proof_text && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(152, 224, 56, 0.08)',
                border: '1px solid rgba(152, 224, 56, 0.25)',
                color: 'var(--lime, #98e038)',
                fontSize: 12,
                fontWeight: 600,
                marginTop: 6,
                marginBottom: 4,
                width: 'fit-content'
              }}>
                {ext.social_proof_text}
              </div>
            )}
            {ext?.checkout_agent_description && ext.checkout_agent_description.trim() ? (
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-light)', marginTop: 8 }}>
                {ext.checkout_agent_description}
              </p>
            ) : null}
          </div>

          <div className="checkout-plan-selector-header" style={{
            marginTop: 22,
            marginBottom: 16,
            padding: '16px 18px',
            background: 'linear-gradient(135deg, rgba(152, 224, 56, 0.08) 0%, rgba(20, 26, 18, 0.6) 100%)',
            borderRadius: 10,
            border: '1px solid rgba(152, 224, 56, 0.25)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--lime, #98e038)', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              <Sparkles size={15} /> SELECT YOUR LICENSE PLAN
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14.5, color: '#f0f3ee', lineHeight: 1.6, fontWeight: 500 }}>
              {ext?.checkout_description || 'Choose your access duration below. All plans include ultra-low latency cloud AI, live screen & audio context perception, multi-device activation, and zero prompt data logging.'}
            </p>
          </div>

          {(() => {
            const plans = [
              {
                key: '1_week',
                title: '1 Week (7 Days)',
                basePrice: Number((product as any)?.price1w || (product as any)?.price_1w) || 0,
                days: 7,
                defaultSubtitle: 'Fast-track pass — full desktop power for 7 days',
                defaultBadge: hasSale ? `${settings?.salePercentage}% OFF` : undefined,
              },
              {
                key: '1_month',
                title: '1 Month',
                basePrice: Number(product?.price1m) || 0,
                days: 30,
                defaultSubtitle: 'Full month of high-speed cloud AI interfaces',
                defaultBadge: hasSale ? `${settings?.salePercentage}% OFF` : undefined,
              },
              {
                key: '3_months',
                title: '3 Months',
                basePrice: Number(product?.price3m) || 0,
                days: 90,
                defaultSubtitle: 'Quarterly powerhouse — peak speed & extended quota',
                defaultBadge: '🔥 Best Value',
              },
              {
                key: 'lifetime',
                title: 'Lifetime Access',
                basePrice: Number(product?.price_lifetime) || 0,
                days: null,
                defaultSubtitle: 'One-time purchase — own your agent forever with all updates',
                defaultBadge: '👑 Pay Once',
              },
            ].filter(p => p.basePrice > 0);

            const trialPlans: any[] = [];
            if (duration === '1_week_trial' || referralValid?.allowedDurations?.includes('1_week_trial')) {
              trialPlans.push({
                key: '1_week_trial',
                title: '1 Week Free Trial',
                basePrice: 0,
                days: 7,
                defaultSubtitle: '100% free promotional access — full desktop trial',
                defaultBadge: '🎁 100% FREE',
                isTrial: true,
              });
            }
            if (duration === '1_month_trial' || referralValid?.allowedDurations?.includes('1_month_trial')) {
              trialPlans.push({
                key: '1_month_trial',
                title: '1 Month Free Trial',
                basePrice: 0,
                days: 30,
                defaultSubtitle: 'VIP partner pass — complimentary full month',
                defaultBadge: '🎁 VIP PASS',
                isTrial: true,
              });
            }
            const allPlans = [...plans, ...trialPlans];

            return (
              <div className="pricing-toggles" style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '14px 0 24px 0' }}>
                {allPlans.map(p => {
                  const isSelected = duration === p.key;
                  const isFeatured = (ext?.featured_plan || '1_month') === p.key;
                  const ribbonText = ext?.featured_ribbon_text || '⭐ MOST POPULAR';
                  const customSub = ext?.plan_configs?.[p.key]?.subtitle;
                  const displaySubtitle = customSub && customSub.trim() ? customSub : p.defaultSubtitle;
                  const customBadge = ext?.plan_configs?.[p.key]?.badge;
                  const displayBadge = customBadge && customBadge.trim() ? customBadge : p.defaultBadge;

                  const pBase = p.basePrice;
                  const pHasSale = !p.isTrial && Boolean(settings?.saleActive && settings?.salePercentage && product?.is_on_sale);
                  const pSaleMultiplier = pHasSale ? (1 - (settings?.salePercentage || 0) / 100) : 1;
                  const pIsAllowed = !referralValid?.allowedDurations || referralValid.allowedDurations.includes(p.key);
                  const pCouponMultiplier = (referralValid?.valid && pIsAllowed && referralValid?.discount)
                    ? (1 - referralValid.discount / 100)
                    : (referralValid?.valid && pIsAllowed ? 0.9 : 1);
                  const pFinalPrice = p.isTrial ? 0 : Math.round(pBase * pSaleMultiplier * pCouponMultiplier);
                  const pHasDiscount = pFinalPrice < pBase;

                  const pPerDayText = p.isTrial
                    ? 'Complimentary'
                    : p.days
                    ? `₹${Math.round(pFinalPrice / p.days)} / day`
                    : 'Never renews';

                  return (
                    <label
                      key={p.key}
                      onClick={() => setDuration(p.key)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '18px 16px',
                        border: isSelected ? '2px solid var(--accent, #98e038)' : '1px solid var(--border)',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(152, 224, 56, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        boxShadow: isSelected ? '0 0 16px rgba(152, 224, 56, 0.12)' : 'none',
                        transition: 'all 0.15s ease',
                        marginTop: isFeatured ? 8 : 0,
                      }}
                    >
                      {isFeatured && (
                        <div style={{
                          position: 'absolute',
                          top: -10,
                          right: 14,
                          background: 'var(--lime, #98e038)',
                          color: '#0c100a',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2.5px 9px',
                          borderRadius: 10,
                          letterSpacing: '0.6px',
                          textTransform: 'uppercase',
                          boxShadow: '0 2px 8px rgba(152, 224, 56, 0.35)',
                          zIndex: 2,
                        }}>
                          {ribbonText}
                        </div>
                      )}

                      <input
                        type="radio"
                        checked={isSelected}
                        readOnly
                        style={{
                          width: 18,
                          height: 18,
                          flexShrink: 0,
                          margin: 0,
                          accentColor: 'var(--accent, #98e038)',
                          cursor: 'pointer',
                        }}
                      />

                      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <b style={{ fontSize: 15, color: '#f0f3ee' }}>{p.title}</b>
                          {displayBadge && (
                            <span style={{
                              background: 'rgba(152, 224, 56, 0.14)',
                              color: 'var(--lime, #98e038)',
                              border: '1px solid rgba(152, 224, 56, 0.3)',
                              padding: '1px 7px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.3px',
                            }}>
                              {displayBadge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-light, #99a890)', lineHeight: 1.4 }}>
                          {displaySubtitle}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        flexShrink: 0,
                        marginLeft: 10,
                      }}>
                        {p.isTrial ? (
                          <>
                            <span style={{ color: 'var(--lime, #98e038)', fontSize: 16, fontWeight: 800 }}>
                              FREE (₹0)
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--muted, #667560)', marginTop: 2, fontWeight: 600 }}>
                              Complimentary
                            </span>
                          </>
                        ) : pHasDiscount ? (
                          <>
                            <span style={{ textDecoration: 'line-through', fontSize: 12, opacity: 0.65, color: 'var(--text-light)' }}>
                              ₹{pBase}
                            </span>
                            <span style={{ color: 'var(--lime, #98e038)', fontSize: 18, fontWeight: 800 }}>
                              ₹{pFinalPrice}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--muted, #667560)', marginTop: 2, fontWeight: 600 }}>
                              {pPerDayText}
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#f0f3ee' }}>
                              ₹{pBase}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--muted, #667560)', marginTop: 2, fontWeight: 600 }}>
                              {pPerDayText}
                            </span>
                          </>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            );
          })()}

          {(() => {
            const isTrialSelected = duration === '1_week_trial' || duration === '1_month_trial';
            const highlights = isTrialSelected
              ? ((ext?.trial_highlights && ext.trial_highlights.length > 0)
                  ? ext.trial_highlights
                  : getDefaultAgentTrialHighlights(product.slug))
              : ((ext?.paid_highlights && ext.paid_highlights.length > 0)
                  ? ext.paid_highlights
                  : getDefaultAgentPaidHighlights(product.slug));
            const headerText = isTrialSelected ? '🎁 What\'s Included in Free Trial Tier:' : '👑 What\'s Included in Paid Licenses:';
            return (
              <div className="checkout-highlights-box" style={{ display: 'flex', flexDirection: 'column', width: '100%', margin: '20px 0 16px 0', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, color: 'var(--lime, #98e038)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {headerText}
                </h4>
                <div className="highlights-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                  {highlights.map((hl: string, idx: number) => (
                    <div key={idx} className="highlight-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, color: 'var(--text, #f0f3ee)' }}>
                      <Check size={16} style={{ color: 'var(--lime, #98e038)', flexShrink: 0, marginTop: 2.5 }} />
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>
                {isTrialSelected && (
                  <div style={{ fontSize: 13, color: 'var(--text-light, #99a890)', marginTop: 12, lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                    💡 {ext?.trial_notice || getDefaultAgentTrialNotice(product.slug)}
                  </div>
                )}
              </div>
            );
          })()}
          <p className="small-note">Includes a product-specific activation key to unlock the agent on your desktop.</p>
        </aside>
    </div>
  </div>;
}
export function NotFound(){return <div className="container page"><Empty title="This page took a different path." description="The page or agent could not be found." href="/agents" label="Back to the collection"/></div>;}
