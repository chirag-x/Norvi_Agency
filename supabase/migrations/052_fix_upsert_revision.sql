-- 052_fix_upsert_revision.sql
-- Replaces updated_at=now() with revision=public.products.revision+1

CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category_id uuid, p_tagline text, p_description text,
  p_price_label text, p_status text, p_logo_url text, p_features text[], p_version text,
  p_requirements text, p_release_status text, p_workflow_heading text,
  p_workflow_description text, p_workflow_media_url text, p_workflow_note text,
  p_price_1m numeric DEFAULT 0, p_price_3m numeric DEFAULT 0, p_price_lifetime numeric DEFAULT 999,
  p_ai_usage text DEFAULT NULL, p_device_allowance text DEFAULT NULL
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
    price_1m, price_3m, price_lifetime, ai_usage, device_allowance
  )
  VALUES (
    v_product_id, p_slug, p_name, p_category_id, p_tagline, p_description, p_price_label, p_status, 
    p_logo_url, coalesce(p_features, '{}'), p_version, p_requirements, p_release_status, 
    p_workflow_heading, p_workflow_description, p_workflow_media_url, p_workflow_note,
    p_price_1m, p_price_3m, p_price_lifetime, p_ai_usage, p_device_allowance
  )
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug, name = EXCLUDED.name, category_id = EXCLUDED.category_id,
    tagline = EXCLUDED.tagline, description = EXCLUDED.description, price_label = EXCLUDED.price_label,
    status = EXCLUDED.status, logo_url = EXCLUDED.logo_url, features = EXCLUDED.features,
    version = EXCLUDED.version, requirements = EXCLUDED.requirements, release_status = EXCLUDED.release_status,
    workflow_heading = EXCLUDED.workflow_heading, workflow_description = EXCLUDED.workflow_description,
    workflow_media_url = EXCLUDED.workflow_media_url, workflow_note = EXCLUDED.workflow_note,
    price_1m = EXCLUDED.price_1m, price_3m = EXCLUDED.price_3m, price_lifetime = EXCLUDED.price_lifetime,
    ai_usage = EXCLUDED.ai_usage, device_allowance = EXCLUDED.device_allowance,
    revision = public.products.revision + 1;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'product.saved', p_slug);
END;
$$;
