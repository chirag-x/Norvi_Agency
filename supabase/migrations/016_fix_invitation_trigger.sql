begin;

create or replace function private.claim_staff_invitation() 
returns trigger 
language plpgsql 
security definer 
set search_path=public 
as $$
declare
  v_role text;
begin
  -- Look for a pending invitation for this exact email
  select role into v_role from public.staff_invitations where email = new.email and status = 'pending';
  
  if v_role is not null then
    -- Claim the invitation
    insert into public.staff_memberships(user_id, role) values (new.id, v_role);
    update public.staff_invitations set status = 'accepted' where email = new.email;
  end if;
  
  return new;
exception when others then
  -- If anything goes wrong, silently continue so we don't break the registration process
  return new;
end;
$$;

commit;
