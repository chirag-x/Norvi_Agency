-- Phase 6, Part 2: Team Management

-- 1. admin_update_staff_role
create or replace function public.admin_update_staff_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_caller_role, '') != 'owner' then
    raise exception 'Only the owner can change staff roles.';
  end if;

  if p_role not in ('administrator', 'product_manager', 'support') then
    raise exception 'Invalid role.';
  end if;

  -- Prevent changing owner's role
  if exists (select 1 from public.staff_memberships where user_id = p_user_id and role = 'owner') then
    raise exception 'Cannot change the role of an owner.';
  end if;

  update public.staff_memberships
  set role = p_role
  where user_id = p_user_id;

  if not found then
    raise exception 'Staff member not found.';
  end if;

  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), 'staff.role_changed', p_user_id::text || ' -> ' || p_role);
end;
$$;
revoke execute on function public.admin_update_staff_role(uuid, text) from public, anon;
grant execute on function public.admin_update_staff_role(uuid, text) to authenticated;

-- 2. admin_delete_invitation
create or replace function public.admin_delete_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_caller_role text;
  v_email text;
begin
  select role into v_caller_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_caller_role, '') not in ('owner', 'administrator') then
    raise exception 'Permission denied.';
  end if;

  select email into v_email from public.staff_invitations where id = p_invitation_id;
  if not found then
    raise exception 'Invitation not found.';
  end if;

  delete from public.staff_invitations where id = p_invitation_id;

  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), 'invitation.deleted', v_email);
end;
$$;
revoke execute on function public.admin_delete_invitation(uuid) from public, anon;
grant execute on function public.admin_delete_invitation(uuid) to authenticated;
