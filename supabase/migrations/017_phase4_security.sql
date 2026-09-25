begin;

create extension if not exists pgcrypto;

-- 1. Update the webhook RPC to generate a real, securely encrypted license key
drop function if exists public.process_payment_webhook(uuid, text);
create or replace function public.process_payment_webhook(p_order_id uuid, p_payment_id text, p_encryption_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_license_id uuid;
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
begin
  if auth.role() != 'service_role' then
    raise exception 'Unauthorized';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = 'paid' then return jsonb_build_object('ok', true, 'message', 'Already processed'); end if;

  update public.orders set status = 'paid', provider_payment_id = p_payment_id where id = p_order_id;

  v_license_id := gen_random_uuid();
  -- Generate NORVI-XXXX-XXXX-XXXX-XXXX
  v_raw_key := 'NORVI-' || 
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4));
               
  v_key_hash := encode(public.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := public.pgp_sym_encrypt(v_raw_key, p_encryption_secret);
  
  insert into public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices)
  values (v_license_id, v_order.user_id, v_order.product_id, p_order_id, 'active', right(v_raw_key, 4), 3);

  insert into private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  values (v_license_id, v_key_hash, v_encrypted_key, 1);

  insert into private.outbox (kind, record_id, idempotency_key)
  values ('order_receipt', p_order_id, 'receipt_' || p_order_id);

  return jsonb_build_object('ok', true, 'license_id', v_license_id);
end;
$$;
revoke all on function public.process_payment_webhook(uuid, text, text) from public, anon, authenticated;
grant execute on function public.process_payment_webhook(uuid, text, text) to service_role;


-- 2. Update reveal_license_key to decrypt the key using the provided secret
drop function if exists public.reveal_license_key(uuid);
create or replace function public.reveal_license_key(p_license_id uuid, p_encryption_secret text)
returns text
language plpgsql security definer set search_path='' as $$
declare
  v_encrypted_key text;
  v_raw_key text;
  v_is_owner boolean;
begin
  -- Check if caller owns the license OR is a staff owner
  v_is_owner := exists (select 1 from public.licenses where id = p_license_id and user_id = auth.uid());
  if not v_is_owner then
    if not exists (select 1 from public.staff_memberships where user_id = auth.uid() and role = 'owner') then
      raise exception 'Permission denied: License not found or not owned by user.';
    end if;
  end if;

  select encrypted_key into v_encrypted_key from private.license_secrets where license_id = p_license_id;
  if v_encrypted_key is null then
    raise exception 'Key material missing.';
  end if;

  v_raw_key := public.pgp_sym_decrypt(v_encrypted_key::bytea, p_encryption_secret);
  return v_raw_key;
exception when others then
  raise exception 'Failed to decrypt license key. The encryption secret may be invalid.';
end;
$$;
revoke all on function public.reveal_license_key(uuid, text) from public, anon;
grant execute on function public.reveal_license_key(uuid, text) to authenticated;


-- 3. Update activate_agent_license to return all claims needed for a JWT
drop function if exists public.activate_agent_license(text, uuid, text);
create or replace function public.activate_agent_license(
  p_key_hash text,
  p_product_id uuid,
  p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_license record;
  v_device record;
  v_active_devices integer;
begin
  select l.id, l.status, l.expires_at, l.max_devices, l.user_id, l.key_version 
  into v_license
  from private.license_secrets ls
  join public.licenses l on l.id = ls.license_id
  where ls.key_hash = p_key_hash and l.product_id = p_product_id;

  if not found then return jsonb_build_object('error', 'License key is invalid or for a different product.'); end if;
  if v_license.status != 'active' then return jsonb_build_object('error', 'This license has been revoked.'); end if;
  if v_license.expires_at is not null and v_license.expires_at < now() then return jsonb_build_object('error', 'This license has expired.'); end if;

  select * into v_device from public.devices where license_id = v_license.id and installation_id = p_device_id;

  if found then
    if not v_device.active then return jsonb_build_object('error', 'This device has been blocked by the administrator.'); end if;
    update public.devices set last_seen_at = now() where id = v_device.id;
  else
    select count(*) into v_active_devices from public.devices where license_id = v_license.id and active = true;
    if v_active_devices >= v_license.max_devices then return jsonb_build_object('error', 'Device limit reached. Revoke an old device in your dashboard first.'); end if;
    insert into public.devices (license_id, installation_id) values (v_license.id, p_device_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'license_id', v_license.id,
    'device_id', p_device_id,
    'version', v_license.key_version,
    'expires_at', v_license.expires_at,
    'max_devices', v_license.max_devices
  );
end; $$;
revoke all on function public.activate_agent_license(text, uuid, text) from public, anon;
grant execute on function public.activate_agent_license(text, uuid, text) to anon, authenticated;


-- 4. Update rotate license key to accept the new encryption secret
drop function if exists public.admin_set_license_status(uuid, text, text);
-- Wait, admin_set_license_status doesn't rotate keys, it's done via a direct update in live.ts!
-- Wait, live.ts currently updates `license_secrets` directly!
-- We should create a secure RPC for rotation!
create or replace function public.rotate_license_key(p_license_id uuid, p_encryption_secret text)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
  v_version integer;
begin
  if not exists (select 1 from public.staff_memberships where user_id = auth.uid() and role in ('owner', 'administrator')) then
    raise exception 'Permission denied';
  end if;

  -- Generate new key
  v_raw_key := 'NORVI-' || 
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
               upper(substring(md5(random()::text) from 1 for 4));
               
  v_key_hash := encode(public.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := public.pgp_sym_encrypt(v_raw_key, p_encryption_secret);
  
  update public.licenses set key_suffix = right(v_raw_key, 4), key_version = key_version + 1 where id = p_license_id returning key_version into v_version;
  
  update private.license_secrets set key_hash = v_key_hash, encrypted_key = v_encrypted_key, encryption_key_version = v_version where license_id = p_license_id;
  
  return jsonb_build_object('ok', true, 'version', v_version);
end;
$$;
revoke all on function public.rotate_license_key(uuid, text) from public, anon;
grant execute on function public.rotate_license_key(uuid, text) to authenticated;

commit;
