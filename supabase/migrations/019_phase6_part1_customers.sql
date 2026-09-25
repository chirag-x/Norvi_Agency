-- Phase 6, Part 1: Customer Management & Gifting

-- 1. admin_list_customers()
create or replace function public.admin_list_customers()
returns json language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_items json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(c)), '[]'::json) into v_items
  from (
    select 
      p.id, 
      p.email, 
      p.name, 
      p.suspended,
      p.created_at as "createdAt",
      (select count(*) from public.orders o where o.user_id = p.id) as "orderCount",
      (select count(*) from public.licenses l where l.user_id = p.id and l.status = 'active') as "activeLicenses"
    from public.profiles p
    where not exists (select 1 from public.staff_memberships s where s.user_id = p.id) -- Exclude staff from customer list
    order by p.created_at desc
  ) c;

  return json_build_object('items', v_items, 'preview', false);
end;
$$;
revoke execute on function public.admin_list_customers() from public, anon;
grant execute on function public.admin_list_customers() to authenticated;

-- 2. admin_set_customer_status()
create or replace function public.admin_set_customer_status(p_customer_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  update public.profiles
  set suspended = p_suspended
  where id = p_customer_id;

  if not found then
    raise exception 'Customer not found.';
  end if;

  -- Audit log
  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), case when p_suspended then 'customer.suspended' else 'customer.restored' end, p_customer_id::text);
end;
$$;
revoke execute on function public.admin_set_customer_status(uuid, boolean) from public, anon;
grant execute on function public.admin_set_customer_status(uuid, boolean) to authenticated;

-- 3. admin_gift_license()
create or replace function public.admin_gift_license(p_email text, p_product_slug text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_user_id uuid;
  v_product_id uuid;
  v_order_id uuid;
  v_license_id uuid;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied.';
  end if;

  -- 1. Find User
  select id into v_user_id from public.profiles where email = p_email;
  if v_user_id is null then
    raise exception 'Account with this email does not exist. They must register first.';
  end if;

  -- 2. Find Product
  select id into v_product_id from public.products where slug = p_product_slug;
  if v_product_id is null then
    raise exception 'Product not found.';
  end if;

  -- 3. Create Manual Order
  insert into public.orders (user_id, product_id, status, amount, currency, external_id)
  values (v_user_id, v_product_id, 'completed', 0, 'USD', 'manual_gift_' || substr(md5(random()::text), 1, 10))
  returning id into v_order_id;

  -- 4. Create License
  insert into public.licenses (user_id, product_id, order_id, status)
  values (v_user_id, v_product_id, v_order_id, 'active')
  returning id into v_license_id;

  -- 5. Issue Key
  perform private.issue_license_key(v_license_id);

  -- 6. Audit log
  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), 'license.gifted', v_license_id::text || ' to ' || p_email);

  return v_license_id;
end;
$$;
revoke execute on function public.admin_gift_license(text, text) from public, anon;
grant execute on function public.admin_gift_license(text, text) to authenticated;
