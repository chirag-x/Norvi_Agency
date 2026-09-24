begin;

-- ============================================================================
-- GLOBAL SECURITY LOCKDOWN
-- ============================================================================
-- Ensure all future functions in public are NOT executable by public/anon by default
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ============================================================================
-- FIX: REWRITE PRIVILEGED RPC FUNCTIONS TO EXPLICITLY REJECT NULL IDENTITIES
-- AND REQUIRE AAL2 (MFA) FOR ALL ADMIN OPERATIONS.
-- ============================================================================

-- 1. admin_list_products
create or replace function public.admin_list_products()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
  v_products json;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied: Product manager access required.';
  end if;

  select coalesce(json_agg(json_build_object(
    'id', id, 'slug', slug, 'name', name, 'category', category,
    'tagline', tagline, 'description', description, 'price', price_label,
    'status', status, 'icon', icon, 'color', color, 'features', features,
    'version', version, 'requirements', requirements,
    'releaseStatus', release_status
  ) order by created_at asc), '[]'::json) into v_products
  from public.products;
  return json_build_object('items', v_products);
end;
$$;
revoke execute on function public.admin_list_products() from public, anon;
grant execute on function public.admin_list_products() to authenticated;

-- 2. admin_upsert_product
create or replace function public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category text, p_tagline text,
  p_description text, p_price_label text, p_status text, p_icon text,
  p_color text, p_features text[], p_version text, p_requirements text,
  p_release_status text
)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'product_manager') then
    raise exception 'Permission denied: Product manager access required.';
  end if;

  if p_id is null then
    insert into public.products (slug, name, category, tagline, description, price_label, status, icon, color, features, version, requirements, release_status)
    values (p_slug, p_name, p_category, p_tagline, p_description, p_price_label, p_status, p_icon, p_color, p_features, p_version, p_requirements, p_release_status);
  else
    update public.products set
      slug = p_slug, name = p_name, category = p_category, tagline = p_tagline,
      description = p_description, price_label = p_price_label, status = p_status,
      icon = p_icon, color = p_color, features = p_features, version = p_version,
      requirements = p_requirements, release_status = p_release_status, revision = revision + 1
    where id = p_id;
  end if;
  insert into private.audit_log (actor_id, action, target_id) values (auth.uid(), 'Updated product catalog', p_slug);
end;
$$;
revoke execute on function public.admin_upsert_product(uuid, text, text, text, text, text, text, text, text, text, text[], text, text, text) from public, anon;
grant execute on function public.admin_upsert_product(uuid, text, text, text, text, text, text, text, text, text, text[], text, text, text) to authenticated;

-- 3. admin_update_settings
create or replace function public.admin_update_settings(
  p_name text, p_headline text, p_description text, p_email text, p_company text, p_domain text
)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator') then
    raise exception 'Permission denied: Administrator access required.';
  end if;

  update public.site_settings set
    name = coalesce(p_name, name), headline = coalesce(p_headline, headline),
    description = coalesce(p_description, description), email = coalesce(p_email, email),
    company = coalesce(p_company, company), domain = coalesce(p_domain, domain), updated_at = now()
  where id = 1;
  insert into private.audit_log (actor_id, action, target_id) values (auth.uid(), 'Updated site settings', 'global');
end;
$$;
revoke execute on function public.admin_update_settings(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_settings(text, text, text, text, text, text) to authenticated;

-- 4. admin_overview_stats
create or replace function public.admin_overview_stats()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text; v_customers bigint; v_licenses bigint; v_products bigint;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'product_manager', 'support') then
    raise exception 'Permission denied.';
  end if;

  select count(*) into v_customers from public.profiles where suspended = false and not exists (select 1 from public.staff_memberships s where s.user_id = public.profiles.id);
  select count(*) into v_licenses from public.licenses where status = 'active';
  select count(*) into v_products from public.products;
  return json_build_object('customers', v_customers, 'licenses', v_licenses, 'products', v_products);
end;
$$;
revoke execute on function public.admin_overview_stats() from public, anon;
grant execute on function public.admin_overview_stats() to authenticated;

-- 5. admin_list_licenses
create or replace function public.admin_list_licenses()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text; v_items json;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(l)), '[]'::json) into v_items
  from (
    select l.id, p.name as product, pr.display_name as customer, l.status, l.key_suffix as suffix,
      (select count(*) from public.devices d where d.license_id = l.id) > 0 as device, l.created_at as "createdAt"
    from public.licenses l join public.products p on p.id = l.product_id join public.profiles pr on pr.id = l.user_id
    order by l.created_at desc
  ) l;
  return json_build_object('items', v_items);
end;
$$;
revoke execute on function public.admin_list_licenses() from public, anon;
grant execute on function public.admin_list_licenses() to authenticated;

-- 6. admin_list_orders
create or replace function public.admin_list_orders()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text; v_items json;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(o)), '[]'::json) into v_items
  from (
    select o.id, p.name as product, pr.display_name as customer, o.amount_minor as amount,
           o.currency, o.status, o.created_at as "createdAt"
    from public.orders o join public.products p on p.id = o.product_id join public.profiles pr on pr.id = o.user_id
    order by o.created_at desc
  ) o;
  return json_build_object('items', v_items);
end;
$$;
revoke execute on function public.admin_list_orders() from public, anon;
grant execute on function public.admin_list_orders() to authenticated;

-- 7. admin_list_activity (AND FIX OUTBOX SCHEMA REFERENCE)
create or replace function public.admin_list_activity()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text; v_items json; v_emails json;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(row_to_json(a)), '[]'::json) into v_items
  from (
    select a.id, pr.display_name as actor, a.action, a.target_id as target, a.created_at as "createdAt"
    from private.audit_log a join public.profiles pr on pr.id = a.actor_id
    order by a.created_at desc limit 100
  ) a;

  select coalesce(json_agg(row_to_json(e)), '[]'::json) into v_emails
  from (
    select o.id, o.kind, case when o.completed_at is not null then 'sent' else 'pending' end as status, 
    o.record_id::text as target_id, o.due_at as "createdAt"
    from private.outbox o order by o.due_at desc limit 50
  ) e;

  return json_build_object('items', v_items, 'emails', v_emails);
end;
$$;
revoke execute on function public.admin_list_activity() from public, anon;
grant execute on function public.admin_list_activity() to authenticated;

-- 8. admin_set_license_status
create or replace function public.admin_set_license_status(p_license_id uuid, p_status text, p_reason text)
returns void
language plpgsql security definer set search_path='' as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
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

-- 9. invite_staff_member
create or replace function public.invite_staff_member(invite_email text, invite_role text)
returns void
language plpgsql volatile security definer set search_path='' as $$
declare
  v_caller_role text; v_invite_id uuid;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_caller_role from public.staff_memberships where user_id = auth.uid();
  if coalesce(v_caller_role, '') != 'owner' then
    raise exception 'Permission denied: Only owners can invite staff.';
  end if;

  insert into public.staff_invitations (email, role, status) values (invite_email, invite_role, 'pending')
  on conflict (email) do update set role = excluded.role, status = 'pending', created_at = now()
  returning id into v_invite_id;
  insert into private.outbox (kind, record_id, idempotency_key) values ('staff_invite', v_invite_id, 'invite_' || v_invite_id::text || '_' || extract(epoch from now())::text);
end;
$$;
revoke execute on function public.invite_staff_member(text, text) from public, anon;
grant execute on function public.invite_staff_member(text, text) to authenticated;

-- 10. list_team
create or replace function public.list_team()
returns json
language plpgsql security definer set search_path='' as $$
declare
  v_role text; v_members json; v_invites json;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id = auth.uid() and active = true;
  if coalesce(v_role, '') not in ('owner', 'administrator', 'product_manager', 'support') then
    raise exception 'Permission denied.';
  end if;

  select coalesce(json_agg(json_build_object('id', sm.id, 'user_id', sm.user_id, 'role', sm.role, 'active', sm.active, 'email', u.email, 'name', p.display_name)), '[]'::json) into v_members
  from public.staff_memberships sm join auth.users u on u.id = sm.user_id join public.profiles p on p.id = sm.user_id;

  select coalesce(json_agg(json_build_object('id', id, 'email', email, 'role', role, 'status', status, 'created_at', created_at)), '[]'::json) into v_invites
  from public.staff_invitations where status = 'pending';

  return json_build_object('members', v_members, 'invitations', v_invites);
end;
$$;
revoke execute on function public.list_team() from public, anon;
grant execute on function public.list_team() to authenticated;

-- 11. modify_staff_status
create or replace function public.modify_staff_status(p_user_id uuid)
returns void
language plpgsql volatile security definer set search_path='' as $$
declare
  v_caller_role text;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  -- TODO (Phase 2): if (select coalesce(auth.jwt()->>'aal', '')) != 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_caller_role from public.staff_memberships where user_id = auth.uid();
  if coalesce(v_caller_role, '') != 'owner' then
    raise exception 'Permission denied: Only owners can modify staff status.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot modify your own status.';
  end if;

  update public.staff_memberships set active = not active where user_id = p_user_id;
end;
$$;
revoke execute on function public.modify_staff_status(uuid) from public, anon;
grant execute on function public.modify_staff_status(uuid) to authenticated;

-- Revoke execute from private trigger functions just in case
revoke execute on function private.create_profile() from public, anon, authenticated;
revoke execute on function private.queue_order_receipt() from public, anon, authenticated;
revoke execute on function private.claim_staff_invitation() from public, anon, authenticated;

commit;
