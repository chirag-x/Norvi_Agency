-- Migration 027: Ensure products always have a price
-- This fixes the "null value in column price_id" bug when gifting or purchasing newly created products.

CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category_id uuid, p_tagline text, p_description text,
  p_price_label text, p_status text, p_logo_url text, p_features text[], p_version text,
  p_requirements text, p_release_status text, p_workflow_heading text,
  p_workflow_description text, p_workflow_media_url text, p_workflow_note text
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
    workflow_heading, workflow_description, workflow_media_url, workflow_note
  )
  VALUES (
    v_product_id, p_slug, p_name, p_category_id, p_tagline, p_description, p_price_label, p_status, 
    p_logo_url, coalesce(p_features, '{}'), p_version, p_requirements, p_release_status, 
    p_workflow_heading, p_workflow_description, p_workflow_media_url, p_workflow_note
  )
  ON CONFLICT(id) DO UPDATE SET 
    slug=excluded.slug, name=excluded.name, category_id=excluded.category_id,
    tagline=excluded.tagline, description=excluded.description, price_label=excluded.price_label, status=excluded.status,
    logo_url=excluded.logo_url, features=excluded.features, version=excluded.version, requirements=excluded.requirements,
    release_status=excluded.release_status, workflow_heading=excluded.workflow_heading,
    workflow_description=excluded.workflow_description, workflow_media_url=excluded.workflow_media_url,
    workflow_note=excluded.workflow_note, revision=public.products.revision+1;

  -- ENFORCEMENT: Ensure the product has at least one active price in the prices table
  -- Default to 999 INR (99900 paise) if it doesn't exist.
  INSERT INTO public.prices (product_id, amount_minor, currency, billing_type, active)
  VALUES (v_product_id, 99900, 'INR', 'one_time', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'product.saved', p_slug);
END;
$$;

-- Run a backfill to ensure ALL existing products have a price row
INSERT INTO public.prices (product_id, amount_minor, currency, billing_type, active)
SELECT id, 99900, 'INR', 'one_time', true FROM public.products
WHERE id NOT IN (SELECT product_id FROM public.prices)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
