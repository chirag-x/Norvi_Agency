begin;

-- 1. Trigger for Welcome Email on Signup
create or replace function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin 
  insert into public.profiles(id,display_name) values(new.id, left(coalesce(new.raw_user_meta_data->>'name',''),80)) on conflict do nothing; 
  
  -- Queue Welcome Email
  insert into private.outbox (kind, record_id, idempotency_key)
  values ('welcome_email', new.id, 'welcome_' || new.id);

  return new; 
end;
$$;

-- 2. Trigger for Order Receipt when Order becomes Paid
create or replace function private.queue_order_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status = 'paid' and old.status != 'paid' then
    insert into private.outbox (kind, record_id, idempotency_key)
    values ('order_receipt', new.id, 'receipt_' || new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.queue_order_receipt() from public, anon, authenticated;

drop trigger if exists queue_order_receipt_trigger on public.orders;
create trigger queue_order_receipt_trigger after update on public.orders for each row execute function private.queue_order_receipt();

commit;
