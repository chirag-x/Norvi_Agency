begin;

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('administrator','product_manager','support')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  unique(email)
);

alter table public.staff_invitations enable row level security;
create policy admin_invitations on public.staff_invitations for select to authenticated 
  using (exists (select 1 from public.staff_memberships where user_id = auth.uid() and role in ('owner', 'administrator')));

create function public.invite_staff_member(invite_email text, invite_role text)
returns void
language plpgsql volatile security definer set search_path='' as $$
declare
  v_caller_role text;
  v_invite_id uuid;
begin
  -- 1. Security Check: Only owners can invite staff
  select role into v_caller_role from public.staff_memberships where user_id = auth.uid();
  if v_caller_role != 'owner' then
    raise exception 'Permission denied: Only owners can invite staff.';
  end if;

  -- 2. Insert or update the invitation
  insert into public.staff_invitations (email, role, status)
  values (invite_email, invite_role, 'pending')
  on conflict (email) do update set role = excluded.role, status = 'pending'
  returning id into v_invite_id;

  -- 3. Trigger the Outbox Engine to send the email!
  insert into private.outbox (kind, record_id, idempotency_key)
  values ('staff_invite', v_invite_id, 'invite_' || v_invite_id || '_' || extract(epoch from now()));

  -- 4. Log the audit event
  insert into private.audit_log (actor_id, action, target_id)
  values (auth.uid(), 'Invited staff member', invite_email);
end;
$$;

-- Trigger to automatically claim invitation on signup
create function private.claim_staff_invitation() returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_invitations where email = new.email and status = 'pending';
  if v_role is not null then
    insert into public.staff_memberships(user_id, role) values (new.id, v_role);
    update public.staff_invitations set status = 'accepted' where email = new.email;
  end if;
  return new;
end;
$$;
revoke all on function private.claim_staff_invitation() from public, anon, authenticated;
create trigger claim_staff_invitation_trigger after insert on auth.users for each row execute function private.claim_staff_invitation();

-- RPC for Admin UI to list team members
create function public.list_team()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_members json;
  v_invites json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid();
  if v_role not in ('owner', 'administrator') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(json_build_object(
    'id', m.user_id, 'email', u.email, 'name', coalesce(p.display_name, ''),
    'role', m.role, 'status', case when m.active then 'active' else 'suspended' end
  )), '[]'::json) into v_members
  from public.staff_memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id;

  select coalesce(json_agg(json_build_object(
    'id', id, 'email', email, 'role', role, 'status', status
  )), '[]'::json) into v_invites
  from public.staff_invitations
  where status = 'pending';

  return json_build_object('items', v_members, 'invitations', v_invites);
end;
$$;

-- RPC to suspend or restore a staff member
create function public.modify_staff_status(p_user_id uuid)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_target_role text;
  v_is_active boolean;
begin
  if not exists(select 1 from public.staff_memberships where user_id = auth.uid() and role = 'owner') then
    raise exception 'Permission denied: Only owners can suspend staff.';
  end if;
  
  select role, active into v_target_role, v_is_active from public.staff_memberships where user_id = p_user_id;
  if v_target_role is null or v_target_role = 'owner' then
    raise exception 'Cannot suspend this user or user not found.';
  end if;

  update public.staff_memberships set active = not v_is_active where user_id = p_user_id;
  
  insert into private.audit_log (actor_id, action, target_id)
  values (auth.uid(), case when v_is_active then 'Suspended staff member' else 'Restored staff member' end, p_user_id::text);
end;
$$;

commit;
