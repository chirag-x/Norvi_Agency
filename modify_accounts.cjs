const fs = require('fs');
let c = fs.readFileSync('e:/Agency/apps/web/src/ui/Accounts.tsx', 'utf-8');

c = c.replace(
  "import { ProductForm, SettingsForm } from './Workspace';",
  "import { ProductForm, SettingsForm, CategoriesAdmin } from './Workspace';"
);

c = c.replace(
  "const endpoint = section === '/products' ? '/admin/products' :",
  "const endpoint = section === '/categories' ? '/admin/products' : section === '/products' ? '/admin/products' :"
);

c = c.replace(
  "{section === '/products' && data?.items && <><div className=\"admin-products\">",
  "{section === '/categories' && data?.categories && <CategoriesAdmin categories={data.categories} onSave={reload} />}\n    {section === '/products' && data?.items && <><div className=\"admin-products\">"
);

c = c.replace(
  "{editing !== undefined && <Modal title={editing ? 'Edit agent' : 'Add an agent'} onClose={() => setEditing(undefined)} wide><ProductForm product={editing} onSave={() => { setEditing(undefined); reload(); }} /></Modal>}",
  "{editing !== undefined && <Modal title={editing ? 'Edit agent' : 'Add an agent'} onClose={() => setEditing(undefined)} wide><ProductForm product={editing} categories={data?.categories || []} onSave={() => { setEditing(undefined); reload(); }} /></Modal>}"
);

c = c.replace(
  "'/products': 'Your agent collection.', '/customers':",
  "'/products': 'Your agent collection.', '/categories': 'Agent categories.', '/customers':"
);

fs.writeFileSync('e:/Agency/apps/web/src/ui/Accounts.tsx', c);
