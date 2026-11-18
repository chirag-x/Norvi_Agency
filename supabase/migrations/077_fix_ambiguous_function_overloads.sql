-- ==============================================================================
-- Migration 077: Fix Ambiguous Function Overloads & Schema Cache Resolution
-- 
-- 1. Drops ambiguous 22-arg public.admin_upsert_product overload so PostgREST uniquely
--    resolves the canonical 24-arg function (with p_price_1w DEFAULT NULL).
-- 2. Drops ambiguous 6-arg public.admin_upsert_coupon overload so PostgREST uniquely
--    resolves the canonical 7-arg function (with p_max_uses DEFAULT 50).
-- 3. Re-establishes the canonical 25-arg public.admin_upsert_agent_ai_policy with
--    clean parameter defaults and permission grants.
-- ==============================================================================

-- 1. FIX AMBIGUOUS public.admin_upsert_product
-- Drop the conflicting 22-parameter overload
DROP FUNCTION IF EXISTS public.admin_upsert_product(
  uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb
);

-- Recreate canonical 24-parameter admin_upsert_product with p_price_1w DEFAULT NULL
CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category_id uuid, p_tagline text, p_description text,
  p_price_label text, p_status text, p_logo_url text, p_features text[], p_version text,
  p_requirements text, p_release_status text, p_workflow_heading text,
  p_workflow_description text, p_workflow_media_url text, p_workflow_note text,
  p_price_1m numeric DEFAULT 0, p_price_3m numeric DEFAULT 0, p_price_lifetime numeric DEFAULT 999,
  p_ai_usage text DEFAULT NULL, p_device_allowance text DEFAULT NULL,
  p_extended_content jsonb DEFAULT '{}'::jsonb,
  p_price_1w numeric DEFAULT NULL
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
    price_1m, price_3m, price_lifetime, ai_usage, device_allowance, extended_content, price_1w
  )
  VALUES (
    v_product_id, p_slug, p_name, p_category_id, p_tagline, p_description, p_price_label, p_status, 
    p_logo_url, coalesce(p_features, '{}'), p_version, p_requirements, p_release_status, 
    p_workflow_heading, p_workflow_description, p_workflow_media_url, p_workflow_note,
    p_price_1m, p_price_3m, p_price_lifetime, p_ai_usage, p_device_allowance, coalesce(p_extended_content, '{}'::jsonb), p_price_1w
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
    extended_content = coalesce(EXCLUDED.extended_content, public.products.extended_content, '{}'::jsonb),
    price_1w = EXCLUDED.price_1w,
    revision = public.products.revision + 1;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'product.saved', p_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb, numeric) TO authenticated;


-- 2. FIX AMBIGUOUS public.admin_upsert_coupon
-- Drop the conflicting 6-parameter overload
DROP FUNCTION IF EXISTS public.admin_upsert_coupon(
  uuid, text, int, uuid, text, timestamp with time zone
);

-- Recreate canonical 7-parameter admin_upsert_coupon with p_max_uses DEFAULT 50
CREATE OR REPLACE FUNCTION public.admin_upsert_coupon(
  p_id uuid,
  p_code text,
  p_discount integer,
  p_product_id uuid,
  p_duration text,
  p_expires_at timestamp with time zone,
  p_max_uses integer DEFAULT 50
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_staff(array['owner', 'administrator', 'product_manager']);

  IF p_discount < 1 OR p_discount > 100 THEN
    RAISE EXCEPTION 'Discount must be between 1 and 100 percent.';
  END IF;

  IF trim(p_code) = '' THEN
    RAISE EXCEPTION 'Coupon code cannot be empty.';
  END IF;

  IF p_duration IS NOT NULL AND p_duration NOT IN ('1_week', '1_month', '3_months', 'lifetime') THEN
    RAISE EXCEPTION 'Invalid duration specification.';
  END IF;

  INSERT INTO public.coupons (
    id, code, discount, product_id, duration, expires_at, max_uses, is_active
  ) VALUES (
    coalesce(p_id, gen_random_uuid()),
    upper(trim(p_code)),
    p_discount,
    p_product_id,
    p_duration,
    p_expires_at,
    p_max_uses,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    code = upper(trim(p_code)),
    discount = EXCLUDED.discount,
    product_id = EXCLUDED.product_id,
    duration = EXCLUDED.duration,
    expires_at = EXCLUDED.expires_at,
    max_uses = EXCLUDED.max_uses,
    updated_at = now();

  INSERT INTO private.audit_log(actor_id, action, target_id)
  VALUES (auth.uid(), 'coupon.saved', upper(trim(p_code)));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_coupon(uuid, text, int, uuid, text, timestamp with time zone, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_coupon(uuid, text, int, uuid, text, timestamp with time zone, int) TO authenticated;


-- 3. ENSURE CANONICAL public.admin_upsert_agent_ai_policy (25 Parameters)
-- Drop obsolete legacy signatures
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean);

-- Ensure trial_stt_model column exists on agent_ai_policies table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'agent_ai_policies' 
      AND column_name = 'trial_stt_model'
  ) THEN
    ALTER TABLE public.agent_ai_policies 
      ADD COLUMN trial_stt_model text NOT NULL DEFAULT 'whisper-large-v3-turbo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'agent_ai_policies' 
      AND column_name = 'stt_key_id'
  ) THEN
    ALTER TABLE public.agent_ai_policies 
      ADD COLUMN stt_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'agent_ai_policies' 
      AND column_name = 'trial_stt_key_id'
  ) THEN
    ALTER TABLE public.agent_ai_policies 
      ADD COLUMN trial_stt_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'agent_ai_policies' 
      AND column_name = 'trial_stt_fallback_enabled'
  ) THEN
    ALTER TABLE public.agent_ai_policies 
      ADD COLUMN trial_stt_fallback_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_agent_ai_policy(
  p_product_id uuid,
  p_ai_enabled boolean,
  p_default_model text,
  p_task_models jsonb,
  p_daily_limit integer,
  p_weekly_limit integer,
  p_monthly_limit integer,
  p_trial_daily_limit integer DEFAULT 50,
  p_max_input_chars integer DEFAULT 60000,
  p_max_output_tokens integer DEFAULT 2048,
  p_enforce_zdr boolean DEFAULT true,
  p_stt_model text DEFAULT NULL,
  p_groq_fallback_enabled boolean DEFAULT NULL,
  p_stt_daily_limit integer DEFAULT NULL,
  p_stt_weekly_limit integer DEFAULT NULL,
  p_stt_monthly_limit integer DEFAULT NULL,
  p_stt_trial_daily_limit integer DEFAULT NULL,
  p_ai_key_id uuid DEFAULT NULL,
  p_trial_ai_key_id uuid DEFAULT NULL,
  p_trial_default_model text DEFAULT 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  p_trial_enforce_zdr boolean DEFAULT false,
  p_stt_key_id uuid DEFAULT NULL,
  p_trial_stt_key_id uuid DEFAULT NULL,
  p_trial_stt_fallback_enabled boolean DEFAULT false,
  p_trial_stt_model text DEFAULT 'whisper-large-v3-turbo'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_staff(array['owner', 'administrator', 'product_manager']);

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  INSERT INTO public.agent_ai_policies (
    product_id,
    ai_enabled,
    default_model,
    task_models,
    daily_limit,
    weekly_limit,
    monthly_limit,
    trial_daily_limit,
    max_input_chars,
    max_output_tokens,
    enforce_zdr,
    stt_model,
    groq_fallback_enabled,
    stt_daily_limit,
    stt_weekly_limit,
    stt_monthly_limit,
    stt_trial_daily_limit,
    ai_key_id,
    trial_ai_key_id,
    trial_default_model,
    trial_enforce_zdr,
    stt_key_id,
    trial_stt_key_id,
    trial_stt_fallback_enabled,
    trial_stt_model,
    updated_at
  ) VALUES (
    p_product_id,
    coalesce(p_ai_enabled, true),
    trim(coalesce(p_default_model, 'google/gemma-4-26b-a4b-it')),
    coalesce(p_task_models, '[]'::jsonb),
    greatest(0, coalesce(p_daily_limit, 0)),
    greatest(0, coalesce(p_weekly_limit, 0)),
    greatest(0, coalesce(p_monthly_limit, 0)),
    greatest(0, coalesce(p_trial_daily_limit, 50)),
    greatest(1000, least(200000, coalesce(p_max_input_chars, 60000))),
    greatest(64, least(32768, coalesce(p_max_output_tokens, 2048))),
    coalesce(p_enforce_zdr, true),
    coalesce(nullif(trim(p_stt_model), ''), 'whisper-large-v3-turbo'),
    coalesce(p_groq_fallback_enabled, false),
    greatest(0, coalesce(p_stt_daily_limit, 0)),
    greatest(0, coalesce(p_stt_weekly_limit, 0)),
    greatest(0, coalesce(p_stt_monthly_limit, 0)),
    greatest(0, coalesce(p_stt_trial_daily_limit, 0)),
    p_ai_key_id,
    p_trial_ai_key_id,
    coalesce(nullif(trim(p_trial_default_model), ''), 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'),
    coalesce(p_trial_enforce_zdr, false),
    p_stt_key_id,
    p_trial_stt_key_id,
    coalesce(p_trial_stt_fallback_enabled, false),
    coalesce(nullif(trim(p_trial_stt_model), ''), 'whisper-large-v3-turbo'),
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    ai_enabled = coalesce(EXCLUDED.ai_enabled, public.agent_ai_policies.ai_enabled),
    default_model = EXCLUDED.default_model,
    task_models = EXCLUDED.task_models,
    daily_limit = EXCLUDED.daily_limit,
    weekly_limit = EXCLUDED.weekly_limit,
    monthly_limit = EXCLUDED.monthly_limit,
    trial_daily_limit = EXCLUDED.trial_daily_limit,
    max_input_chars = EXCLUDED.max_input_chars,
    max_output_tokens = EXCLUDED.max_output_tokens,
    enforce_zdr = EXCLUDED.enforce_zdr,
    stt_model = EXCLUDED.stt_model,
    groq_fallback_enabled = EXCLUDED.groq_fallback_enabled,
    stt_daily_limit = EXCLUDED.stt_daily_limit,
    stt_weekly_limit = EXCLUDED.stt_weekly_limit,
    stt_monthly_limit = EXCLUDED.stt_monthly_limit,
    stt_trial_daily_limit = EXCLUDED.stt_trial_daily_limit,
    ai_key_id = EXCLUDED.ai_key_id,
    trial_ai_key_id = EXCLUDED.trial_ai_key_id,
    trial_default_model = EXCLUDED.trial_default_model,
    trial_enforce_zdr = EXCLUDED.trial_enforce_zdr,
    stt_key_id = EXCLUDED.stt_key_id,
    trial_stt_key_id = EXCLUDED.trial_stt_key_id,
    trial_stt_fallback_enabled = EXCLUDED.trial_stt_fallback_enabled,
    trial_stt_model = coalesce(EXCLUDED.trial_stt_model, public.agent_ai_policies.trial_stt_model),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean, uuid, uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean, uuid, uuid, boolean, text) TO authenticated;
