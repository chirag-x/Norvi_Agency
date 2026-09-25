begin;

create or replace function public.delete_customer_account()
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_uid uuid;
begin
  v_uid := auth.uid();
  
  -- 1. Check if the user is staff. If they are, reject.
  select role into v_role from public.staff_memberships where user_id = v_uid;
  if v_role is not null then
    raise exception 'Staff accounts cannot be automatically deleted. Contact the owner.';
  end if;

  -- 2. Manually delete dependent records to satisfy foreign key constraints
  -- since they weren't created with ON DELETE CASCADE (except profiles)
  
  -- Delete support requests
  delete from public.support_requests where user_id = v_uid;
  
  -- Nullify audit_log actor_id instead of deleting logs to keep history
  update private.audit_log set actor_id = null where actor_id = v_uid;
  
  -- Delete devices and secrets (depend on licenses)
  delete from public.devices where license_id in (select id from public.licenses where user_id = v_uid);
  delete from private.license_secrets where license_id in (select id from public.licenses where user_id = v_uid);
  
  -- Delete licenses
  delete from public.licenses where user_id = v_uid;
  
  -- Delete orders
  delete from public.orders where user_id = v_uid;

  -- 3. Delete the user from auth.users (cascades to profiles)
  delete from auth.users where id = v_uid;
end;
$$;

commit;
