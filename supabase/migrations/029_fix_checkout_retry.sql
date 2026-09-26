-- Migration 029: Fix checkout retry bug

CREATE OR REPLACE FUNCTION public.create_checkout_order(p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE 
  v_price record; 
  v_order_id uuid;
BEGIN
  IF NOT private.account_allowed() THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF EXISTS (SELECT 1 FROM public.site_settings WHERE id=1 AND maintenance_mode) THEN RAISE EXCEPTION 'Store is temporarily closed.'; END IF;
  
  SELECT pr.id, pr.amount_minor, pr.currency, p.name INTO v_price 
  FROM public.prices pr JOIN public.products p ON p.id = pr.product_id
  WHERE pr.product_id = p_product_id AND pr.active AND p.status = 'published' AND p.release_status = 'live' 
  ORDER BY pr.id LIMIT 1;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Product is not available for purchase.'; END IF;
  
  -- The Fix: Only reuse pending orders that haven't been attached to a payment provider yet
  SELECT id INTO v_order_id FROM public.orders 
  WHERE user_id = auth.uid() AND product_id = p_product_id AND status = 'pending' AND provider_order_id IS NULL AND created_at > now() - interval '15 minutes' 
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_order_id IS NULL THEN
    INSERT INTO public.orders(user_id, product_id, price_id, amount_minor, currency, status, idempotency_key)
    VALUES(auth.uid(), p_product_id, v_price.id, v_price.amount_minor, v_price.currency, 'pending', 'checkout_' || gen_random_uuid()) 
    RETURNING id INTO v_order_id;
  END IF;
  
  RETURN jsonb_build_object('order_id', v_order_id, 'amount', v_price.amount_minor, 'currency', v_price.currency, 'name', v_price.name);
END; 
$$;

NOTIFY pgrst, 'reload schema';
