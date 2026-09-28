-- 053_social_links.sql
-- Add dynamic social media links to site_settings

ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS social_instagram text,
ADD COLUMN IF NOT EXISTS social_youtube text,
ADD COLUMN IF NOT EXISTS social_facebook text,
ADD COLUMN IF NOT EXISTS social_twitter text;

CREATE OR REPLACE FUNCTION public.get_site_settings()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_settings record;
  v_sale record;
BEGIN
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1;
  IF v_settings IS NULL THEN RETURN '{}'::json; END IF;

  RETURN json_build_object(
    'name', v_settings.name,
    'company', v_settings.company,
    'domain', v_settings.domain,
    'email', v_settings.email,
    'headline', v_settings.headline,
    'description', v_settings.description,
    'maintenance_mode', v_settings.maintenance_mode,
    'banner_text', v_settings.banner_text,
    'sale_active', v_settings.sale_active,
    'sale_percentage', v_settings.sale_percentage,
    'social_instagram', v_settings.social_instagram,
    'social_youtube', v_settings.social_youtube,
    'social_facebook', v_settings.social_facebook,
    'social_twitter', v_settings.social_twitter
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_settings(
  p_name text, p_company text, p_domain text, p_email text, p_headline text, p_description text,
  p_maintenance_mode boolean DEFAULT NULL, p_banner_text text DEFAULT NULL,
  p_sale_active boolean DEFAULT NULL, p_sale_percentage int DEFAULT NULL, p_sale_product_ids uuid[] DEFAULT '{}',
  p_social_instagram text DEFAULT NULL, p_social_youtube text DEFAULT NULL, p_social_facebook text DEFAULT NULL, p_social_twitter text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.require_staff(array['owner','administrator']);
  UPDATE public.site_settings SET
    name = coalesce(p_name, name),
    company = coalesce(p_company, company),
    domain = coalesce(p_domain, domain),
    email = coalesce(p_email, email),
    headline = coalesce(p_headline, headline),
    description = coalesce(p_description, description),
    maintenance_mode = coalesce(p_maintenance_mode, maintenance_mode),
    banner_text = coalesce(p_banner_text, banner_text),
    sale_active = coalesce(p_sale_active, sale_active),
    sale_percentage = coalesce(p_sale_percentage, sale_percentage),
    social_instagram = coalesce(p_social_instagram, social_instagram),
    social_youtube = coalesce(p_social_youtube, social_youtube),
    social_facebook = coalesce(p_social_facebook, social_facebook),
    social_twitter = coalesce(p_social_twitter, social_twitter),
    updated_at = now()
  WHERE id = 1;

  UPDATE public.products SET is_on_sale = false WHERE is_on_sale = true;

  IF p_sale_active AND array_length(p_sale_product_ids, 1) > 0 THEN
    UPDATE public.products SET is_on_sale = true WHERE id = ANY(p_sale_product_ids);
  END IF;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'settings.updated', '1');
END;
$$;

-- Drop overloaded legacy signatures just in case to avoid conflict
DROP FUNCTION IF EXISTS public.admin_update_settings(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_settings(text, text, text, text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.admin_update_settings(text, text, text, text, text, text, boolean, text, boolean, integer, uuid[]);
