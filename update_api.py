import sys

with open('apps/api/live.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Catalog Select
old_select = "'id, slug, name, categoryId:category_id, tagline, description, price:price_label, price1m:price_1m, price3m:price_3m, price_lifetime:price_lifetime, status, logoUrl:logo_url, features, version, requirements, releaseStatus:release_status, workflowHeading:workflow_heading, workflowDescription:workflow_description, workflowMediaUrl:workflow_media_url, workflowNote:workflow_note, aiUsage:ai_usage, deviceAllowance:device_allowance, is_on_sale'"
new_select = "'id, slug, name, categoryId:category_id, tagline, description, price:price_label, price1m:price_1m, price3m:price_3m, price_lifetime:price_lifetime, status, logoUrl:logo_url, features, version, requirements, releaseStatus:release_status, workflowHeading:workflow_heading, workflowDescription:workflow_description, workflowMediaUrl:workflow_media_url, workflowNote:workflow_note, aiUsage:ai_usage, deviceAllowance:device_allowance, is_on_sale, trialActive:trial_active'"
content = content.replace(old_select, new_select)

# 2. Update trial/create endpoint
old_trial = """  app.post('/api/store/trial/create', async c => {
    const db = c.get('db');
    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
    const input = z.object({ productSlug: z.string() }).parse(await c.req.json());
    const { data: licenseId, error } = await db.rpc('claim_free_trial', { p_product_slug: input.productSlug, p_encryption_secret: secret });"""

new_trial = """  app.post('/api/store/trial/create', async c => {
    const db = c.get('db');
    const secret = licenseSecret(c.env);
    if (!secret) return c.json({ error: 'License encryption is not configured.' }, 503);
    
    const { data: settings } = await db.rpc('get_site_settings');
    if (settings?.maintenance_mode) return c.json({ error: 'Store is temporarily closed for maintenance.' }, 503);

    const input = z.object({ productSlug: z.string() }).parse(await c.req.json());
    
    const { data: product } = await db.from('products').select('trial_active').eq('slug', input.productSlug).single();
    if (!product || product.trial_active === false) return c.json({ error: 'Free trials are not available for this agent.' }, 403);

    const { data: licenseId, error } = await db.rpc('claim_free_trial', { p_product_slug: input.productSlug, p_encryption_secret: secret });"""

if old_trial in content:
    content = content.replace(old_trial, new_trial)
else:
    print("old_trial not found!")
    sys.exit(1)

# 3. Add admin route
admin_products_block = """  app.post('/api/admin/products', async c => {"""
new_admin_route = """  app.post('/api/admin/products/:id/trial', async c => {
    if (!['owner', 'administrator', 'product_manager'].includes(c.get('user').role)) return c.json({ error: 'Permission denied.' }, 403);
    const input = await c.req.json();
    const { error } = await c.get('db').rpc('admin_toggle_trial', { p_product_id: c.req.param('id'), p_trial_active: input.trialActive });
    return error ? c.json({ error: error.message }, 400) : c.json({ ok: true });
  });

  app.post('/api/admin/products', async c => {"""
content = content.replace(admin_products_block, new_admin_route)

with open('apps/api/live.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated live.ts")
