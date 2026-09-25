-- Phase 6, Part 2: Internal Announcements

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) not null,
  audience text not null check (audience in ('customer', 'team')),
  message text not null,
  created_at timestamp with time zone default now()
);

alter table public.announcements enable row level security;

-- Read policies
create policy "Authenticated users can read announcements" 
on public.announcements for select 
to authenticated 
using (
  (audience = 'customer')
  or 
  (audience = 'team' and exists (select 1 from public.staff_memberships where user_id = auth.uid() and active = true))
);

-- Write policies
create policy "Owners can manage announcements" 
on public.announcements for all
to authenticated
using (
  exists (select 1 from public.staff_memberships where user_id = auth.uid() and role = 'owner' and active = true)
);

alter publication supabase_realtime add table public.announcements;

-- 1. admin_create_announcement
create or replace function public.admin_create_announcement(p_message text, p_audience text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.staff_memberships where user_id = auth.uid() and role = 'owner' and active = true) then
    raise exception 'Permission denied.';
  end if;
  
  insert into public.announcements (author_id, audience, message) 
  values (auth.uid(), p_audience, p_message);
  
  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), 'announcement.created', p_audience);
end;
$$;
revoke execute on function public.admin_create_announcement(text, text) from public, anon;
grant execute on function public.admin_create_announcement(text, text) to authenticated;

-- 2. admin_delete_announcement
create or replace function public.admin_delete_announcement(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.staff_memberships where user_id = auth.uid() and role = 'owner' and active = true) then
    raise exception 'Permission denied.';
  end if;
  
  delete from public.announcements where id = p_id;
end;
$$;
revoke execute on function public.admin_delete_announcement(uuid) from public, anon;
grant execute on function public.admin_delete_announcement(uuid) to authenticated;

-- 3. list_announcements
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

  select coalesce(json_agg(json_build_object('id', id, 'message', message, 'createdAt', created_at, 'authorId', author_id)), '[]'::json) into v_items
  from public.announcements 
  where audience = p_audience
  order by created_at desc;

  return coalesce(v_items, '[]'::json);
end;
$$;
revoke execute on function public.list_announcements(text) from public, anon;
grant execute on function public.list_announcements(text) to authenticated;
