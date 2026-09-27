-- Migration 033: Prepaid Renewable Licenses

-- 1. Add pricing tiers to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS price_1m numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_3m numeric(10,2) DEFAULT 0;

-- 2. Add duration and renewal tracking to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS duration text DEFAULT 'lifetime',
ADD COLUMN IF NOT EXISTS renewal_for_license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL;

-- 3. Replace create_checkout_order to support pricing tiers
DROP FUNCTION IF EXISTS public.create_checkout_order(uuid);
CREATE OR REPLACE FUNCTION public.create_checkout_order(
    p_product_id uuid,
    p_duration text DEFAULT 'lifetime',
    p_renewal_for_license_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_product record;
  v_user_id uuid;
  v_order_id uuid;
  v_amount numeric(10,2);
  v_currency text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or unavailable.';
  END IF;

  -- Determine price based on duration
  IF p_duration = '1_month' THEN
    v_amount := v_product.price_1m;
  ELSIF p_duration = '3_months' THEN
    v_amount := v_product.price_3m;
  ELSIF p_duration = 'lifetime' THEN
    v_amount := v_product.price;
  ELSE
    RAISE EXCEPTION 'Invalid duration. Must be 1_month, 3_months, or lifetime.';
  END IF;

  -- Verify the renewal license exists and belongs to the user if provided
  IF p_renewal_for_license_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE id = p_renewal_for_license_id AND user_id = v_user_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'License to renew not found or does not belong to you.';
    END IF;
  END IF;

  v_currency := 'INR';
  v_order_id := gen_random_uuid();

  INSERT INTO public.orders (id, user_id, product_id, amount, currency, status, duration, renewal_for_license_id)
  VALUES (v_order_id, v_user_id, p_product_id, v_amount, v_currency, 'pending', p_duration, p_renewal_for_license_id);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'amount', v_amount * 100, 'currency', v_currency);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, uuid) TO authenticated;

-- 4. Replace process_payment_webhook to handle renewals and expiration setting
CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_order_id uuid,
  p_payment_id text,
  p_encryption_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_order record;
  v_license_id uuid;
  v_raw_key text;
  v_key_hash text;
  v_encrypted_key text;
  v_expires_at timestamptz;
  v_current_expires_at timestamptz;
  v_interval interval;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

  -- Determine the time interval to add
  IF v_order.duration = '1_month' THEN
    v_interval := interval '1 month';
  ELSIF v_order.duration = '3_months' THEN
    v_interval := interval '3 months';
  ELSE
    v_interval := NULL; -- lifetime
  END IF;

  -- Check if this is a RENEWAL
  IF v_order.renewal_for_license_id IS NOT NULL THEN
    v_license_id := v_order.renewal_for_license_id;
    
    SELECT expires_at INTO v_current_expires_at FROM public.licenses WHERE id = v_license_id FOR UPDATE;
    
    -- If it's already expired, start from NOW(). If it still has time, add to the existing time.
    IF v_current_expires_at IS NULL THEN
        -- It was a lifetime key being renewed? Shouldn't happen, but just in case.
        v_expires_at := NULL;
    ELSIF v_current_expires_at < now() THEN
        v_expires_at := now() + v_interval;
    ELSE
        v_expires_at := v_current_expires_at + v_interval;
    END IF;

    UPDATE public.licenses 
    SET status = 'active', expires_at = v_expires_at
    WHERE id = v_license_id;
    
    INSERT INTO private.outbox (kind, record_id, idempotency_key)
    VALUES ('license.created', v_license_id, 'license.renewed_' || v_license_id::text || '_' || v_order.id::text);

    RETURN jsonb_build_object('ok', true, 'license_id', v_license_id, 'renewed', true);

  ELSE
    -- NEW LICENSE GENERATION
    v_license_id := gen_random_uuid();
    v_raw_key := 'NORVI-' || 
                 upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
                 upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
                 upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
                 upper(substring(md5(random()::text) FROM 1 FOR 4));
                 
    v_key_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
    v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);
    
    IF v_interval IS NOT NULL THEN
        v_expires_at := now() + v_interval;
    END IF;
    
    INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at)
    VALUES (v_license_id, v_order.user_id, v_order.product_id, p_order_id, 'active', right(v_raw_key, 4), 3, v_expires_at);

    INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
    VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

    INSERT INTO private.outbox (kind, record_id, idempotency_key)
    VALUES ('license.created', v_license_id, 'license.created_' || v_license_id::text);

    RETURN jsonb_build_object('ok', true, 'license_id', v_license_id, 'renewed', false);
  END IF;

END;
$$;

REVOKE ALL ON FUNCTION public.process_payment_webhook(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
