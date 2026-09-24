begin;

-- 1. admin_overview_stats
create or replace function public.admin_overview_stats()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_customers bigint;
  v_licenses bigint;
  v_products bigint;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'product_manager', 'support') then
    raise exception 'Permission denied.';
  end if;

  select count(*) into v_customers from public.profiles where suspended = false and not exists (select 1 from public.staff_memberships s where s.user_id = public.profiles.id);
  select count(*) into v_licenses from public.licenses where status = 'active';
  select count(*) into v_products from public.products;

  return json_build_object(
    'customers', v_customers,
    'licenses', v_licenses,
    'products', v_products
  );
end;
$$;

-- 2. admin_list_licenses
create or replace function public.admin_list_licenses()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_items json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(l)), '[]'::json) into v_items
  from (
    select l.id, p.name as product, pr.display_name as customer, l.status, l.key_suffix as suffix,
      (select count(*) from public.devices d where d.license_id = l.id) > 0 as device,
      l.created_at as "createdAt"
    from public.licenses l
    join public.products p on p.id = l.product_id
    join public.profiles pr on pr.id = l.user_id
    order by l.created_at desc
  ) l;

  return json_build_object('items', v_items);
end;
$$;

-- 3. admin_list_orders
create or replace function public.admin_list_orders()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_items json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(o)), '[]'::json) into v_items
  from (
    select o.id, p.name as product, pr.display_name as customer, o.amount_minor as amount,
           o.currency, o.status, o.created_at as "createdAt"
    from public.orders o
    join public.products p on p.id = o.product_id
    join public.profiles pr on pr.id = o.user_id
    order by o.due_at desc
  ) o;

  return json_build_object('items', v_items);
end;
$$;

-- 4. admin_list_activity
create or replace function public.admin_list_activity()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_items json;
  v_emails json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(a)), '[]'::json) into v_items
  from (
    select a.id, pr.display_name as actor, a.action, a.target_id as target, a.created_at as "createdAt"
    from private.audit_log a
    join public.profiles pr on pr.id = a.actor_id
    order by a.created_at desc
    limit 100
  ) a;

  select coalesce(json_agg(row_to_json(e)), '[]'::json) into v_emails
  from (
    select o.id, o.kind, o.record_id as target_id, case when o.completed_at is not null then 'completed' when o.attempts > 0 then 'failed' else 'pending' end as status, o.due_at as "createdAt"
    from private.outbox o
    order by o.due_at desc
    limit 50
  ) e;

  return json_build_object('items', v_items, 'emails', v_emails);
end;
$$;

-- 5. Revocation & Restore
create or replace function public.admin_set_license_status(p_license_id uuid, p_status text, p_reason text)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if v_role not in ('owner', 'administrator') then
    raise exception 'Permission denied.';
  end if;

  update public.licenses set status = p_status where id = p_license_id;
  if p_status = 'revoked' then
    delete from public.devices where license_id = p_license_id;
  end if;
  insert into private.audit_log (actor_id, action, target_id) values (auth.uid(), 'license.' || p_status, p_license_id::text || ' (' || p_reason || ')');
end;
$$;

commit;
