import { useEffect,useState,type ReactNode,type CSSProperties } from 'react';
import { AlertCircle,ArrowUpRight,CheckCircle2,LoaderCircle,ExternalLink } from 'lucide-react';
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{const response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options.headers}});let data;try{data=await response.json();}catch{throw Error('The website service is unavailable. Start the local preview server and try again.');}if(!response.ok)throw Error(data.error||'Please try again.');return data;}
export async function uploadFile(file: File, bucket = 'product-assets'): Promise<string> {
  const ticketRes = await fetch('/api/admin/upload-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileType: file.type, fileName: file.name, bucket })
  });

  if (!ticketRes.ok) {
    const err = await ticketRes.json().catch(() => ({ error: 'Could not obtain upload ticket.' }));
    throw Error(err.error || 'Failed to initialize upload ticket.');
  }

  const { signedUrl, publicUrl } = await ticketRes.json();

  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => '');
    throw Error('Direct upload to storage failed: ' + (errorText || uploadRes.statusText));
  }

  return publicUrl;
}
export function useData(path:string){const [data,setData]=useState<any>(null),[error,setError]=useState(''),[tick,setTick]=useState(0);useEffect(()=>{let active=true;setError('');api(path).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[path,tick]);return{data,error,reload:()=>setTick(v=>v+1)};}
export function Notice({children,kind='info'}:{children:ReactNode;kind?:'info'|'error'|'success'}){return <div className={'notice '+kind} role={kind==='error'?'alert':'status'}>{kind==='success'?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}<div>{children}</div></div>;}
export function PageHeading({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:ReactNode}){return <div className="page-heading"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>;}
export function Empty({title,description,href,label='Explore agents'}:{title:string;description:string;href?:string;label?:string}){return <div className="empty"><span className="empty-mark">✳</span><h3>{title}</h3><p>{description}</p>{href&&<a className="button primary" href={href}>{label}<ArrowUpRight size={16}/></a>}</div>;}
export function Loading(){return <div className="empty"><LoaderCircle className="spin"/><p>Loading your workspace…</p></div>;}
export function Badge({children, kind}:{children:ReactNode; kind?:string}){return <span className={'badge ' + (kind || (children==='active'||children==='published'||children==='Connected'?'good':''))}>{children}</span>;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function date(value:string|null|undefined){return value?new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Not yet';}

export function parseYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const shortMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (shortMatch && shortMatch[1]) return shortMatch[1];

    const embedMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
    if (embedMatch && embedMatch[1]) return embedMatch[1];

    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
    if (watchMatch && watchMatch[1]) return watchMatch[1];

    const pathMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:v|shorts|live)\/([a-zA-Z0-9_-]{11})/i);
    if (pathMatch && pathMatch[1]) return pathMatch[1];
  } catch {
    return null;
  }

  return null;
}

export function SmartVideoPlayer({
  url,
  title = 'Video Player',
  autoPlay = false,
  loop = false,
  muted = false,
  controls = true,
  showExternalLink = true,
  className = '',
  style
}: {
  url?: string | null;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  showExternalLink?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  if (!url) return null;
  const youtubeId = parseYouTubeVideoId(url);

  if (youtubeId) {
    const embedParams = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1'
    });
    if (autoPlay) embedParams.set('autoplay', '1');
    if (muted) embedParams.set('mute', '1');
    if (loop) {
      embedParams.set('loop', '1');
      embedParams.set('playlist', youtubeId);
    }
    if (!controls) embedParams.set('controls', '0');

    return (
      <div className={`smart-video-wrap ${className}`} style={{ width: '100%', position: 'relative', ...style }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: '8px', background: '#000' }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?${embedParams.toString()}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
        {showExternalLink && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-button"
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-light)', padding: 0 }}
            >
              Watch on YouTube <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`smart-video-wrap ${className}`} style={{ width: '100%', ...style }}>
      <video
        src={url}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        preload="metadata"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }}
      />
    </div>
  );
}
