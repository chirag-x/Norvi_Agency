-- 049_product_allowances.sql
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS ai_usage text,
ADD COLUMN IF NOT EXISTS device_allowance text;

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
END;
$$;

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
    'workflowNote',p.workflow_note,'updatedAt',p.created_at,
    'is_on_sale',p.is_on_sale,
    'aiUsage',p.ai_usage, 'deviceAllowance',p.device_allowance
  ) order by p.created_at), '[]'::json) into v_items
  from public.products p left join public.categories c on c.id=p.category_id
  WHERE p.status != 'deleted';
  select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'createdAt',created_at) order by created_at),'[]'::json)
    into v_categories from public.categories;
  return json_build_object('items',v_items,'categories',v_categories);
end;
$$;
