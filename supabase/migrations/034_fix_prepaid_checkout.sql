-- Migration 034: Fix Checkout schema for Prepaid Models

-- 1. Add lifetime price directly to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_lifetime numeric(10,2) DEFAULT 999.00;

-- 2. Make price_id optional in orders since we are using duration-based pricing
ALTER TABLE public.orders ALTER COLUMN price_id DROP NOT NULL;

-- 3. Replace create_checkout_order to fix amount_minor and price logic
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

  v_currency := 'INR';
  v_order_id := gen_random_uuid();

  -- Insert using amount_minor (amount * 100) and dummy idempotency key since Razorpay requires it
  INSERT INTO public.orders (id, user_id, product_id, amount_minor, currency, status, duration, renewal_for_license_id, idempotency_key)
  VALUES (v_order_id, v_user_id, p_product_id, (v_amount * 100)::bigint, v_currency, 'pending', p_duration, p_renewal_for_license_id, 'checkout_' || gen_random_uuid());

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'amount', (v_amount * 100)::bigint, 'currency', v_currency);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, uuid) TO authenticated;

-- Also update admin_upsert_product to allow editing these new prices
CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category_id uuid, p_tagline text, p_description text,
  p_price_label text, p_status text, p_logo_url text, p_features text[], p_version text,
  p_requirements text, p_release_status text, p_workflow_heading text,
  p_workflow_description text, p_workflow_media_url text, p_workflow_note text,
  p_price_1m numeric DEFAULT 0, p_price_3m numeric DEFAULT 0, p_price_lifetime numeric DEFAULT 999
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_product_id uuid;
BEGIN
  PERFORM private.require_staff(array['owner','administrator','product_manager']);
  IF p_status NOT IN ('draft','published','archived') OR p_release_status NOT IN ('development','prelaunch','live') THEN 
    RAISE EXCEPTION 'Invalid product status.'; 
  END IF;

  v_product_id := coalesce(p_id, gen_random_uuid());

  INSERT INTO public.products(
    id, slug, name, category_id, tagline, description, price_label, status, 
    logo_url, features, version, requirements, release_status, 
    workflow_heading, workflow_description, workflow_media_url, workflow_note,
    price_1m, price_3m, price_lifetime
  )
  VALUES (
    v_product_id, p_slug, p_name, p_category_id, p_tagline, p_description, p_price_label, p_status, 
    p_logo_url, coalesce(p_features, '{}'), p_version, p_requirements, p_release_status, 
    p_workflow_heading, p_workflow_description, p_workflow_media_url, p_workflow_note,
    p_price_1m, p_price_3m, p_price_lifetime
  )
  ON CONFLICT(id) DO UPDATE SET 
    slug=excluded.slug, name=excluded.name, category_id=excluded.category_id,
    tagline=excluded.tagline, description=excluded.description, price_label=excluded.price_label, status=excluded.status,
    logo_url=excluded.logo_url, features=excluded.features, version=excluded.version, requirements=excluded.requirements,
    release_status=excluded.release_status, workflow_heading=excluded.workflow_heading,
    workflow_description=excluded.workflow_description, workflow_media_url=excluded.workflow_media_url,
    workflow_note=excluded.workflow_note, revision=public.products.revision+1,
    price_1m=excluded.price_1m, price_3m=excluded.price_3m, price_lifetime=excluded.price_lifetime;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'product.saved', p_slug);
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Also update admin_list_products to return the new fields
CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS json language plpgsql security definer set search_path='' as $$
declare v_items json; v_categories json;
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  select coalesce(json_agg(json_build_object(
    'id',p.id,'slug',p.slug,'name',p.name,'categoryId',p.category_id,
    'category',case when c.id is null then null else json_build_object('id',c.id,'slug',c.slug,'name',c.name) end,
    'tagline',p.tagline,'description',p.description,'price',p.price_label,
    'price1m',p.price_1m,'price3m',p.price_3m,'price_lifetime',p.price_lifetime,
    'status',p.status,
    'logoUrl',p.logo_url,'features',p.features,'version',p.version,'requirements',p.requirements,
    'releaseStatus',p.release_status,'workflowHeading',p.workflow_heading,
    'workflowDescription',p.workflow_description,'workflowMediaUrl',p.workflow_media_url,
    'workflowNote',p.workflow_note,'updatedAt',p.created_at
  ) order by p.created_at), '[]'::json) into v_items
  from public.products p left join public.categories c on c.id=p.category_id;
  select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'createdAt',created_at) order by created_at),'[]'::json)
    into v_categories from public.categories;
  return json_build_object('items',v_items,'categories',v_categories);
end; $$;
