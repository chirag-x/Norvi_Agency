import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('apps/web/src/ui/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the state and useEffect
old_hooks = """  const [path,setPath] = useState(initialPath); const [products,setProducts] = useState<Product[]>(initialProducts); const [settings,setSettings] = useState<Settings>(initialSettings); const [menu,setMenu]=useState(false); const [user,setUser]=useState<User|null>(null);
    const [verified, setVerified] = useState(false);
  useEffect(()=>{ 
      setPath(location.pathname.replace(/\/$/,'') || '/'); 
      if ((location.hash.includes('type=signup') && location.hash.includes('access_token=')) || location.search.includes('code=')) {
          setVerified(true);
          history.replaceState(null, '', location.pathname);
      }
 fetch('/api/catalog').then(r=>r.ok?r.json():null).then(data=>{if(data){setProducts(data.products);setSettings(data.settings);}}).catch(()=>{}); fetch('/api/me').then(r=>r.ok?r.json():null).then(data=>{if(data&&data.user)setUser(data.user);}).catch(()=>{}); },[]);"""

new_hooks = """  const [path,setPath] = useState(initialPath); const [products,setProducts] = useState<Product[]>(initialProducts); const [settings,setSettings] = useState<Settings>(initialSettings); const [menu,setMenu]=useState(false); const [user,setUser]=useState<User|null>(null);
    const [verified, setVerified] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
  useEffect(()=>{ 
      setPath(location.pathname.replace(/\/$/,'') || '/'); 
      if ((location.hash.includes('type=signup') && location.hash.includes('access_token=')) || location.search.includes('code=')) {
          setVerified(true);
          history.replaceState(null, '', location.pathname);
      }
      Promise.all([
        fetch('/api/catalog').then(r=>r.ok?r.json():null),
        fetch('/api/me').then(r=>r.ok?r.json():null)
      ]).then(([catalogData, meData]) => {
        if(catalogData){setProducts(catalogData.products);setSettings(catalogData.settings);}
        if(meData&&meData.user)setUser(meData.user);
        setIsDataLoaded(true);
      }).catch(()=>{setIsDataLoaded(true);});
  },[]);"""

if old_hooks in content:
    content = content.replace(old_hooks, new_hooks)
else:
    print("old_hooks not found!")
    sys.exit(1)

# 2. Update the return statement for App
old_return = "return <><a className=\"skip-link\""
new_return = """  const isCustomerPage = !path.startsWith('/admin');
  if (isCustomerPage && !isDataLoaded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg)', color: 'var(--fg)' }}>
        <img src="/logo.jpg?v=2" alt="NORVI" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "contain", marginBottom: '1.5rem', animation: 'pulse 2s infinite' }} />
        <style>{`@keyframes pulse { 0% { opacity: 0.6; transform: scale(0.98); } 50% { opacity: 1; transform: scale(1.02); } 100% { opacity: 0.6; transform: scale(0.98); } }`}</style>
      </div>
    );
  }

  return <><a className="skip-link\""""

if old_return in content:
    content = content.replace(old_return, new_return)
else:
    print("old_return not found!")
    sys.exit(1)

# 3. Update the social icons
old_social = """<div className="hero-social-links" style={{display:'flex',gap:'1rem',marginTop:'1.5rem'}}>{settings.socialInstagram && <a href={settings.socialInstagram} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Instagram size={20}/></a>}{settings.socialYoutube && <a href={settings.socialYoutube} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Youtube size={20}/></a>}{settings.socialFacebook && <a href={settings.socialFacebook} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Facebook size={20}/></a>}{settings.socialTwitter && <a href={settings.socialTwitter} target="_blank" rel="noreferrer" style={{color:'var(--fg)'}}><Twitter size={20}/></a>}</div>"""

new_social = """<div className="hero-social-links" style={{display:'flex',gap:'1.5rem',marginTop:'1.5rem'}}>{settings.socialInstagram && <a href={settings.socialInstagram} target="_blank" rel="noreferrer" style={{color:'#E1306C'}}><Instagram size={22}/></a>}{settings.socialYoutube && <a href={settings.socialYoutube} target="_blank" rel="noreferrer" style={{color:'#FF0000'}}><Youtube size={22}/></a>}{settings.socialFacebook && <a href={settings.socialFacebook} target="_blank" rel="noreferrer" style={{color:'#1877F2'}}><Facebook size={22}/></a>}{settings.socialTwitter && <a href={settings.socialTwitter} target="_blank" rel="noreferrer" style={{color:'#1DA1F2'}}><Twitter size={22}/></a>}</div>"""

if old_social in content:
    content = content.replace(old_social, new_social)
else:
    print("old_social not found!")
    sys.exit(1)

with open('apps/web/src/ui/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated App.tsx successfully.")
