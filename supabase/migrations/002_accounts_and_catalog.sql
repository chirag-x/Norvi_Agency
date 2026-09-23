-- Apply after 001, only to a dedicated NORVI project.
begin;
create policy own_membership on public.staff_memberships for select to authenticated using(user_id=(select auth.uid()));
grant select on public.staff_memberships to authenticated;

create function private.account_allowed() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=auth.uid() and not p.suspended and u.email_confirmed_at is not null)
    and not exists(select 1 from public.staff_memberships s where s.user_id=auth.uid() and not s.active)
    and (
      coalesce(auth.jwt()->>'aal','aal1') = 'aal2' or (
        not exists(select 1 from public.staff_memberships s where s.user_id=auth.uid())
        and not exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.status='verified')
      )
    );
$$;
revoke all on function private.account_allowed() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.account_allowed() to authenticated;
-- Restrictive policies also protect direct Data API requests, not only the website API.
create policy orders_account_gate on public.orders as restrictive for select to authenticated using((select private.account_allowed()));
create policy licenses_account_gate on public.licenses as restrictive for select to authenticated using((select private.account_allowed()));
create policy devices_account_gate on public.devices as restrictive for select to authenticated using((select private.account_allowed()));
create policy support_account_gate on public.support_requests as restrictive for select to authenticated using((select private.account_allowed()));

create function public.update_my_profile(new_name text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.account_allowed() then raise exception 'Access denied'; end if;
  if new_name is null or length(trim(new_name)) not between 2 and 80 then raise exception 'Invalid name'; end if;
  update public.profiles set display_name=trim(new_name) where id=auth.uid();
  insert into private.audit_log(actor_id,action,target_id) values(auth.uid(),'profile.updated',auth.uid()::text);
end; $$;
create function public.create_support_request(request_subject text,request_message text) returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
  if not private.account_allowed() then raise exception 'Access denied'; end if;
  if request_subject is null or request_message is null then raise exception 'Invalid request'; end if;
  insert into public.support_requests(user_id,subject,message) values(auth.uid(),trim(request_subject),trim(request_message)) returning id into request_id;
  return request_id;
end; $$;
create function public.list_customers(page_number integer default 0)
returns table(id uuid,name text,email text,role text,status text,"createdAt" timestamptz,"lastLogin" timestamptz,purchases bigint,"licenseCount" bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.account_allowed() or auth.jwt()->>'aal' is distinct from 'aal2' or not exists(
    select 1 from public.staff_memberships s where s.user_id=auth.uid() and s.active and s.role in ('owner','administrator','support')
  ) then raise exception 'Staff permission required'; end if;
  if page_number is null or page_number not between 0 and 100000 then raise exception 'Invalid page'; end if;
  return query select p.id,p.display_name,u.email::text,'customer'::text,
    case when p.suspended then 'suspended' else 'active' end,p.created_at,u.last_sign_in_at,
    (select count(*) from public.orders o where o.user_id=p.id and o.status='paid'),
    (select count(*) from public.licenses l where l.user_id=p.id)
    from public.profiles p join auth.users u on u.id=p.id
    where not exists(select 1 from public.staff_memberships s where s.user_id=p.id)
    order by p.created_at desc,p.id limit 50 offset page_number*50;
end; $$;
revoke all on function public.update_my_profile(text),public.create_support_request(text,text),public.list_customers(integer) from public,anon;
grant execute on function public.update_my_profile(text),public.create_support_request(text,text),public.list_customers(integer) to authenticated;

alter table public.products add column catalog_key text unique,
  add column release_status text not null default 'development' check(release_status in ('development','prelaunch'));
insert into public.products(id,catalog_key,slug,name,category,description,status,release_status) values
('00000000-0000-4000-8000-000000000001','agent-1','omnix','Omnix','Desktop automation','Voice-first desktop agent. In development.','published','development'),
('00000000-0000-4000-8000-000000000002','agent-2','voro','Voro','Interview assistance','Screen/audio context and résumé-aware assistance for practice and permitted use. Release verification pending.','published','prelaunch'),
('00000000-0000-4000-8000-000000000003','agent-3','rolvio','Rolvio','Job-search automation','Job discovery, résumé-fit scoring, application workflow, and response tracking. Release verification pending.','published','prelaunch');
-- No active prices or commercial entitlements are created in phases 1–2.
commit;
