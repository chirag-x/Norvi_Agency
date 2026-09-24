const fs = require('fs');

let content = fs.readFileSync('e:/Agency/apps/web/src/ui/Workspace.tsx', 'utf-8');

const newProductForm = `export function ProductForm({ product, onSave, categories }: { product: Product | null; onSave: () => void; categories: Category[] }) { 
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
          features: String(d.features).split('\\n').filter(Boolean),
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
    <Field label="Features" hint="One feature per line, up to eight."><textarea name="features" rows={3} defaultValue={product?.features?.join('\\n')} placeholder="feature_Agent_4_1" /></Field>
    
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
}`;

const categoryAdmin = `
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
`;

content = content.replace(/export function ProductForm\([\s\S]*?<\/form>; }/, newProductForm + categoryAdmin);

content = content.replace(
  `import { ArrowRight, ArrowUpRight, Activity, Copy, Download, KeyRound, Mail, Plus, Search, ShieldCheck, X, Check } from 'lucide-react';`,
  `import { ArrowRight, ArrowUpRight, Activity, Copy, Download, KeyRound, Mail, Plus, Search, ShieldCheck, X, Check } from 'lucide-react';\nimport { uploadFile } from './common';\nimport type { Category } from '../../../../packages/shared/model';`
);

content = content.replace(
  `{['/products', '/customers', '/licenses'].includes(section)`,
  `{['/products', '/categories', '/customers', '/licenses'].includes(section)`
);

content = content.replace(
  `{section === '/products' && <><div className="admin-products">`,
  `{section === '/categories' && <CategoriesAdmin categories={data.categories} onSave={() => { reload(); onCatalogChange(); }} />}\n        {section === '/products' && <><div className="admin-products">`
);

content = content.replace(
  `{editing !== undefined && <Modal title={editing ? 'Edit agent' : 'Add an agent'} onClose={() => setEditing(undefined)} wide><ProductForm product={editing} onSave={() => { setEditing(undefined); reload(); onCatalogChange(); }} /></Modal>}`,
  `{editing !== undefined && <Modal title={editing ? 'Edit agent' : 'Add an agent'} onClose={() => setEditing(undefined)} wide><ProductForm categories={data.categories} product={editing} onSave={() => { setEditing(undefined); reload(); onCatalogChange(); }} /></Modal>}`
);

fs.writeFileSync('e:/Agency/apps/web/src/ui/Workspace.tsx', content);
