-- Phase 6, Part 4: Bug Fixes for Customers, Team, and Announcements

-- 0. Allow free (gift) orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amount_minor_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_amount_minor_check CHECK (amount_minor >= 0);


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
create or replace function public.admin_gift_license(p_email text, p_product_slug text, p_encryption_secret text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_user_id uuid;
  v_product_id uuid;
  v_price_id uuid;
  v_order_id uuid;
  v_license_id uuid;
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
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
  
  select id into v_price_id from public.prices where product_id = v_product_id limit 1;

  -- 3. Create Manual Order
  insert into public.orders (user_id, product_id, price_id, status, amount_minor, currency, provider_payment_id, idempotency_key)
  values (v_user_id, v_product_id, v_price_id, 'paid', 0, 'USD', 'gift_' || substr(md5(random()::text), 1, 10), 'gift_' || substr(md5(random()::text), 1, 10))
  returning id into v_order_id;

  -- 4. Generate Key
  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' || 
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4));
               
  v_key_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  -- 5. Create License
  insert into public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices)
  values (v_license_id, v_user_id, v_product_id, v_order_id, 'active', right(v_raw_key, 4), 3);

  insert into private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  values (v_license_id, v_key_hash, v_encrypted_key, 1);

  -- 6. Audit log
  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), 'license.gifted', v_license_id::text || ' to ' || p_email);

  return v_license_id;
end;
$$;
revoke execute on function public.admin_gift_license(text, text, text) from public, anon;
grant execute on function public.admin_gift_license(text, text, text) to authenticated;


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


-- Refresh PostgREST schema cache to make new columns visible to the API
NOTIFY pgrst, 'reload schema';

-- 4. Fix pgcrypto schema references in Phase 4 functions
create or replace function private.process_order(p_order_id uuid, p_encryption_secret text)
returns void language plpgsql security definer set search_path='' as $body$
declare
  v_order record;
  v_license_id uuid;
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
begin
  select user_id, product_id, status into v_order from public.orders where id = p_order_id;
  if not found or v_order.status != 'paid' then return; end if;

  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' || 
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4));
               
  v_key_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);
  
  insert into public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices)
  values (v_license_id, v_order.user_id, v_order.product_id, p_order_id, 'active', right(v_raw_key, 4), 3);

  insert into private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  values (v_license_id, v_key_hash, v_encrypted_key, 1);
end;
$body$;

create or replace function private.reveal_license_key(p_license_id uuid, p_encryption_secret text)
returns text language plpgsql security definer set search_path='' as $body$
declare
  v_encrypted_key text;
  v_raw_key text;
  v_is_owner boolean;
begin
  select active into v_is_owner from public.staff_memberships where user_id = auth.uid() and role = 'owner';
  
  if coalesce(v_is_owner, false) = false then
    if not exists (select 1 from public.licenses where id = p_license_id and user_id = auth.uid()) then
      raise exception 'License not found or access denied.';
    end if;
  end if;

  select encrypted_key into v_encrypted_key from private.license_secrets where license_id = p_license_id;
  if v_encrypted_key is null then
    raise exception 'Key material missing.';
  end if;

  v_raw_key := extensions.pgp_sym_decrypt(v_encrypted_key::bytea, p_encryption_secret);
  return v_raw_key;
exception when others then
  raise exception 'Failed to decrypt license key. The encryption secret may be invalid.';
end;
$body$;

create or replace function private.rotate_license_key(p_license_id uuid, p_encryption_secret text)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
  v_version integer;
begin
  if not exists (select 1 from public.licenses where id = p_license_id and user_id = auth.uid()) then
    raise exception 'License not found or access denied.';
  end if;

  v_raw_key := 'NORVI-' || 
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4));
               
  v_key_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);
  
  update public.licenses set key_suffix = right(v_raw_key, 4), key_version = key_version + 1 where id = p_license_id returning key_version into v_version;
  
  update private.license_secrets set key_hash = v_key_hash, encrypted_key = v_encrypted_key, encryption_key_version = v_version where license_id = p_license_id;
  
  return json_build_object('key', v_raw_key, 'suffix', right(v_raw_key, 4), 'version', v_version);
end;
$body$;

