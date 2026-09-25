begin;

-- RPC to reveal a license key (decryption is simulated or handled via pgsodium in production)
create or replace function public.reveal_license_key(p_license_id uuid)
returns text
language plpgsql security definer set search_path='' as $$
declare
  v_key text;
begin
  -- Ensure the caller owns the license
  if not exists (select 1 from public.licenses where id = p_license_id and user_id = auth.uid()) then
    raise exception 'Permission denied: License not found or not owned by user.';
  end if;

  select encrypted_key into v_key from private.license_secrets where license_id = p_license_id;
  if v_key is null then
    raise exception 'Key material missing.';
  end if;

  -- In production, this would use pgsodium to decrypt `encrypted_key`. 
  -- For now, we return it directly (assuming it's base64 or plaintext for preview).
  return v_key;
end;
$$;

-- Allow releasing a device (deactivating it)
-- Note: the actual endpoint uses db.from('devices').update(), which relies on RLS.
-- Let's ensure the RLS policy on devices allows updating their own devices!
drop policy if exists own_devices on public.devices;
create policy own_devices on public.devices for all to authenticated using(exists(select 1 from public.licenses l where l.id=license_id and l.user_id=auth.uid())) with check(exists(select 1 from public.licenses l where l.id=license_id and l.user_id=auth.uid()));

commit;
