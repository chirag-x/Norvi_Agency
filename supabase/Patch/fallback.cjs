const fs = require('fs');
let c = fs.readFileSync('e:/Agency/apps/web/src/ui/Accounts.tsx', 'utf-8');
c = c.replace(
  "{section === '/categories' && data?.categories && <CategoriesAdmin categories={data.categories} onSave={reload} />}",
  "{section === '/categories' && (data?.categories ? <CategoriesAdmin categories={data.categories} onSave={reload} /> : <Notice kind=\"error\">Categories data is missing. Please ensure you have run the latest database migration.</Notice>)}"
);
fs.writeFileSync('e:/Agency/apps/web/src/ui/Accounts.tsx', c);
