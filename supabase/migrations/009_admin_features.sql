-- Create categories table
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  created_at timestamptz not null default now()
);

-- Seed initial categories from existing products (if any)
insert into public.categories (name, slug)
select distinct category, lower(regexp_replace(category, '[^a-zA-Z0-9]+', '-', 'g'))
from public.products
on conflict (slug) do nothing;

-- Add category_id and new fields to products
alter table public.products
  add column category_id uuid references public.categories(id),
  add column logo_url text,
  add column workflow_heading text not null default 'Built for your workflow.',
  add column workflow_description text not null default '',
  add column workflow_media_url text,
  add column workflow_note text not null default '';

-- Backfill category_id for existing products
update public.products p
set category_id = c.id
from public.categories c
where c.name = p.category;

-- Make category_id not null and drop old text category
alter table public.products
  alter column category_id set not null,
  drop column category,
  drop column icon,
  drop column color;

-- RLS for categories
alter table public.categories enable row level security;
create policy published_categories on public.categories for select to anon, authenticated using (true);
revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;

-- Storage Bucket for product assets (Supabase Storage)
insert into storage.buckets (id, name, public) 
values ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

-- Allow public read access to product-assets
create policy "Public Access" on storage.objects for select to public using (bucket_id = 'product-assets');

-- Allow staff to upload to product-assets
create policy "Staff Upload Access" on storage.objects for insert to authenticated 
with check (bucket_id = 'product-assets' and (select role from public.staff_memberships where user_id = auth.uid() and active = true) in ('owner', 'administrator', 'product_manager'));

create policy "Staff Update Access" on storage.objects for update to authenticated 
using (bucket_id = 'product-assets' and (select role from public.staff_memberships where user_id = auth.uid() and active = true) in ('owner', 'administrator', 'product_manager'));

create policy "Staff Delete Access" on storage.objects for delete to authenticated 
using (bucket_id = 'product-assets' and (select role from public.staff_memberships where user_id = auth.uid() and active = true) in ('owner', 'administrator', 'product_manager'));

-- Update RPC to match new schema
create or replace function public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category_id uuid, p_tagline text,
  p_description text, p_price_label text, p_status text, p_logo_url text,
  p_features text[], p_version text, p_requirements text,
  p_release_status text, p_workflow_heading text, p_workflow_description text,
  p_workflow_media_url text, p_workflow_note text
)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied: Product manager access required.';
  end if;

  if p_id is null then
    insert into public.products (
      slug, name, category_id, tagline, description, price_label, status, logo_url, features, version, requirements, release_status, workflow_heading, workflow_description, workflow_media_url, workflow_note
    ) values (
      p_slug, p_name, p_category_id, p_tagline, p_description, p_price_label, p_status, p_logo_url, p_features, p_version, p_requirements, p_release_status, p_workflow_heading, p_workflow_description, p_workflow_media_url, p_workflow_note
    );
  else
    update public.products set
      slug = p_slug, name = p_name, category_id = p_category_id, tagline = p_tagline, description = p_description,
      price_label = p_price_label, status = p_status, logo_url = p_logo_url, features = p_features,
      version = p_version, requirements = p_requirements, release_status = p_release_status,
      workflow_heading = p_workflow_heading, workflow_description = p_workflow_description,
      workflow_media_url = p_workflow_media_url, workflow_note = p_workflow_note,
      revision = revision + 1
    where id = p_id;
  end if;
end;
$$;

-- RPC for managing categories
create or replace function public.admin_upsert_category(
  p_id uuid, p_slug text, p_name text
)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied: Product manager access required.';
  end if;

  if p_id is null then
    insert into public.categories (slug, name) values (p_slug, p_name);
  else
    update public.categories set slug = p_slug, name = p_name where id = p_id;
  end if;
end;
$$;

create or replace function public.admin_delete_category(p_id uuid)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied: Product manager access required.';
  end if;

  if exists(select 1 from public.products where category_id = p_id) then
    raise exception 'Cannot delete category: it is being used by products.';
  end if;

  delete from public.categories where id = p_id;
end;
$$;


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
    'workflowNote', p.workflow_note, 
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
