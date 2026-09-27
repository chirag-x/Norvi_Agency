CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_order_id uuid,
  p_payment_id text,
  p_encryption_secret text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_order record;
  v_license_id uuid;
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
  v_expires_at timestamptz;
  v_interval interval;
BEGIN
  IF auth.role() != 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_encryption_secret IS NULL OR length(p_encryption_secret) < 8 THEN RAISE EXCEPTION 'Encryption key is not configured.'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;
  IF v_order.status = 'paid' THEN RETURN jsonb_build_object('ok', true, 'message', 'Already processed'); END IF;
  IF v_order.status <> 'pending' THEN RAISE EXCEPTION 'Order cannot be paid from its current state.'; END IF;

  UPDATE public.orders SET status = 'paid', provider_payment_id = p_payment_id WHERE id = p_order_id;

  IF v_order.duration = '1_month' THEN v_interval := interval '1 month';
  ELSIF v_order.duration = '3_months' THEN v_interval := interval '3 months';
  ELSE v_interval := NULL; END IF;

  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' || upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' || upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' || upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' || upper(substring(md5(random()::text) FROM 1 FOR 4));
  v_key_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  -- FIXED: Changed v_order_id to p_order_id
  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at)
  VALUES (v_license_id, v_order.user_id, v_order.product_id, p_order_id, 'active', right(v_raw_key, 4), 3, CASE WHEN v_interval IS NOT NULL THEN now() + v_interval ELSE NULL END);

  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version) VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);
  INSERT INTO private.outbox (kind, record_id, idempotency_key) VALUES ('order_receipt', p_order_id, 'receipt_' || p_order_id) ON CONFLICT DO NOTHING;

  -- Affiliate Commission logic (15%)
  IF v_order.affiliate_id IS NOT NULL THEN
    INSERT INTO public.affiliate_commissions (affiliate_id, order_id, amount_minor)
    VALUES (v_order.affiliate_id, v_order.id, (v_order.amount_minor * 0.15)::bigint);
  END IF;

  RETURN jsonb_build_object('ok', true, 'license_id', v_license_id);
END;
$$;
