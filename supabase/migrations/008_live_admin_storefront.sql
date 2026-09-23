begin;

-- 1. Upgrade the Products table to hold all catalog attributes
alter table public.products
  add column if not exists tagline text not null default '',
  add column if not exists price_label text not null default 'Pricing to be confirmed',
  add column if not exists icon text not null default 'workflow' check(icon in ('workflow','message','sparkles')),
  add column if not exists color text not null default 'lime' check(color in ('lime','blue','purple')),
  add column if not exists features text[] not null default '{}',
  add column if not exists version text not null default 'In development',
  add column if not exists requirements text not null default '';

-- 2. Create the Site Settings table
create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1), -- Ensure only one row exists
  name text not null default 'NORVI',
  headline text not null default 'Less busywork.\nMore possibility.',
  description text not null default 'Make room for the work that matters. Discover AI agents built to take everyday tasks off your hands.',
  email text not null default 'email_Support',
  company text not null default 'name_Company',
  domain text not null default 'domain_Website',
  updated_at timestamptz not null default now()
);

-- Insert the default single row
insert into public.site_settings (id) values (1) on conflict do nothing;

alter table public.site_settings enable row level security;
-- Only anyone can read settings, but only owners/admins can update
drop policy if exists read_settings on public.site_settings;
create policy read_settings on public.site_settings for select to public, anon, authenticated using (true);

-- 3. RPC to List Products for Admin
create or replace function public.admin_list_products()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_products json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied: Product manager access required.';
  end if;

  select coalesce(json_agg(json_build_object(
    'id', id, 'slug', slug, 'name', name, 'category', category,
    'tagline', tagline, 'description', description, 'price', price_label,
    'status', status, 'icon', icon, 'color', color, 'features', features,
    'version', version, 'requirements', requirements,
    'releaseStatus', release_status
  ) order by created_at asc), '[]'::json) into v_products
  from public.products;

  return json_build_object('items', v_products);
end;
$$;

-- 4. RPC to Upsert a Product
create or replace function public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category text, p_tagline text,
  p_description text, p_price_label text, p_status text, p_icon text,
  p_color text, p_features text[], p_version text, p_requirements text,
  p_release_status text
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
      slug, name, category, tagline, description, price_label, status, icon, color, features, version, requirements, release_status
    ) values (
      p_slug, p_name, p_category, p_tagline, p_description, p_price_label, p_status, p_icon, p_color, p_features, p_version, p_requirements, p_release_status
    );
  else
    update public.products set
      slug = p_slug, name = p_name, category = p_category, tagline = p_tagline,
      description = p_description, price_label = p_price_label, status = p_status,
      icon = p_icon, color = p_color, features = p_features, version = p_version,
      requirements = p_requirements, release_status = p_release_status,
      revision = revision + 1
    where id = p_id;
  end if;
  
  insert into private.audit_log (actor_id, action, target_id)
  values (auth.uid(), 'Updated product catalog', p_slug);
end;
$$;

-- 5. RPC to Get Settings (Public)
create or replace function public.get_site_settings()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_settings json;
begin
  select row_to_json(s) into v_settings from public.site_settings s where id = 1;
  return v_settings;
end;
$$;
grant execute on function public.get_site_settings() to anon, authenticated;

-- 6. RPC to Update Settings
create or replace function public.admin_update_settings(
  p_name text, p_headline text, p_description text,
  p_email text, p_company text, p_domain text
)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator') then
    raise exception 'Permission denied: Administrator access required.';
  end if;

  update public.site_settings set
    name = coalesce(p_name, name),
    headline = coalesce(p_headline, headline),
    description = coalesce(p_description, description),
    email = coalesce(p_email, email),
    company = coalesce(p_company, company),
    domain = coalesce(p_domain, domain),
    updated_at = now()
  where id = 1;
  
  insert into private.audit_log (actor_id, action, target_id)
  values (auth.uid(), 'Updated site settings', 'global');
end;
$$;

commit;
