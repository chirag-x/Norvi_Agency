-- Migration 038: Affiliate Commissions and Payouts

-- 1. Add status to affiliates table
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Create Affiliate Commissions table
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount_minor bigint NOT NULL,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- 3. Create Payout Requests table
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    amount_minor bigint NOT NULL,
    upi_id text NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    paid_at timestamptz
);
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 4. Update validate_referral_code to check status
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.affiliates 
        WHERE upper(referral_code) = upper(p_code) 
        AND user_id != auth.uid()
        AND status = 'active'
    ) INTO v_exists;
    RETURN v_exists;
END;
$$;

-- 5. Update process_payment_webhook to distribute 15% commission
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

  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at)
  VALUES (v_license_id, v_order.user_id, v_order.product_id, v_order_id, 'active', right(v_raw_key, 4), 3, CASE WHEN v_interval IS NOT NULL THEN now() + v_interval ELSE NULL END);

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

-- 6. RPC for joining the partner program
CREATE OR REPLACE FUNCTION public.join_partner_program(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF EXISTS(SELECT 1 FROM public.affiliates WHERE upper(referral_code) = upper(p_code)) THEN
        RAISE EXCEPTION 'Referral code already taken.';
    END IF;
    INSERT INTO public.affiliates (user_id, referral_code) VALUES (auth.uid(), upper(p_code)) RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'affiliate_id', v_id);
END;
$$;

-- 7. RPC for getting partner stats
CREATE OR REPLACE FUNCTION public.get_partner_stats() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE 
  v_affiliate record;
  v_sales int := 0;
  v_total_earned bigint := 0;
  v_total_paid bigint := 0;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    SELECT * INTO v_affiliate FROM public.affiliates WHERE user_id = auth.uid();
    IF NOT FOUND THEN RETURN jsonb_build_object('active', false); END IF;
    
    SELECT count(*), coalesce(sum(amount_minor), 0) INTO v_sales, v_total_earned FROM public.affiliate_commissions WHERE affiliate_id = v_affiliate.id;
    SELECT coalesce(sum(amount_minor), 0) INTO v_total_paid FROM public.payout_requests WHERE affiliate_id = v_affiliate.id;
    
    RETURN jsonb_build_object(
        'active', true,
        'code', v_affiliate.referral_code,
        'status', v_affiliate.status,
        'sales', v_sales,
        'totalEarned', v_total_earned,
        'pendingBalance', v_total_earned - v_total_paid
    );
END;
$$;

-- 8. RPC for requesting a payout
CREATE OR REPLACE FUNCTION public.request_payout(p_upi_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE 
  v_affiliate record;
  v_total_earned bigint;
  v_total_requested bigint;
  v_balance bigint;
BEGIN
    SELECT * INTO v_affiliate FROM public.affiliates WHERE user_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Not an affiliate.'; END IF;
    
    SELECT coalesce(sum(amount_minor), 0) INTO v_total_earned FROM public.affiliate_commissions WHERE affiliate_id = v_affiliate.id;
    SELECT coalesce(sum(amount_minor), 0) INTO v_total_requested FROM public.payout_requests WHERE affiliate_id = v_affiliate.id;
    
    v_balance := v_total_earned - v_total_requested;
    IF v_balance < 200000 THEN -- 2000 INR in minor units
        RAISE EXCEPTION 'Balance is below the minimum threshold of INR 2000.';
    END IF;
    
    INSERT INTO public.payout_requests (affiliate_id, amount_minor, upi_id) VALUES (v_affiliate.id, v_balance, p_upi_id);
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- 9. Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_list_affiliates() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_items json;
BEGIN
    PERFORM private.require_staff(array['owner','administrator']);
    SELECT coalesce(json_agg(json_build_object(
        'id', a.id,
        'userId', a.user_id,
        'name', u.raw_user_meta_data->>'name',
        'email', u.email,
        'code', a.referral_code,
        'status', a.status,
        'createdAt', a.created_at,
        'sales', (SELECT count(*) FROM public.affiliate_commissions c WHERE c.affiliate_id = a.id),
        'totalEarned', coalesce((SELECT sum(amount_minor) FROM public.affiliate_commissions c WHERE c.affiliate_id = a.id), 0)
    ) ORDER BY a.created_at DESC), '[]'::json) INTO v_items
    FROM public.affiliates a
    JOIN auth.users u ON a.user_id = u.id;
    RETURN v_items;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_affiliate_status(p_affiliate_id uuid, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    PERFORM private.require_staff(array['owner','administrator']);
    UPDATE public.affiliates SET status = p_status WHERE id = p_affiliate_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_affiliate(p_affiliate_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    PERFORM private.require_staff(array['owner','administrator']);
    DELETE FROM public.affiliates WHERE id = p_affiliate_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_payouts() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_items json;
BEGIN
    PERFORM private.require_staff(array['owner','administrator']);
    SELECT coalesce(json_agg(json_build_object(
        'id', p.id,
        'affiliateId', p.affiliate_id,
        'name', u.raw_user_meta_data->>'name',
        'code', a.referral_code,
        'amount', p.amount_minor,
        'upi', p.upi_id,
        'status', p.status,
        'createdAt', p.created_at
    ) ORDER BY p.created_at DESC), '[]'::json) INTO v_items
    FROM public.payout_requests p
    JOIN public.affiliates a ON p.affiliate_id = a.id
    JOIN auth.users u ON a.user_id = u.id;
    RETURN v_items;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_payout_paid(p_payout_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    PERFORM private.require_staff(array['owner','administrator']);
    UPDATE public.payout_requests SET status = 'paid', paid_at = now() WHERE id = p_payout_id;
END;
$$;

-- Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.join_partner_program TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_affiliates TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_affiliate_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_affiliate TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_payouts TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_payout_paid TO authenticated;

NOTIFY pgrst, 'reload schema';
