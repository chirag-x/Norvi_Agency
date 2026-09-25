begin;

-- Function to safely delete a customer account
create or replace function public.delete_customer_account()
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  -- 1. Check if the user is staff. If they are, reject.
  select role into v_role from public.staff_memberships where user_id = auth.uid();
  if v_role is not null then
    raise exception 'Staff accounts cannot be automatically deleted. Contact the owner.';
  end if;

  -- 2. Delete the user from auth.users (this cascades to profiles, orders, licenses, etc. due to FKs)
  -- Note: Depending on Supabase version, deleting from auth.users requires postgres role or superuser.
  -- As a security definer function, this executes as the creator (postgres).
  delete from auth.users where id = auth.uid();
end;
$$;

commit;
