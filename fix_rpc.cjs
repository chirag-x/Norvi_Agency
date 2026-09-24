const fs = require('fs');
let content = fs.readFileSync('e:/Agency/supabase/migrations/009_admin_features.sql', 'utf-8');

const rpc = `
create or replace function public.admin_list_products()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_products json;
  v_categories json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied: Product manager access required.';
  end if;

  select coalesce(json_agg(json_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'categoryId', p.category_id,
    'category', json_build_object('id', c.id, 'slug', c.slug, 'name', c.name),
    'tagline', p.tagline, 'description', p.description, 'price', p.price_label,
    'status', p.status, 'logoUrl', p.logo_url, 'features', p.features,
    'version', p.version, 'requirements', p.requirements,
    'releaseStatus', p.release_status, 'workflowHeading', p.workflow_heading,
    'workflowDescription', p.workflow_description, 'workflowMediaUrl', p.workflow_media_url,
    'workflowNote', p.workflow_note, 'updatedAt', p.updated_at
  ) order by p.created_at asc), '[]'::json) into v_products
  from public.products p
  left join public.categories c on p.category_id = c.id;

  select coalesce(json_agg(json_build_object(
    'id', id, 'slug', slug, 'name', name, 'createdAt', created_at
  ) order by created_at asc), '[]'::json) into v_categories
  from public.categories;

  return json_build_object('items', v_products, 'categories', v_categories);
end;
$$;
`;

// Remove the one I appended earlier
const cut = content.indexOf('create or replace function public.admin_list_products()');
if (cut !== -1) {
  content = content.substring(0, cut);
}

content += rpc;
fs.writeFileSync('e:/Agency/supabase/migrations/009_admin_features.sql', content);
