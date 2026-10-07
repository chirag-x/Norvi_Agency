import sys

with open('apps/web/src/ui/Workspace.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the section rendering
old_section = "{section === '/promotions' && <><PromotionsManager /><CouponsManager /></>}"
new_section = "{section === '/promotions' && <><PromotionsManager /><TrialManager /><CouponsManager /></>}"

if old_section in content:
    content = content.replace(old_section, new_section)
else:
    print("old_section not found!")
    sys.exit(1)

# 2. Inject TrialManager component
trial_manager_code = """
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

function PromotionsManager() {"""

content = content.replace("function PromotionsManager() {", trial_manager_code)

with open('apps/web/src/ui/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Workspace.tsx")
