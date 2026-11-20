-- 079_homepage_video_reviews.sql
-- Add video_reviews, video_reviews_heading, and video_reviews_subheading to public.site_settings

ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS video_reviews jsonb,
ADD COLUMN IF NOT EXISTS video_reviews_heading text,
ADD COLUMN IF NOT EXISTS video_reviews_subheading text;

CREATE OR REPLACE FUNCTION public.get_site_settings()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_settings record;
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
    'social_twitter', v_settings.social_twitter,
    'video_reviews', v_settings.video_reviews,
    'video_reviews_heading', v_settings.video_reviews_heading,
    'video_reviews_subheading', v_settings.video_reviews_subheading
  );
END;
$$;
