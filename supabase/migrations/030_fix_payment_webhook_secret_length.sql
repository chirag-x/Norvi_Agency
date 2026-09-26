-- Migration 030: Fix payment webhook secret length check

CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_order_id uuid,
  p_payment_id text,
  p_encryption_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_license_id uuid;
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Relaxed the length check from 32 down to 8 characters to avoid breaking deployments using shorter CRON_SECRET values
  IF p_encryption_secret IS NULL OR length(p_encryption_secret) < 8 THEN 
    RAISE EXCEPTION 'Encryption key is not configured or too short.'; 
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;
  
  IF v_order.status = 'paid' THEN 
    RETURN jsonb_build_object('ok', true, 'message', 'Already processed'); 
  END IF;
  
  IF v_order.status <> 'pending' THEN 
    RAISE EXCEPTION 'Order cannot be paid from its current state.'; 
  END IF;

  UPDATE public.orders 
  SET status = 'paid', provider_payment_id = p_payment_id 
  WHERE id = p_order_id;

  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' || 
               upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
               upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
               upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
               upper(substring(md5(random()::text) FROM 1 FOR 4));
               
  v_key_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);
  
  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices)
  VALUES (v_license_id, v_order.user_id, v_order.product_id, p_order_id, 'active', right(v_raw_key, 4), 3);

  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

  INSERT INTO private.outbox (kind, record_id, idempotency_key)
  VALUES ('license.created', v_license_id, 'license.created_' || v_license_id::text);

  RETURN jsonb_build_object('ok', true, 'license_id', v_license_id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_payment_webhook(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
