begin;

-- RPC for verifying a license key hash and granting a device lease
create function public.activate_agent_license(
  p_key_hash text,
  p_product_id uuid,
  p_device_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_license record;
  v_device record;
  v_active_devices integer;
begin
  -- 1. Find the license secret matching the hash
  select l.id, l.status, l.expires_at, l.max_devices, l.user_id 
  into v_license
  from private.license_secrets ls
  join public.licenses l on l.id = ls.license_id
  where ls.key_hash = p_key_hash and l.product_id = p_product_id;

  if not found then
    return jsonb_build_object('error', 'License key is invalid or for a different product.');
  end if;

  if v_license.status != 'active' then
    return jsonb_build_object('error', 'This license has been revoked.');
  end if;

  if v_license.expires_at is not null and v_license.expires_at < now() then
    return jsonb_build_object('error', 'This license has expired.');
  end if;

  -- 2. Check Device Limits
  select * into v_device from public.devices 
  where license_id = v_license.id and installation_id = p_device_id;

  if found then
    -- Existing device: refresh last_seen_at
    if not v_device.active then
      return jsonb_build_object('error', 'This device has been blocked by the administrator.');
    end if;
    
    update public.devices 
    set last_seen_at = now() 
    where id = v_device.id;
  else
    -- New device: count active devices
    select count(*) into v_active_devices from public.devices 
    where license_id = v_license.id and active = true;

    if v_active_devices >= v_license.max_devices then
      return jsonb_build_object('error', 'Device limit reached. Revoke an old device in your dashboard first.');
    end if;

    -- Insert new device
    insert into public.devices (license_id, installation_id)
    values (v_license.id, p_device_id);
  end if;

  -- 3. Return Success (A basic authorization response)
  return jsonb_build_object(
    'ok', true,
    'licenseId', v_license.id,
    'deviceId', p_device_id,
    'message', 'Activation successful.'
  );
end; $$;

revoke all on function public.activate_agent_license(text, uuid, text) from public, anon;
grant execute on function public.activate_agent_license(text, uuid, text) to anon, authenticated;

-- RPC for admin device reset
create function public.reset_license_devices(p_license_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.account_allowed() or not exists(
    select 1 from public.staff_memberships s where s.user_id=auth.uid() and s.active and s.role in ('owner','administrator','support')
  ) then raise exception 'Staff permission required'; end if;
  
  delete from public.devices where license_id = p_license_id;
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'devices.reset',p_license_id::text);
end; $$;

revoke all on function public.reset_license_devices(uuid) from public, anon;
grant execute on function public.reset_license_devices(uuid) to authenticated;

commit;
