-- Phase 6, Part 4: Bug Fixes for Customers, Team, and Announcements

-- 1. Fix admin_list_customers to join auth.users for email
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
      u.email, 
      p.display_name as name, 
      p.suspended,
      p.created_at as "createdAt",
      (select count(*) from public.orders o where o.user_id = p.id) as "orderCount",
      (select count(*) from public.licenses l where l.user_id = p.id and l.status = 'active') as "activeLicenses"
    from public.profiles p
    join auth.users u on u.id = p.id
    where not exists (select 1 from public.staff_memberships s where s.user_id = p.id) -- Exclude staff from customer list
    order by p.created_at desc
  ) c;

  return json_build_object('items', v_items, 'preview', false);
end;
$$;
revoke execute on function public.admin_list_customers() from public, anon;
grant execute on function public.admin_list_customers() to authenticated;


-- 2. Fix admin_gift_license to query auth.users for email
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
  select id into v_user_id from auth.users where email = p_email;
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


-- 3. Fix list_announcements to properly aggregate and order
create or replace function public.list_announcements(p_audience text)
returns json language plpgsql security definer set search_path='' as $$
declare
  v_items json;
  v_is_staff boolean;
begin
  select exists (select 1 from public.staff_memberships where user_id = auth.uid() and active = true) into v_is_staff;
  
  if p_audience = 'team' and not v_is_staff then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(json_build_object('id', id, 'message', message, 'createdAt', created_at, 'authorId', author_id) order by created_at desc), '[]'::json) into v_items
  from public.announcements 
  where audience = p_audience;

  return coalesce(v_items, '[]'::json);
end;
$$;
revoke execute on function public.list_announcements(text) from public, anon;
grant execute on function public.list_announcements(text) to authenticated;


-- 4. Fix list_team to return correct shape and remove invalid sm.id
create or replace function public.list_team()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text; v_members json; v_invites json;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'product_manager', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(json_build_object('id', sm.user_id, 'user_id', sm.user_id, 'role', sm.role, 'active', sm.active, 'email', u.email, 'name', p.display_name)), '[]'::json) into v_members
  from public.staff_memberships sm join auth.users u on u.id = sm.user_id join public.profiles p on p.id = sm.user_id;

  select coalesce(json_agg(json_build_object('id', id, 'email', email, 'role', role, 'status', status, 'created_at', created_at)), '[]'::json) into v_invites
  from public.staff_invitations where status = 'pending';

  return json_build_object('items', v_members, 'invitations', v_invites);
end;
$$;
revoke execute on function public.list_team() from public, anon;
grant execute on function public.list_team() to authenticated;
