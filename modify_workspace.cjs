const fs = require('fs');
let c = fs.readFileSync('e:/Agency/apps/web/src/ui/Workspace.tsx', 'utf-8');
c = c.replace(
  "const staffNav = [['', 'Overview', LayoutDashboard], ['/products', 'Products & releases', Box],",
  "const staffNav = [['', 'Overview', LayoutDashboard], ['/products', 'Products & releases', Box], ['/categories', 'Categories', Box],"
);
c = c.replace(
  "administrator: ['', '/products', '/customers',",
  "administrator: ['', '/products', '/categories', '/customers',"
);
c = c.replace(
  "product_manager: ['', '/products', '/content']",
  "product_manager: ['', '/products', '/categories', '/content']"
);
fs.writeFileSync('e:/Agency/apps/web/src/ui/Workspace.tsx', c);
