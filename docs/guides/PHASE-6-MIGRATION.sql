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
-- Phase 6, Part 1: Customer Management & Gifting

-- 1. admin_list_customers()
create or replace function public.admin_list_customers()
returns json language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_items json;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(c)), '[]'::json) into v_items
  from (
    select 
      p.id, 
      p.email, 
      p.name, 
      p.suspended,
      p.created_at as "createdAt",
      (select count(*) from public.orders o where o.user_id = p.id) as "orderCount",
      (select count(*) from public.licenses l where l.user_id = p.id and l.status = 'active') as "activeLicenses"
    from public.profiles p
    where not exists (select 1 from public.staff_memberships s where s.user_id = p.id) -- Exclude staff from customer list
    order by p.created_at desc
  ) c;

  return json_build_object('items', v_items, 'preview', false);
end;
$$;
revoke execute on function public.admin_list_customers() from public, anon;
grant execute on function public.admin_list_customers() to authenticated;

-- 2. admin_set_customer_status()
create or replace function public.admin_set_customer_status(p_customer_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  update public.profiles
  set suspended = p_suspended
  where id = p_customer_id;

  if not found then
    raise exception 'Customer not found.';
  end if;

  -- Audit log
  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), case when p_suspended then 'customer.suspended' else 'customer.restored' end, p_customer_id::text);
end;
$$;
revoke execute on function public.admin_set_customer_status(uuid, boolean) from public, anon;
grant execute on function public.admin_set_customer_status(uuid, boolean) to authenticated;

-- 3. admin_gift_license()
create or replace function public.admin_gift_license(p_email text, p_product_slug text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_user_id uuid;
  v_product_id uuid;
  v_order_id uuid;
  v_license_id uuid;
begin
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied.';
  end if;

  -- 1. Find User
  select id into v_user_id from public.profiles where email = p_email;
  if v_user_id is null then
    raise exception 'Account with this email does not exist. They must register first.';
  end if;

  -- 2. Find Product
  select id into v_product_id from public.products where slug = p_product_slug;
  if v_product_id is null then
    raise exception 'Product not found.';
  end if;

  -- 3. Create Manual Order
  insert into public.orders (user_id, product_id, status, amount, currency, external_id)
  values (v_user_id, v_product_id, 'completed', 0, 'USD', 'manual_gift_' || substr(md5(random()::text), 1, 10))
  returning id into v_order_id;

  -- 4. Create License
  insert into public.licenses (user_id, product_id, order_id, status)
  values (v_user_id, v_product_id, v_order_id, 'active')
  returning id into v_license_id;

  -- 5. Issue Key
  perform private.issue_license_key(v_license_id);

  -- 6. Audit log
  insert into private.audit_log (actor_id, action, target_id) 
  values (auth.uid(), 'license.gifted', v_license_id::text || ' to ' || p_email);

  return v_license_id;
end;
$$;
revoke execute on function public.admin_gift_license(text, text) from public, anon;
grant execute on function public.admin_gift_license(text, text) to authenticated;
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
drop policy if exists "Authenticated users can read announcements" on public.announcements;
create policy "Authenticated users can read announcements" 
on public.announcements for select 
to authenticated 
using (
  (audience = 'customer')
  or 
  (audience = 'team' and exists (select 1 from public.staff_memberships where user_id = auth.uid() and active = true))
);

-- Write policies
drop policy if exists "Owners can manage announcements" on public.announcements;
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
-- 022_phase6_part3_settings.sql

-- Add Dynamic Role Permissions and Maintenance Mode to site_settings
ALTER TABLE public.site_settings
ADD COLUMN permissions JSONB DEFAULT '{"support": ["/customers", "/licenses", "/orders"], "product_manager": ["/products", "/content"], "administrator": ["/products", "/customers", "/licenses", "/orders", "/subscriptions", "/team", "/content", "/settings", "/activity"]}'::jsonb,
ADD COLUMN maintenance_mode BOOLEAN NOT NULL DEFAULT false;

-- Update the RPC to allow modifying these advanced settings
CREATE OR REPLACE FUNCTION public.admin_update_advanced_settings(
  p_maintenance_mode BOOLEAN,
  p_permissions JSONB
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Check permissions (Owner only for advanced settings)
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role != 'owner' THEN
    RAISE EXCEPTION 'Owner permission required.';
  END IF;

  -- 2. Update settings
  UPDATE public.site_settings SET
    maintenance_mode = p_maintenance_mode,
    permissions = p_permissions,
    updated_at = now()
  WHERE id = 1;

  -- 3. Log the action
  INSERT INTO public.audit_log (id, user_id, action, target)
  VALUES (gen_random_uuid(), auth.uid(), 'Updated advanced settings', 'global');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_advanced_settings TO authenticated;
