-- 060_multi_duration_coupons.sql
-- Allow coupons to target multiple durations (e.g. '1_month,3_months') and support auto-matching on checkout

CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_product_id uuid, p_duration text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE 
  v_coupon record; 
  v_affiliate_id uuid;
  v_allowed_durations text[];
  v_duration_match boolean;
BEGIN
  -- Try Coupon
  SELECT * INTO v_coupon FROM public.coupons 
  WHERE upper(code) = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
    AND (product_id IS NULL OR product_id = p_product_id);
    
  IF FOUND THEN
    -- Determine allowed durations
    IF v_coupon.duration_type IS NULL OR v_coupon.duration_type = 'all' OR trim(v_coupon.duration_type) = '' THEN
      v_duration_match := true;
      v_allowed_durations := ARRAY['1_month', '3_months', 'lifetime'];
    ELSE
      v_allowed_durations := string_to_array(v_coupon.duration_type, ',');
      v_duration_match := (p_duration = ANY(v_allowed_durations));
    END IF;

    IF v_duration_match THEN
      RETURN json_build_object(
        'valid', true,
        'type', 'coupon', 
        'discount', v_coupon.discount_percentage,
        'allowed_durations', v_allowed_durations
      );
    ELSE
      RETURN json_build_object(
        'valid', false,
        'type', 'coupon',
        'reason', 'duration_mismatch',
        'discount', v_coupon.discount_percentage,
        'allowed_durations', v_allowed_durations
      );
    END IF;
  END IF;

  -- Try Affiliate
  SELECT id INTO v_affiliate_id FROM public.affiliates 
  WHERE upper(referral_code) = upper(trim(p_code)) AND user_id != auth.uid();
  IF FOUND THEN
    RETURN json_build_object('valid', true, 'type', 'referral', 'discount', 10, 'allowed_durations', ARRAY['1_month', '3_months', 'lifetime']);
  END IF;

  RETURN json_build_object('valid', false, 'reason', 'not_found');
END;
$$;
REVOKE ALL ON FUNCTION public.validate_promo_code(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, uuid, text) TO anon, authenticated;

-- Update create_checkout_order to support multi-durations
CREATE OR REPLACE FUNCTION public.create_checkout_order(
    p_product_id uuid,
    p_duration text DEFAULT 'lifetime',
    p_renewal_for_license_id uuid DEFAULT NULL,
    p_referral_code text DEFAULT NULL
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
  v_affiliate_id uuid;
  v_settings record;
  v_coupon record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or unavailable.'; END IF;

  IF p_duration = '1_month' THEN v_amount := coalesce(v_product.price_1m, 0);
  ELSIF p_duration = '3_months' THEN v_amount := coalesce(v_product.price_3m, 0);
  ELSIF p_duration = 'lifetime' THEN v_amount := coalesce(v_product.price_lifetime, 0);
  ELSE RAISE EXCEPTION 'Invalid duration. Must be 1_month, 3_months, or lifetime.'; END IF;

  IF p_renewal_for_license_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE id = p_renewal_for_license_id AND user_id = v_user_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'License to renew not found or does not belong to you.';
    END IF;
  END IF;

  -- 1. Apply Flash Sale Discount (if active)
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1;
  IF v_settings.sale_active AND v_settings.sale_percentage > 0 AND v_product.is_on_sale THEN
    v_amount := v_amount * (1.0 - (v_settings.sale_percentage::numeric / 100.0));
  END IF;

  -- 2. Apply Referral Code OR Coupon Code
  v_affiliate_id := NULL;
  IF p_referral_code IS NOT NULL AND trim(p_referral_code) != '' THEN
    -- Try Coupon first
    SELECT * INTO v_coupon FROM public.coupons 
    WHERE upper(code) = upper(trim(p_referral_code))
      AND (expires_at IS NULL OR expires_at > now())
      AND (product_id IS NULL OR product_id = p_product_id)
      AND (
        duration_type IS NULL 
        OR duration_type = 'all' 
        OR trim(duration_type) = ''
        OR p_duration = ANY(string_to_array(duration_type, ','))
      );
      
    IF FOUND THEN
      v_amount := v_amount * (1.0 - (v_coupon.discount_percentage::numeric / 100.0));
    ELSE
      -- Try Affiliate
      SELECT id INTO v_affiliate_id FROM public.affiliates 
      WHERE upper(referral_code) = upper(trim(p_referral_code)) 
      AND user_id != v_user_id;

      IF FOUND THEN
        v_amount := v_amount * 0.90;
      END IF;
    END IF;
  END IF;

  -- Ensure amount doesn't go below 0 due to floating point
  IF v_amount < 0 THEN v_amount := 0; END IF;

  v_currency := 'INR';
  v_order_id := gen_random_uuid();

  INSERT INTO public.orders (id, user_id, product_id, amount_minor, currency, status, duration, renewal_for_license_id, idempotency_key, affiliate_id)
  VALUES (v_order_id, v_user_id, p_product_id, (v_amount * 100)::bigint, v_currency, 'pending', p_duration, p_renewal_for_license_id, 'checkout_' || gen_random_uuid(), v_affiliate_id);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'amount', (v_amount * 100)::bigint, 'currency', v_currency, 'name', v_product.name);
END;
$$;
REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) TO authenticated;
