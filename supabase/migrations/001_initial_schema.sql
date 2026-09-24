-- Foundation only: review and apply to an isolated Supabase project before live integration.
-- This migration is not applied automatically by the website or local preview.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', company text, country text,
  suspended boolean not null default false,
  created_at timestamptz not null default now(), last_sign_in_at timestamptz
);
create table public.staff_memberships (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('owner','administrator','product_manager','support')),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, category text not null, description text not null,
  status text not null default 'draft' check(status in ('draft','published','archived')),
  revision integer not null default 1, created_at timestamptz not null default now()
);
create table public.prices (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  amount_minor bigint not null check(amount_minor>0), currency text not null check(currency ~ '^[A-Z]{3}$'),
  billing_type text not null check(billing_type in ('one_time','subscription','fixed_term')),
  provider_plan_id text, active boolean not null default false
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  product_id uuid not null references public.products(id), price_id uuid not null references public.prices(id),
  amount_minor bigint not null check(amount_minor>0), currency text not null,
  status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
  provider_order_id text unique, provider_payment_id text unique,
  idempotency_key text not null, created_at timestamptz not null default now(),
  unique(user_id,idempotency_key), unique(id,user_id,product_id)
);
create table public.licenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  product_id uuid not null references public.products(id), order_id uuid not null unique,
  status text not null default 'active' check(status in ('active','revoked')),
  key_suffix text not null, key_version integer not null default 1,
  max_devices integer not null default 3 check(max_devices between 1 and 100), expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(order_id,user_id,product_id) references public.orders(id,user_id,product_id)
);
create table private.license_secrets (
  license_id uuid primary key references public.licenses(id), key_hash text not null unique,
  encrypted_key text not null, encryption_key_version integer not null
);
create table public.devices (
  id uuid primary key default gen_random_uuid(), license_id uuid not null references public.licenses(id),
  installation_id text not null, active boolean not null default true,
  last_seen_at timestamptz not null default now(), unique(license_id,installation_id)
);
create table private.webhook_events (
  provider_event_id text primary key, payload jsonb not null, received_at timestamptz not null default now(),
  processed_at timestamptz, error text
);
create table private.outbox (
  id uuid primary key default gen_random_uuid(), kind text not null, record_id uuid not null,
  idempotency_key text not null unique, attempts integer not null default 0,
  due_at timestamptz not null default now(), lock_until timestamptz, completed_at timestamptz
);
create table private.audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id),
  action text not null, target_id text not null, reason text, created_at timestamptz not null default now()
);
create table public.support_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  subject text not null check(length(subject) between 3 and 120), message text not null check(length(message) between 10 and 3000),
  status text not null default 'open', created_at timestamptz not null default now()
);
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,display_name) values(new.id, left(coalesce(new.raw_user_meta_data->>'name',''),80)) on conflict do nothing; return new; end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;
create trigger create_customer_profile after insert on auth.users for each row execute function private.create_profile();
alter table public.profiles enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.orders enable row level security;
alter table public.licenses enable row level security;
alter table public.devices enable row level security;
alter table public.support_requests enable row level security;
alter table private.license_secrets enable row level security;
alter table private.webhook_events enable row level security;
alter table private.outbox enable row level security;
alter table private.audit_log enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy published_products on public.products for select to anon,authenticated using(status='published');
create policy published_prices on public.prices for select to anon,authenticated using(active and exists(select 1 from public.products p where p.id=product_id and p.status='published'));
create policy own_orders on public.orders for select to authenticated using(user_id=(select auth.uid()));
create policy own_licenses on public.licenses for select to authenticated using(user_id=(select auth.uid()));
create policy own_devices on public.devices for select to authenticated using(exists(select 1 from public.licenses l where l.id=license_id and l.user_id=(select auth.uid())));
create policy own_support on public.support_requests for select to authenticated using(user_id=(select auth.uid()));
-- No browser write grants, no role editing, and no direct secret access.
-- Staff writes and fulfillment require future audited server transactions, not blanket public policies.
revoke all on public.profiles,public.staff_memberships,public.products,public.prices,public.orders,public.licenses,public.devices,public.support_requests from anon,authenticated;
grant select on public.products,public.prices to anon,authenticated;
grant select on public.profiles,public.orders,public.licenses,public.devices,public.support_requests to authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
create index orders_owner on public.orders(user_id,created_at desc);
create index licenses_owner on public.licenses(user_id,product_id);
create index devices_active on public.devices(license_id) where active;
create index pending_outbox on private.outbox(due_at) where completed_at is null;
commit;
