import { useEffect,useState,type ReactNode } from 'react';
import { AlertCircle,ArrowUpRight,CheckCircle2,LoaderCircle } from 'lucide-react';
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
