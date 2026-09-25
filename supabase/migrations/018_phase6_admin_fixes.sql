begin;

-- Recreate admin_set_license_status which was accidentally dropped in 017
create or replace function public.admin_set_license_status(p_license_id uuid, p_status text, p_reason text)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator') then
    raise exception 'Permission denied.';
  end if;

  update public.licenses set status = p_status where id = p_license_id;
  if p_status = 'revoked' then delete from public.devices where license_id = p_license_id; end if;
  insert into private.audit_log (actor_id, action, target_id) values (auth.uid(), 'license.' || p_status, p_license_id::text || ' (' || p_reason || ')');
end;
$$;
revoke execute on function public.admin_set_license_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_license_status(uuid, text, text) to authenticated;

commit;
