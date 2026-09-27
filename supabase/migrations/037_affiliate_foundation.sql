-- Migration 037: Affiliate Foundation & Checkout Discount

-- 1. Create Affiliates Table (Stores the unique referral codes for users)
CREATE TABLE IF NOT EXISTS public.affiliates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    referral_code text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on affiliates
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Users can read their own affiliate profile
CREATE POLICY "Users can view own affiliate profile" ON public.affiliates
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Add affiliate tracking to Orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL;

-- 3. RPC to validate referral code from the frontend
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.affiliates 
        WHERE upper(referral_code) = upper(p_code) 
        -- Prevent users from using their own referral code
        AND user_id != auth.uid()
    ) INTO v_exists;
    RETURN v_exists;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated;

-- 4. Update Checkout Order RPC to handle referral codes and apply 10% discount
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or unavailable.';
  END IF;

  IF p_duration = '1_month' THEN
    v_amount := coalesce(v_product.price_1m, 0);
  ELSIF p_duration = '3_months' THEN
    v_amount := coalesce(v_product.price_3m, 0);
  ELSIF p_duration = 'lifetime' THEN
    v_amount := coalesce(v_product.price_lifetime, 0);
  ELSE
    RAISE EXCEPTION 'Invalid duration. Must be 1_month, 3_months, or lifetime.';
  END IF;

  IF p_renewal_for_license_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE id = p_renewal_for_license_id AND user_id = v_user_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'License to renew not found or does not belong to you.';
    END IF;
  END IF;

  -- Handle Referral Code & 10% Discount
  v_affiliate_id := NULL;
  IF p_referral_code IS NOT NULL AND trim(p_referral_code) != '' THEN
    SELECT id INTO v_affiliate_id FROM public.affiliates 
    WHERE upper(referral_code) = upper(trim(p_referral_code)) 
    AND user_id != v_user_id; -- Cannot refer yourself

    IF v_affiliate_id IS NOT NULL THEN
      -- Apply 10% discount
      v_amount := v_amount * 0.90;
    END IF;
  END IF;

  v_currency := 'INR';
  v_order_id := gen_random_uuid();

  INSERT INTO public.orders (id, user_id, product_id, amount_minor, currency, status, duration, renewal_for_license_id, idempotency_key, affiliate_id)
  VALUES (v_order_id, v_user_id, p_product_id, (v_amount * 100)::bigint, v_currency, 'pending', p_duration, p_renewal_for_license_id, 'checkout_' || gen_random_uuid(), v_affiliate_id);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'amount', (v_amount * 100)::bigint, 'currency', v_currency);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
