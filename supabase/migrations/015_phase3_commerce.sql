-- Phase 3 Commerce Foundation

begin;

-- 1. Insert prices for the default products
insert into public.prices (product_id, amount_minor, currency, billing_type, active) values
('00000000-0000-4000-8000-000000000001', 990000, 'INR', 'one_time', true), -- 9,900 INR
('00000000-0000-4000-8000-000000000002', 490000, 'INR', 'one_time', true), -- 4,900 INR
('00000000-0000-4000-8000-000000000003', 290000, 'INR', 'one_time', true)  -- 2,900 INR
on conflict do nothing;

-- 2. Create the webhook processing RPC
create or replace function public.process_payment_webhook(p_order_id uuid, p_payment_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_license_id uuid;
  v_key_suffix text;
  v_encrypted_key text;
begin
  -- Only the secure service_role backend can call this function after verifying the webhook signature.
  if auth.role() != 'service_role' then
    raise exception 'Unauthorized';
  end if;

  -- Lock the order to prevent race conditions during concurrent webhook deliveries
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  -- Idempotency check: if already paid, just return success
  if v_order.status = 'paid' then
    return jsonb_build_object('ok', true, 'message', 'Already processed');
  end if;

  -- Mark order as paid
  update public.orders 
  set status = 'paid', provider_payment_id = p_payment_id 
  where id = p_order_id;

  -- Generate a License
  -- A real license would use a cryptographically secure key generator in the backend,
  -- but we can generate the initial record here, and the backend can update the secret later if needed.
  -- For now, we will create a placeholder license record.
  v_license_id := gen_random_uuid();
  v_key_suffix := upper(substring(md5(random()::text) from 1 for 8));
  
  insert into public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices)
  values (v_license_id, v_order.user_id, v_order.product_id, p_order_id, 'active', v_key_suffix, 3);

  -- Put a receipt generation task in the outbox
  insert into private.outbox (kind, record_id, idempotency_key)
  values ('order_receipt', p_order_id, 'receipt_' || p_order_id);

  return jsonb_build_object('ok', true, 'license_id', v_license_id);
end;
$$;

-- Grant execution to service_role ONLY
revoke all on function public.process_payment_webhook(uuid, text) from public, anon, authenticated;
grant execute on function public.process_payment_webhook(uuid, text) to service_role;

commit;
