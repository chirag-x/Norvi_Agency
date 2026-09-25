begin;

-- Final compatibility layer for Phases 0-6. This migration is intentionally
-- forward-only so it can repair databases that already applied earlier files.
create extension if not exists pgcrypto with schema extensions;

alter table public.products
  add column if not exists category_id uuid references public.categories(id),
  add column if not exists logo_url text,
  add column if not exists workflow_heading text not null default 'Built for your workflow.',
  add column if not exists workflow_description text not null default '',
  add column if not exists workflow_media_url text,
  add column if not exists workflow_note text not null default '';

alter table public.site_settings
  add column if not exists permissions jsonb not null default '{"owner":["*"],"administrator":["","/products","/categories","/customers","/licenses","/orders","/payments","/support","/subscriptions","/announcements","/content","/activity"],"product_manager":["","/products","/categories","/announcements","/content"],"support":["","/customers","/licenses","/orders","/payments","/support","/announcements"]}'::jsonb,
  add column if not exists maintenance_mode boolean not null default false;

alter table public.products drop constraint if exists products_release_status_check;
alter table public.products add constraint products_release_status_check check (release_status in ('development','prelaunch','live'));

create or replace function private.require_staff(p_roles text[])
returns text language plpgsql stable security definer set search_path='' as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'Permission denied: Not authenticated.'; end if;
  if coalesce(auth.jwt()->>'aal','') <> 'aal2' then raise exception 'Permission denied: MFA (AAL2) required.'; end if;
  select role into v_role from public.staff_memberships where user_id=auth.uid() and active=true;
  if coalesce(v_role,'') <> all(p_roles) then raise exception 'Permission denied.'; end if;
  return v_role;
end; $$;
revoke all on function private.require_staff(text[]) from public,anon,authenticated;

create or replace function public.get_site_settings()
returns json language sql stable security definer set search_path='' as $$
  select json_build_object(
    'name',name,'headline',headline,'description',description,'email',email,
    'company',company,'domain',domain,'maintenanceMode',maintenance_mode,
    'maintenance_mode',maintenance_mode,'permissions',permissions
  ) from public.site_settings where id=1
$$;
revoke all on function public.get_site_settings() from public;
grant execute on function public.get_site_settings() to anon,authenticated;

create or replace function public.admin_update_settings(
  p_name text,p_headline text,p_description text,p_email text,p_company text,p_domain text
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_staff(array['owner','administrator']);
  update public.site_settings set name=coalesce(p_name,name),headline=coalesce(p_headline,headline),
    description=coalesce(p_description,description),email=coalesce(p_email,email),
    company=coalesce(p_company,company),domain=coalesce(p_domain,domain),updated_at=now() where id=1;
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'settings.updated','global');
end; $$;

create or replace function public.admin_update_content(p_headline text,p_description text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  update public.site_settings set headline=p_headline,description=p_description,updated_at=now() where id=1;
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'content.updated','homepage');
end; $$;

create or replace function public.admin_update_advanced_settings(p_maintenance_mode boolean,p_permissions jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_staff(array['owner']);
  if jsonb_typeof(p_permissions)<>'object' then raise exception 'Invalid permissions.'; end if;
  update public.site_settings set maintenance_mode=p_maintenance_mode,permissions=p_permissions,updated_at=now() where id=1;
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'settings.advanced_updated','global');
end; $$;

create or replace function public.admin_list_products()
returns json language plpgsql security definer set search_path='' as $$
declare v_items json; v_categories json;
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  select coalesce(json_agg(json_build_object(
    'id',p.id,'slug',p.slug,'name',p.name,'categoryId',p.category_id,
    'category',case when c.id is null then null else json_build_object('id',c.id,'slug',c.slug,'name',c.name) end,
    'tagline',p.tagline,'description',p.description,'price',p.price_label,'status',p.status,
    'logoUrl',p.logo_url,'features',p.features,'version',p.version,'requirements',p.requirements,
    'releaseStatus',p.release_status,'workflowHeading',p.workflow_heading,
    'workflowDescription',p.workflow_description,'workflowMediaUrl',p.workflow_media_url,
    'workflowNote',p.workflow_note,'updatedAt',p.created_at
  ) order by p.created_at), '[]'::json) into v_items
  from public.products p left join public.categories c on c.id=p.category_id;
  select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'createdAt',created_at) order by created_at),'[]'::json)
    into v_categories from public.categories;
  return json_build_object('items',v_items,'categories',v_categories);
end; $$;

create or replace function public.admin_upsert_product(
  p_id uuid,p_slug text,p_name text,p_category_id uuid,p_tagline text,p_description text,
  p_price_label text,p_status text,p_logo_url text,p_features text[],p_version text,
  p_requirements text,p_release_status text,p_workflow_heading text,
  p_workflow_description text,p_workflow_media_url text,p_workflow_note text
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  if p_status not in ('draft','published','archived') or p_release_status not in ('development','prelaunch','live') then raise exception 'Invalid product status.'; end if;
  insert into public.products(id,slug,name,category_id,tagline,description,price_label,status,logo_url,features,version,requirements,release_status,workflow_heading,workflow_description,workflow_media_url,workflow_note)
  values(coalesce(p_id,gen_random_uuid()),p_slug,p_name,p_category_id,p_tagline,p_description,p_price_label,p_status,p_logo_url,coalesce(p_features,'{}'),p_version,p_requirements,p_release_status,p_workflow_heading,p_workflow_description,p_workflow_media_url,p_workflow_note)
  on conflict(id) do update set slug=excluded.slug,name=excluded.name,category_id=excluded.category_id,
    tagline=excluded.tagline,description=excluded.description,price_label=excluded.price_label,status=excluded.status,
    logo_url=excluded.logo_url,features=excluded.features,version=excluded.version,requirements=excluded.requirements,
    release_status=excluded.release_status,workflow_heading=excluded.workflow_heading,
    workflow_description=excluded.workflow_description,workflow_media_url=excluded.workflow_media_url,
    workflow_note=excluded.workflow_note,revision=public.products.revision+1;
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'product.saved',p_slug);
end; $$;

create or replace function public.admin_list_customers()
returns json language plpgsql security definer set search_path='' as $$
declare v_items json;
begin
  perform private.require_staff(array['owner','administrator','support']);
  select coalesce(json_agg(row_to_json(x)),'[]'::json) into v_items from (
    select p.id,u.email,p.display_name as name,p.suspended,
      case when p.suspended then 'suspended' else 'active' end as status,p.created_at as "createdAt",
      (select count(*) from public.orders o where o.user_id=p.id and o.status='paid') as "orderCount",
      (select count(*) from public.licenses l where l.user_id=p.id and l.status='active') as "activeLicenses"
    from public.profiles p join auth.users u on u.id=p.id
    where not exists(select 1 from public.staff_memberships s where s.user_id=p.id)
    order by p.created_at desc
  ) x;
  return json_build_object('items',v_items);
end; $$;

create or replace function public.admin_list_orders()
returns json language plpgsql security definer set search_path='' as $$
declare v_items json;
begin
  perform private.require_staff(array['owner','administrator','support']);
  select coalesce(json_agg(row_to_json(x)),'[]'::json) into v_items from (
    select o.id,p.name as product,coalesce(pr.display_name,u.email) as customer,u.email,
      o.amount_minor,o.currency,(o.currency||' '||to_char(o.amount_minor/100.0,'FM999999990.00')) as amount,
      o.status,o.provider_order_id as "providerOrderId",o.provider_payment_id as "providerPaymentId",o.created_at as "createdAt"
    from public.orders o join public.products p on p.id=o.product_id join auth.users u on u.id=o.user_id
    left join public.profiles pr on pr.id=o.user_id order by o.created_at desc
  ) x;
  return json_build_object('items',v_items);
end; $$;

create or replace function public.admin_list_licenses()
returns json language plpgsql security definer set search_path='' as $$
declare v_items json;
begin
  perform private.require_staff(array['owner','administrator','support']);
  select coalesce(json_agg(row_to_json(x)),'[]'::json) into v_items from (
    select l.id,p.name as product,coalesce(pr.display_name,u.email) as customer,u.email,l.status,
      l.key_suffix as suffix,exists(select 1 from public.devices d where d.license_id=l.id and d.active) as device,
      l.created_at as "createdAt" from public.licenses l join public.products p on p.id=l.product_id
    join auth.users u on u.id=l.user_id left join public.profiles pr on pr.id=l.user_id order by l.created_at desc
  ) x;
  return json_build_object('items',v_items);
end; $$;

create or replace function public.admin_list_activity()
returns json language plpgsql security definer set search_path='' as $$
declare v_items json; v_emails json;
begin
  perform private.require_staff(array['owner','administrator','support']);
  select coalesce(json_agg(row_to_json(x)),'[]'::json) into v_items from (
    select a.id,coalesce(p.display_name,u.email,'System') as actor,a.action,a.target_id as target,a.reason,a.created_at as "createdAt"
    from private.audit_log a left join public.profiles p on p.id=a.actor_id left join auth.users u on u.id=a.actor_id
    order by a.created_at desc limit 500
  ) x;
  select coalesce(json_agg(row_to_json(x)),'[]'::json) into v_emails from (
    select id,kind,record_id as "orderId",case when completed_at is not null then 'completed' when attempts>=5 then 'dead-letter' when attempts>0 then 'retrying' else 'pending' end as status,due_at as "createdAt"
    from private.outbox order by due_at desc limit 200
  ) x;
  return json_build_object('items',v_items,'emails',v_emails);
end; $$;

create or replace function public.admin_analytics()
returns json language plpgsql security definer set search_path='' as $$
declare v_revenue bigint; v_sales bigint; v_licenses bigint; v_customers bigint; v_activity json;
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  select coalesce(sum(amount_minor),0),count(*) into v_revenue,v_sales from public.orders where status='paid' and created_at>=now()-interval '30 days';
  select count(*) into v_licenses from public.licenses where status='active';
  select count(*) into v_customers from public.profiles p where not exists(select 1 from public.staff_memberships s where s.user_id=p.id);
  select coalesce(json_agg(row_to_json(x)),'[]'::json) into v_activity from (
    select id,action,target_id as target,created_at as "createdAt" from private.audit_log order by created_at desc limit 20
  ) x;
  return json_build_object('items',v_activity,'metrics',json_build_object('revenue',v_revenue/100.0,'activeLicenses',v_licenses,'recentSales',v_sales,'totalCustomers',v_customers));
end; $$;

create or replace function public.list_team()
returns json language plpgsql security definer set search_path='' as $$
declare v_items json; v_invites json;
begin
  perform private.require_staff(array['owner','administrator']);
  select coalesce(json_agg(json_build_object('id',s.user_id,'email',u.email,'name',coalesce(p.display_name,''),'role',s.role,'active',s.active,'status',case when s.active then 'active' else 'suspended' end) order by s.created_at),'[]'::json)
    into v_items from public.staff_memberships s join auth.users u on u.id=s.user_id left join public.profiles p on p.id=s.user_id;
  select coalesce(json_agg(json_build_object('id',id,'email',email,'role',role,'status',status,'createdAt',created_at) order by created_at desc),'[]'::json)
    into v_invites from public.staff_invitations where status='pending';
  return json_build_object('items',v_items,'invitations',v_invites);
end; $$;

create or replace function public.admin_toggle_staff_status(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
  perform private.require_staff(array['owner']);
  if p_user_id=auth.uid() then raise exception 'You cannot suspend your own account.'; end if;
  select role into v_role from public.staff_memberships where user_id=p_user_id;
  if v_role is null or v_role='owner' then raise exception 'This membership cannot be changed.'; end if;
  update public.staff_memberships set active=not active where user_id=p_user_id;
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'staff.status_toggled',p_user_id::text);
end; $$;

create or replace function public.admin_resend_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_staff(array['owner']);
  if not exists(select 1 from public.staff_invitations where id=p_invitation_id and status='pending') then raise exception 'Pending invitation not found.'; end if;
  insert into private.outbox(kind,record_id,idempotency_key) values('staff_invite',p_invitation_id,'invite_'||p_invitation_id||'_'||extract(epoch from clock_timestamp())::bigint);
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'invitation.resent',p_invitation_id::text);
end; $$;

create or replace function public.create_checkout_order(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_price record; v_order_id uuid;
begin
  if not private.account_allowed() then raise exception 'Access denied.'; end if;
  if exists(select 1 from public.site_settings where id=1 and maintenance_mode) then raise exception 'Store is temporarily closed.'; end if;
  select pr.id,pr.amount_minor,pr.currency,p.name into v_price from public.prices pr join public.products p on p.id=pr.product_id
    where pr.product_id=p_product_id and pr.active and p.status='published' and p.release_status='live' order by pr.id limit 1;
  if not found then raise exception 'Product is not available for purchase.'; end if;
  select id into v_order_id from public.orders where user_id=auth.uid() and product_id=p_product_id and status='pending' and created_at>now()-interval '15 minutes' order by created_at desc limit 1;
  if v_order_id is null then
    insert into public.orders(user_id,product_id,price_id,amount_minor,currency,status,idempotency_key)
    values(auth.uid(),p_product_id,v_price.id,v_price.amount_minor,v_price.currency,'pending','checkout_'||gen_random_uuid()) returning id into v_order_id;
  end if;
  return jsonb_build_object('order_id',v_order_id,'amount',v_price.amount_minor,'currency',v_price.currency,'name',v_price.name);
end; $$;

create or replace function public.attach_checkout_provider_order(p_order_id uuid,p_provider_order_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.account_allowed() then raise exception 'Access denied.'; end if;
  update public.orders set provider_order_id=p_provider_order_id where id=p_order_id and user_id=auth.uid() and status='pending' and provider_order_id is null;
  if not found then raise exception 'Pending order not found.'; end if;
end; $$;

create or replace function public.record_webhook_event(p_provider_event_id text,p_payload jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Unauthorized.'; end if;
  insert into private.webhook_events(provider_event_id,payload) values(p_provider_event_id,p_payload) on conflict do nothing;
  return found;
end; $$;

create or replace function public.process_payment_webhook(p_order_id uuid,p_payment_id text,p_encryption_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order record; v_license_id uuid; v_raw_key text; v_key_hash text;
begin
  if auth.role()<>'service_role' then raise exception 'Unauthorized.'; end if;
  if p_encryption_secret is null or length(p_encryption_secret)<32 then raise exception 'Encryption key is not configured.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status='paid' then return jsonb_build_object('ok',true,'message','Already processed'); end if;
  if v_order.status<>'pending' then raise exception 'Order cannot be paid from its current state.'; end if;
  v_raw_key:='NORVI-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),1,4))||'-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),5,4))||'-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),9,4))||'-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),13,4));
  v_key_hash:=encode(extensions.digest(v_raw_key,'sha256'),'hex');
  update public.orders set status='paid',provider_payment_id=p_payment_id where id=p_order_id;
  insert into public.licenses(user_id,product_id,order_id,status,key_suffix,max_devices) values(v_order.user_id,v_order.product_id,v_order.id,'active',right(v_raw_key,4),3) returning id into v_license_id;
  insert into private.license_secrets(license_id,key_hash,encrypted_key,encryption_key_version) values(v_license_id,v_key_hash,extensions.pgp_sym_encrypt(v_raw_key,p_encryption_secret),1);
  insert into private.outbox(kind,record_id,idempotency_key) values('order_receipt',p_order_id,'receipt_'||p_order_id) on conflict(idempotency_key) do nothing;
  return jsonb_build_object('ok',true,'license_id',v_license_id);
end; $$;

create or replace function public.reveal_license_key(p_license_id uuid,p_encryption_secret text)
returns text language plpgsql security definer set search_path='' as $$
declare v_secret text; v_role text;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;
  select role into v_role from public.staff_memberships where user_id=auth.uid() and active=true;
  if not exists(select 1 from public.licenses where id=p_license_id and user_id=auth.uid() and status='active') then
    if coalesce(v_role,'')<>'owner' or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Permission denied.'; end if;
  end if;
  select encrypted_key into v_secret from private.license_secrets where license_id=p_license_id;
  if v_secret is null then raise exception 'Key material missing.'; end if;
  return extensions.pgp_sym_decrypt(v_secret::bytea,p_encryption_secret);
end; $$;

create or replace function public.admin_rotate_license_key(p_license_id uuid,p_reason text,p_encryption_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_raw_key text; v_version integer;
begin
  perform private.require_staff(array['owner','administrator']);
  v_raw_key:='NORVI-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),1,4))||'-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),5,4))||'-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),9,4))||'-'||upper(substr(encode(extensions.gen_random_bytes(12),'hex'),13,4));
  update public.licenses set key_suffix=right(v_raw_key,4),key_version=key_version+1,status='active' where id=p_license_id returning key_version into v_version;
  if v_version is null then raise exception 'License not found.'; end if;
  update private.license_secrets set key_hash=encode(extensions.digest(v_raw_key,'sha256'),'hex'),encrypted_key=extensions.pgp_sym_encrypt(v_raw_key,p_encryption_secret),encryption_key_version=v_version where license_id=p_license_id;
  delete from public.devices where license_id=p_license_id;
  insert into private.audit_log(actor_id,action,target_id,reason) values(auth.uid(),'license.rotated',p_license_id::text,p_reason);
  return jsonb_build_object('ok',true,'version',v_version);
end; $$;

-- Explicitly expose only the RPCs required by the browser or service worker.
revoke all on function public.admin_update_content(text,text),public.admin_update_advanced_settings(boolean,jsonb),
 public.admin_list_customers(),public.admin_list_orders(),public.admin_list_licenses(),public.admin_list_activity(),
 public.admin_analytics(),public.admin_toggle_staff_status(uuid),public.admin_resend_invitation(uuid),
 public.create_checkout_order(uuid),public.attach_checkout_provider_order(uuid,text),
 public.reveal_license_key(uuid,text),public.admin_rotate_license_key(uuid,text,text) from public,anon;
grant execute on function public.admin_update_content(text,text),public.admin_update_advanced_settings(boolean,jsonb),
 public.admin_list_customers(),public.admin_list_orders(),public.admin_list_licenses(),public.admin_list_activity(),
 public.admin_analytics(),public.admin_toggle_staff_status(uuid),public.admin_resend_invitation(uuid),
 public.create_checkout_order(uuid),public.attach_checkout_provider_order(uuid,text),
 public.reveal_license_key(uuid,text),public.admin_rotate_license_key(uuid,text,text) to authenticated;
revoke all on function public.record_webhook_event(text,jsonb),public.process_payment_webhook(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_webhook_event(text,jsonb),public.process_payment_webhook(uuid,text,text) to service_role;

notify pgrst,'reload schema';
commit;
