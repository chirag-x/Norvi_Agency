-- 075_dual_tier_ai_and_license_expansion.sql
-- Phase 15: Dual-Tier AI Isolation (Paid vs Free Trial), License Duration Expansion & Coupon Infrastructure

-- 1. Add price_1w to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_1w numeric(10, 2) DEFAULT NULL;

-- 2. Add trial AI columns to agent_ai_policies table
ALTER TABLE public.agent_ai_policies
  ADD COLUMN IF NOT EXISTS trial_ai_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_default_model text DEFAULT 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  ADD COLUMN IF NOT EXISTS trial_enforce_zdr boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agent_ai_policies_trial_key_id ON public.agent_ai_policies (trial_ai_key_id);

-- 3. Add is_trial to public.licenses table
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_licenses_is_trial ON public.licenses (is_trial);

-- Backfill is_trial for existing licenses originating from trial orders
UPDATE public.licenses l
SET is_trial = true
FROM public.orders o
WHERE l.order_id = o.id
  AND coalesce(o.provider_payment_id, '') LIKE 'trial_%';

-- 4. Add is_trial to public.agent_ai_usage_logs for dual analytics
ALTER TABLE public.agent_ai_usage_logs
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agent_ai_usage_is_trial ON public.agent_ai_usage_logs (product_id, is_trial, created_at DESC);

-- 5. Upgrade admin_get_agent_ai_policies()
CREATE OR REPLACE FUNCTION public.admin_get_agent_ai_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_items jsonb;
BEGIN
  PERFORM private.require_staff(array['owner', 'administrator', 'product_manager']);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'productId', p.id,
    'slug', p.slug,
    'name', p.name,
    'aiEnabled', coalesce(ap.ai_enabled, true),
    'aiKeyId', ap.ai_key_id,
    'aiKeyLabel', ak.label,
    'aiKeySuffix', ak.key_suffix,
    'trialAiKeyId', ap.trial_ai_key_id,
    'trialAiKeyLabel', ak_trial.label,
    'trialAiKeySuffix', ak_trial.key_suffix,
    'defaultModel', coalesce(ap.default_model, 'google/gemma-4-26b-a4b-it'),
    'trialDefaultModel', coalesce(ap.trial_default_model, 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'),
    'trialEnforceZdr', coalesce(ap.trial_enforce_zdr, false),
    'taskModels', coalesce(ap.task_models, '[]'::jsonb),
    'dailyLimit', coalesce(ap.daily_limit, 0),
    'weeklyLimit', coalesce(ap.weekly_limit, 0),
    'monthlyLimit', coalesce(ap.monthly_limit, 0),
    'trialDailyLimit', coalesce(ap.trial_daily_limit, 50),
    'maxInputChars', coalesce(ap.max_input_chars, 60000),
    'maxOutputTokens', coalesce(ap.max_output_tokens, 2048),
    'enforceZdr', coalesce(ap.enforce_zdr, true),
    'sttModel', coalesce(ap.stt_model, 'whisper-large-v3-turbo'),
    'groqFallbackEnabled', coalesce(ap.groq_fallback_enabled, false),
    'sttDailyLimit', coalesce(ap.stt_daily_limit, 0),
    'sttWeeklyLimit', coalesce(ap.stt_weekly_limit, 0),
    'sttMonthlyLimit', coalesce(ap.stt_monthly_limit, 0),
    'sttTrialDailyLimit', coalesce(ap.stt_trial_daily_limit, 0),
    'updatedAt', ap.updated_at,
    'stats', jsonb_build_object(
      'requests24h', coalesce(st.req_24h, 0),
      'requests7d', coalesce(st.req_7d, 0),
      'requests30d', coalesce(st.req_30d, 0),
      'cost30dUsd', coalesce(st.cost_30d, 0),
      'requests24hPaid', coalesce(st.req_24h_paid, 0),
      'requests24hTrial', coalesce(st.req_24h_trial, 0),
      'cost30dUsdPaid', coalesce(st.cost_30d_paid, 0),
      'cost30dUsdTrial', coalesce(st.cost_30d_trial, 0),
      'sttRequests24h', coalesce(st_stt.req_24h, 0),
      'sttRequests7d', coalesce(st_stt.req_7d, 0),
      'sttRequests30d', coalesce(st_stt.req_30d, 0),
      'sttMinutes30d', round(coalesce(st_stt.audio_secs_30d, 0) / 60.0, 2)
    )
  ) ORDER BY p.created_at ASC), '[]'::jsonb)
  INTO v_items
  FROM public.products p
  LEFT JOIN public.agent_ai_policies ap ON ap.product_id = p.id
  LEFT JOIN public.admin_ai_keys ak ON ak.id = ap.ai_key_id
  LEFT JOIN public.admin_ai_keys ak_trial ON ak_trial.id = ap.trial_ai_key_id
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE u.created_at >= now() - interval '24 hours') AS req_24h,
      count(*) FILTER (WHERE u.created_at >= now() - interval '7 days') AS req_7d,
      count(*) FILTER (WHERE u.created_at >= now() - interval '30 days') AS req_30d,
      coalesce(sum(u.estimated_cost_usd), 0) AS cost_30d,
      count(*) FILTER (WHERE u.created_at >= now() - interval '24 hours' AND NOT u.is_trial) AS req_24h_paid,
      count(*) FILTER (WHERE u.created_at >= now() - interval '24 hours' AND u.is_trial) AS req_24h_trial,
      coalesce(sum(u.estimated_cost_usd) FILTER (WHERE NOT u.is_trial AND u.created_at >= now() - interval '30 days'), 0) AS cost_30d_paid,
      coalesce(sum(u.estimated_cost_usd) FILTER (WHERE u.is_trial AND u.created_at >= now() - interval '30 days'), 0) AS cost_30d_trial
    FROM public.agent_ai_usage_logs u
    WHERE u.product_id = p.id
      AND u.status IN ('reserved', 'completed')
      AND u.created_at >= now() - interval '30 days'
  ) st ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE s.created_at >= now() - interval '24 hours') AS req_24h,
      count(*) FILTER (WHERE s.created_at >= now() - interval '7 days') AS req_7d,
      count(*) FILTER (WHERE s.created_at >= now() - interval '30 days') AS req_30d,
      coalesce(sum(s.audio_seconds), 0) AS audio_secs_30d
    FROM public.agent_stt_usage_logs s
    WHERE s.product_id = p.id
      AND s.status IN ('reserved', 'completed')
      AND s.created_at >= now() - interval '30 days'
  ) st_stt ON true
  WHERE p.status <> 'deleted';

  RETURN jsonb_build_object('items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_agent_ai_policies() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_agent_ai_policies() TO authenticated;

-- 6. Upgrade admin_upsert_agent_ai_policy()
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean);

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
  p_trial_enforce_zdr boolean DEFAULT false
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
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    ai_enabled = coalesce(EXCLUDED.ai_enabled, public.agent_ai_policies.ai_enabled),
    default_model = trim(coalesce(EXCLUDED.default_model, public.agent_ai_policies.default_model)),
    task_models = coalesce(EXCLUDED.task_models, public.agent_ai_policies.task_models),
    daily_limit = greatest(0, coalesce(EXCLUDED.daily_limit, public.agent_ai_policies.daily_limit)),
    weekly_limit = greatest(0, coalesce(EXCLUDED.weekly_limit, public.agent_ai_policies.weekly_limit)),
    monthly_limit = greatest(0, coalesce(EXCLUDED.monthly_limit, public.agent_ai_policies.monthly_limit)),
    trial_daily_limit = greatest(0, coalesce(EXCLUDED.trial_daily_limit, public.agent_ai_policies.trial_daily_limit)),
    max_input_chars = greatest(1000, least(200000, coalesce(EXCLUDED.max_input_chars, public.agent_ai_policies.max_input_chars))),
    max_output_tokens = greatest(64, least(32768, coalesce(EXCLUDED.max_output_tokens, public.agent_ai_policies.max_output_tokens))),
    enforce_zdr = coalesce(EXCLUDED.enforce_zdr, public.agent_ai_policies.enforce_zdr),
    stt_model = coalesce(nullif(trim(EXCLUDED.stt_model), ''), public.agent_ai_policies.stt_model, 'whisper-large-v3-turbo'),
    groq_fallback_enabled = coalesce(EXCLUDED.groq_fallback_enabled, public.agent_ai_policies.groq_fallback_enabled, false),
    stt_daily_limit = greatest(0, coalesce(EXCLUDED.stt_daily_limit, public.agent_ai_policies.stt_daily_limit, 0)),
    stt_weekly_limit = greatest(0, coalesce(EXCLUDED.stt_weekly_limit, public.agent_ai_policies.stt_weekly_limit, 0)),
    stt_monthly_limit = greatest(0, coalesce(EXCLUDED.stt_monthly_limit, public.agent_ai_policies.stt_monthly_limit, 0)),
    stt_trial_daily_limit = greatest(0, coalesce(EXCLUDED.stt_trial_daily_limit, public.agent_ai_policies.stt_trial_daily_limit, 0)),
    ai_key_id = EXCLUDED.ai_key_id,
    trial_ai_key_id = EXCLUDED.trial_ai_key_id,
    trial_default_model = coalesce(nullif(trim(EXCLUDED.trial_default_model), ''), public.agent_ai_policies.trial_default_model, 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'),
    trial_enforce_zdr = coalesce(EXCLUDED.trial_enforce_zdr, public.agent_ai_policies.trial_enforce_zdr, false),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean) TO authenticated;

-- Backwards compatibility overload for 20-parameter callers
CREATE OR REPLACE FUNCTION public.admin_upsert_agent_ai_policy(
  p_product_id uuid,
  p_ai_enabled boolean,
  p_default_model text,
  p_task_models jsonb,
  p_daily_limit integer,
  p_weekly_limit integer,
  p_monthly_limit integer,
  p_trial_daily_limit integer,
  p_max_input_chars integer,
  p_max_output_tokens integer,
  p_enforce_zdr boolean,
  p_stt_model text,
  p_groq_fallback_enabled boolean,
  p_stt_daily_limit integer,
  p_stt_weekly_limit integer,
  p_stt_monthly_limit integer,
  p_stt_trial_daily_limit integer,
  p_ai_key_id uuid,
  p_trial_ai_key_id uuid,
  p_trial_default_model text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_upsert_agent_ai_policy(
    p_product_id,
    p_ai_enabled,
    p_default_model,
    p_task_models,
    p_daily_limit,
    p_weekly_limit,
    p_monthly_limit,
    p_trial_daily_limit,
    p_max_input_chars,
    p_max_output_tokens,
    p_enforce_zdr,
    p_stt_model,
    p_groq_fallback_enabled,
    p_stt_daily_limit,
    p_stt_weekly_limit,
    p_stt_monthly_limit,
    p_stt_trial_daily_limit,
    p_ai_key_id,
    p_trial_ai_key_id,
    p_trial_default_model,
    false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text) TO authenticated;

-- Backwards compatibility overload for 18-parameter callers
CREATE OR REPLACE FUNCTION public.admin_upsert_agent_ai_policy(
  p_product_id uuid,
  p_ai_enabled boolean,
  p_default_model text,
  p_task_models jsonb,
  p_daily_limit integer,
  p_weekly_limit integer,
  p_monthly_limit integer,
  p_trial_daily_limit integer,
  p_max_input_chars integer,
  p_max_output_tokens integer,
  p_enforce_zdr boolean,
  p_stt_model text,
  p_groq_fallback_enabled boolean,
  p_stt_daily_limit integer,
  p_stt_weekly_limit integer,
  p_stt_monthly_limit integer,
  p_stt_trial_daily_limit integer,
  p_ai_key_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_upsert_agent_ai_policy(
    p_product_id,
    p_ai_enabled,
    p_default_model,
    p_task_models,
    p_daily_limit,
    p_weekly_limit,
    p_monthly_limit,
    p_trial_daily_limit,
    p_max_input_chars,
    p_max_output_tokens,
    p_enforce_zdr,
    p_stt_model,
    p_groq_fallback_enabled,
    p_stt_daily_limit,
    p_stt_weekly_limit,
    p_stt_monthly_limit,
    p_stt_trial_daily_limit,
    p_ai_key_id,
    NULL,
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid) TO authenticated;

-- 7. Upgrade consume_agent_ai_quota() for dual-tier routing
CREATE OR REPLACE FUNCTION public.consume_agent_ai_quota(
  p_license_id uuid,
  p_product_id uuid,
  p_device_id text DEFAULT NULL,
  p_task_key text DEFAULT 'default'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_license record;
  v_device record;
  v_policy public.agent_ai_policies%ROWTYPE;
  v_has_policy boolean := false;
  v_task_key text;
  v_model text;
  v_sort text := 'latency';
  v_max_input_chars integer := 60000;
  v_max_output_tokens integer := 2048;
  v_enforce_zdr boolean := true;
  v_allow_vision boolean := true;
  v_is_trial boolean := false;
  v_effective_daily integer := 0;
  v_day_count integer := 0;
  v_week_count integer := 0;
  v_month_count integer := 0;
  v_task_match jsonb;
  v_usage_log_id bigint;
  v_effective_key_id uuid := NULL;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'forbidden',
      'error', 'Unauthorized service role.'
    );
  END IF;

  SELECT * INTO v_license
  FROM public.licenses
  WHERE id = p_license_id
    AND product_id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 404,
      'reason', 'license_not_found',
      'error', 'License could not be verified for this agent.'
    );
  END IF;

  IF v_license.status <> 'active' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_revoked',
      'error', 'License is revoked or suspended.'
    );
  END IF;

  IF v_license.expires_at IS NOT NULL AND v_license.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_expired',
      'error', 'License has expired.'
    );
  END IF;

  -- Device verification if device_id provided
  IF nullif(trim(coalesce(p_device_id, '')), '') IS NOT NULL THEN
    SELECT * INTO v_device
    FROM public.devices
    WHERE license_id = p_license_id
      AND installation_id = trim(p_device_id);

    IF FOUND THEN
      IF v_device.banned_until IS NOT NULL AND v_device.banned_until > now() THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 403,
          'reason', 'device_banned',
          'error', CASE
            WHEN v_device.banned_until >= '9999-01-01'::timestamptz THEN 'This machine has been permanently blocked by administrator.'
            ELSE 'This device has been temporarily blocked until ' || to_char(v_device.banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC') || ' by administrator.'
          END
        );
      END IF;

      IF NOT v_device.active AND (v_device.banned_until IS NULL OR v_device.banned_until >= '9999-01-01'::timestamptz) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 403,
          'reason', 'device_blocked',
          'error', 'This device is inactive or blocked.'
        );
      END IF;
    END IF;
  END IF;

  -- Load agent AI policy
  SELECT * INTO v_policy
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  v_has_policy := FOUND;

  IF v_has_policy AND NOT v_policy.ai_enabled THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'ai_disabled',
      'error', 'Cloud AI is currently disabled for this agent.'
    );
  END IF;

  v_task_key := lower(trim(coalesce(p_task_key, 'default')));
  IF v_task_key = '' THEN
    v_task_key := 'default';
  END IF;

  -- Determine if trial license
  v_is_trial := coalesce(v_license.is_trial, false) OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = v_license.order_id
      AND coalesce(o.provider_payment_id, '') LIKE 'trial_%'
  );

  IF v_has_policy THEN
    v_max_input_chars := v_policy.max_input_chars;
    v_max_output_tokens := v_policy.max_output_tokens;
    v_enforce_zdr := v_policy.enforce_zdr;

    IF v_is_trial THEN
      -- Free Trial Tier: Use single trial model for all tasks, trial key, and trial ZDR policy
      v_model := coalesce(nullif(trim(v_policy.trial_default_model), ''), 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free');
      v_effective_key_id := coalesce(v_policy.trial_ai_key_id, v_policy.ai_key_id);
      v_effective_daily := coalesce(v_policy.trial_daily_limit, 50);
      v_enforce_zdr := coalesce(v_policy.trial_enforce_zdr, false);
    ELSE
      -- Paid Customer Tier: Use task-specific models, paid key, and paid ZDR policy
      v_model := v_policy.default_model;
      v_effective_key_id := v_policy.ai_key_id;
      v_effective_daily := coalesce(v_policy.daily_limit, 0);
      v_enforce_zdr := coalesce(v_policy.enforce_zdr, true);

      SELECT elem INTO v_task_match
      FROM jsonb_array_elements(coalesce(v_policy.task_models, '[]'::jsonb)) AS elem
      WHERE lower(coalesce(elem->>'task_key', '')) = v_task_key
        AND nullif(trim(coalesce(elem->>'model', '')), '') IS NOT NULL
      LIMIT 1;

      IF v_task_match IS NOT NULL THEN
        v_model := trim(v_task_match->>'model');
        IF lower(coalesce(v_task_match->>'sort', '')) IN ('latency', 'price') THEN
          v_sort := lower(v_task_match->>'sort');
        END IF;
        IF coalesce(v_task_match->>'max_output_tokens', '') ~ '^\d+$' THEN
          v_max_output_tokens := greatest(64, least(32768, (v_task_match->>'max_output_tokens')::integer));
        END IF;
        IF v_task_match ? 'allow_vision' THEN
          v_allow_vision := coalesce((v_task_match->>'allow_vision')::boolean, true);
        END IF;
      END IF;
    END IF;
  ELSE
    v_model := 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
    v_effective_daily := 50;
  END IF;

  -- Rate limit verification
  IF v_has_policy THEN
    IF v_effective_daily > 0 OR (NOT v_is_trial AND (v_policy.weekly_limit > 0 OR v_policy.monthly_limit > 0)) THEN
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        count(*)
      INTO v_day_count, v_week_count, v_month_count
      FROM public.agent_ai_usage_logs
      WHERE license_id = v_license.id
        AND status IN ('reserved', 'completed')
        AND created_at >= now() - interval '30 days';

      IF (v_effective_daily > 0 AND v_day_count >= v_effective_daily) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'cooldown',
          'error', CASE 
            WHEN v_is_trial THEN 'Daily free trial AI limit reached. Upgrade to a paid plan for higher limits and specialized models.'
            ELSE 'Temporary AI cooldown active due to high daily usage. Please try again later.'
          END
        );
      END IF;

      IF NOT v_is_trial AND ((v_policy.weekly_limit > 0 AND v_week_count >= v_policy.weekly_limit) OR (v_policy.monthly_limit > 0 AND v_month_count >= v_policy.monthly_limit)) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'cooldown',
          'error', 'Temporary AI cooldown active due to high usage. Please try again later.'
        );
      END IF;
    END IF;
  END IF;

  -- Record usage reservation with is_trial flag
  INSERT INTO public.agent_ai_usage_logs (license_id, product_id, device_id, task_key, model_used, status, is_trial)
  VALUES (v_license.id, p_product_id, nullif(trim(coalesce(p_device_id, '')), ''), v_task_key, v_model, 'reserved', v_is_trial)
  RETURNING id INTO v_usage_log_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_log_id', v_usage_log_id,
    'model', v_model,
    'sort', v_sort,
    'max_input_chars', v_max_input_chars,
    'max_output_tokens', v_max_output_tokens,
    'enforce_zdr', v_enforce_zdr,
    'allow_vision', v_allow_vision,
    'ai_key_id', v_effective_key_id,
    'is_trial', v_is_trial
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) TO service_role;

-- 8. Upgrade admin_gift_license() with expanded duration taxonomy
CREATE OR REPLACE FUNCTION public.admin_gift_license(
  p_email text,
  p_product_slug text,
  p_encryption_secret text,
  p_duration text DEFAULT 'lifetime'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role          text;
  v_user_id       uuid;
  v_product_id    uuid;
  v_order_id      uuid;
  v_license_id    uuid;
  v_raw_key       text;
  v_key_hash      text;
  v_encrypted_key text;
  v_interval      interval;
  v_is_trial      boolean := false;
  v_payment_prefix text := 'gift_';
BEGIN
  -- Permission check
  SELECT role INTO v_role
  FROM public.staff_memberships
  WHERE user_id = auth.uid() AND active = true;

  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Account with this email does not exist. They must register first.';
  END IF;

  SELECT id INTO v_product_id FROM public.products WHERE slug = p_product_slug;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  -- Determine time interval and trial classification
  IF p_duration IN ('1_day', '24h') THEN
    v_interval := interval '24 hours';
    v_is_trial := true;
    v_payment_prefix := 'trial_gift_';
  ELSIF p_duration = '1_week_trial' THEN
    v_interval := interval '7 days';
    v_is_trial := true;
    v_payment_prefix := 'trial_gift_';
  ELSIF p_duration = '1_month_trial' THEN
    v_interval := interval '1 month';
    v_is_trial := true;
    v_payment_prefix := 'trial_gift_';
  ELSIF p_duration IN ('1_week', '7d') THEN
    v_interval := interval '7 days';
    v_is_trial := false;
    v_payment_prefix := 'gift_';
  ELSIF p_duration = '1_month' THEN
    v_interval := interval '1 month';
    v_is_trial := false;
    v_payment_prefix := 'gift_';
  ELSIF p_duration = '3_months' THEN
    v_interval := interval '3 months';
    v_is_trial := false;
    v_payment_prefix := 'gift_';
  ELSE
    v_interval := NULL; -- lifetime
    v_is_trial := false;
    v_payment_prefix := 'gift_';
  END IF;

  -- Create gift order
  INSERT INTO public.orders (
    user_id, product_id, status,
    amount_minor, currency, provider_payment_id, idempotency_key, duration
  )
  VALUES (
    v_user_id, v_product_id, 'paid',
    0, 'USD',
    v_payment_prefix || substr(md5(random()::text), 1, 10),
    v_payment_prefix || substr(md5(random()::text), 1, 10),
    p_duration
  )
  RETURNING id INTO v_order_id;

  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4));

  v_key_hash      := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  INSERT INTO public.licenses (
    id, user_id, product_id, order_id, status,
    key_suffix, max_devices, expires_at, is_trial
  )
  VALUES (
    v_license_id, v_user_id, v_product_id, v_order_id, 'active',
    right(v_raw_key, 4), 3,
    CASE WHEN v_interval IS NOT NULL THEN now() + v_interval ELSE NULL END,
    v_is_trial
  );

  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

  RETURN v_license_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_gift_license(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_gift_license(text, text, text, text) TO authenticated;

-- 9. Upgrade claim_free_trial() with hardware anti-abuse and is_trial flag
CREATE OR REPLACE FUNCTION public.claim_free_trial(
  p_product_slug text,
  p_encryption_secret text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id       uuid;
  v_product       record;
  v_price_id      uuid;
  v_order_id      uuid;
  v_license_id    uuid;
  v_raw_key       text;
  v_key_hash      text;
  v_encrypted_key text;
  v_existing_trial boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to claim a trial.';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE slug = p_product_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  IF v_product.trial_active IS FALSE OR v_product.status = 'archived' THEN
    RAISE EXCEPTION 'Free trials are not available for this agent.';
  END IF;

  -- Check if user already owns or has ever claimed a trial for this product
  SELECT EXISTS (
    SELECT 1 FROM public.licenses 
    WHERE user_id = v_user_id AND product_id = v_product.id
  ) INTO v_existing_trial;

  IF v_existing_trial THEN
    RAISE EXCEPTION 'You already have an active license or have already used your free trial for this product.';
  END IF;

  SELECT id INTO v_price_id FROM public.prices WHERE product_id = v_product.id LIMIT 1;

  INSERT INTO public.orders (
    user_id, product_id, price_id, status,
    amount_minor, currency, provider_payment_id, idempotency_key, duration
  )
  VALUES (
    v_user_id, v_product.id, v_price_id, 'paid',
    0, 'USD',
    'trial_' || substr(md5(random()::text), 1, 10),
    'trial_' || substr(md5(random()::text), 1, 10),
    '1_day'
  )
  RETURNING id INTO v_order_id;

  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4));

  v_key_hash      := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at, is_trial)
  VALUES (v_license_id, v_user_id, v_product.id, v_order_id, 'active', right(v_raw_key, 4), 1, now() + interval '24 hours', true);

  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

  RETURN v_license_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_trial(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_free_trial(text, text) TO authenticated;

-- 10. Upgrade create_checkout_order() to support 1_week and trial coupon redemptions
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
  v_settings record;
  v_coupon record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or unavailable.'; END IF;

  IF p_duration = '1_week' THEN v_amount := coalesce(v_product.price_1w, 0);
  ELSIF p_duration = '1_month' THEN v_amount := coalesce(v_product.price_1m, 0);
  ELSIF p_duration = '3_months' THEN v_amount := coalesce(v_product.price_3m, 0);
  ELSIF p_duration = 'lifetime' THEN v_amount := coalesce(v_product.price_lifetime, 0);
  ELSIF p_duration IN ('1_week_trial', '1_month_trial') THEN v_amount := 0;
  ELSE RAISE EXCEPTION 'Invalid duration. Must be 1_week, 1_month, 3_months, or lifetime.'; END IF;

  IF p_renewal_for_license_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE id = p_renewal_for_license_id AND user_id = v_user_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'License to renew not found or does not belong to you.';
    END IF;
  END IF;

  -- 1. Apply Flash Sale Discount (if active and not trial)
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1;
  IF v_settings.sale_active AND v_settings.sale_percentage > 0 AND v_product.is_on_sale AND v_amount > 0 THEN
    v_amount := v_amount * (1.0 - (v_settings.sale_percentage::numeric / 100.0));
  END IF;

  -- 2. Apply Referral Code OR Coupon Code
  v_affiliate_id := NULL;
  IF p_referral_code IS NOT NULL AND trim(p_referral_code) != '' THEN
    SELECT * INTO v_coupon FROM public.coupons 
    WHERE upper(code) = upper(trim(p_referral_code))
      AND (expires_at IS NULL OR expires_at > now())
      AND (product_id IS NULL OR product_id = p_product_id)
      AND (
        duration_type IS NULL 
        OR duration_type = 'all' 
        OR trim(duration_type) = ''
        OR p_duration = ANY(string_to_array(duration_type, ','))
      );
      
    IF FOUND THEN
      v_amount := v_amount * (1.0 - (v_coupon.discount_percentage::numeric / 100.0));
    ELSE
      SELECT id INTO v_affiliate_id FROM public.affiliates 
      WHERE upper(referral_code) = upper(trim(p_referral_code)) 
      AND user_id != v_user_id
      AND coalesce(status, 'active') = 'active';

      IF FOUND AND v_amount > 0 THEN
        v_amount := v_amount * 0.90;
      END IF;
    END IF;
  END IF;

  IF v_amount < 0 THEN v_amount := 0; END IF;

  v_currency := 'INR';
  v_order_id := gen_random_uuid();

  INSERT INTO public.orders (id, user_id, product_id, amount_minor, currency, status, duration, renewal_for_license_id, idempotency_key, affiliate_id)
  VALUES (v_order_id, v_user_id, p_product_id, (v_amount * 100)::bigint, v_currency, 'pending', p_duration, p_renewal_for_license_id, 'checkout_' || gen_random_uuid(), v_affiliate_id);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'amount', (v_amount * 100)::bigint,
    'amount_minor', (v_amount * 100)::bigint,
    'currency', v_currency,
    'name', v_product.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) TO authenticated;

-- 11. Upgrade validate_promo_code() to support multi-durations
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_product_id uuid, p_duration text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE 
  v_coupon record; 
  v_affiliate record;
  v_allowed_durations text[];
  v_duration_match boolean;
BEGIN
  -- 1. Try Coupon first
  SELECT * INTO v_coupon FROM public.coupons 
  WHERE upper(code) = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
    AND (product_id IS NULL OR product_id = p_product_id);
    
  IF FOUND THEN
    IF v_coupon.max_uses IS NOT NULL AND coalesce(v_coupon.used_count, 0) >= v_coupon.max_uses THEN
      RETURN json_build_object(
        'valid', false,
        'type', 'coupon',
        'reason', 'usage_limit_reached'
      );
    END IF;

    IF v_coupon.duration_type IS NULL OR v_coupon.duration_type = 'all' OR trim(v_coupon.duration_type) = '' THEN
      v_duration_match := true;
      v_allowed_durations := ARRAY['1_week', '1_month', '3_months', 'lifetime'];
    ELSE
      v_allowed_durations := string_to_array(v_coupon.duration_type, ',');
      v_duration_match := (p_duration = ANY(v_allowed_durations));
    END IF;

    IF v_duration_match THEN
      RETURN json_build_object(
        'valid', true,
        'type', 'coupon', 
        'discount', v_coupon.discount_percentage,
        'allowed_durations', v_allowed_durations
      );
    ELSE
      RETURN json_build_object(
        'valid', false,
        'type', 'coupon',
        'reason', 'duration_mismatch',
        'discount', v_coupon.discount_percentage,
        'allowed_durations', v_allowed_durations
      );
    END IF;
  END IF;

  -- 2. Try Affiliate / Partner Code
  SELECT id, user_id, status INTO v_affiliate FROM public.affiliates 
  WHERE upper(referral_code) = upper(trim(p_code));

  IF FOUND THEN
    IF coalesce(v_affiliate.status, 'active') != 'active' THEN
      RETURN json_build_object('valid', false, 'reason', 'inactive');
    END IF;

    RETURN json_build_object(
      'valid', true,
      'type', 'referral',
      'discount', 10,
      'partner_user_id', v_affiliate.user_id,
      'allowed_durations', ARRAY['1_week', '1_month', '3_months', 'lifetime']
    );
  END IF;

  RETURN json_build_object('valid', false, 'reason', 'not_found');
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promo_code(text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, uuid, text) TO authenticated;

-- 12. Upgrade process_payment_webhook() to set is_trial on license fulfillment
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
  v_interval interval;
  v_is_trial boolean := false;
BEGIN
  IF auth.role() != 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_encryption_secret IS NULL OR length(p_encryption_secret) < 8 THEN RAISE EXCEPTION 'Encryption key is not configured.'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;
  IF v_order.status = 'paid' THEN RETURN jsonb_build_object('ok', true, 'message', 'Already processed'); END IF;
  IF v_order.status <> 'pending' THEN RAISE EXCEPTION 'Order cannot be paid from its current state.'; END IF;

  UPDATE public.orders SET status = 'paid', provider_payment_id = p_payment_id WHERE id = p_order_id;

  IF v_order.duration IN ('1_week', '7d') THEN 
    v_interval := interval '7 days';
    v_is_trial := false;
  ELSIF v_order.duration = '1_week_trial' THEN
    v_interval := interval '7 days';
    v_is_trial := true;
  ELSIF v_order.duration = '1_month' THEN 
    v_interval := interval '1 month';
    v_is_trial := false;
  ELSIF v_order.duration = '1_month_trial' THEN
    v_interval := interval '1 month';
    v_is_trial := true;
  ELSIF v_order.duration = '3_months' THEN 
    v_interval := interval '3 months';
    v_is_trial := false;
  ELSIF v_order.duration IN ('1_day', '24h') THEN
    v_interval := interval '24 hours';
    v_is_trial := true;
  ELSE 
    v_interval := NULL; -- lifetime
    v_is_trial := false;
  END IF;

  IF coalesce(p_payment_id, '') LIKE 'trial_%' THEN
    v_is_trial := true;
  END IF;

  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' || upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' || upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' || upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' || upper(substring(md5(random()::text) FROM 1 FOR 4));
  v_key_hash := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at, is_trial)
  VALUES (v_license_id, v_order.user_id, v_order.product_id, p_order_id, 'active', right(v_raw_key, 4), 3, CASE WHEN v_interval IS NOT NULL THEN now() + v_interval ELSE NULL END, v_is_trial);

  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version) VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);
  INSERT INTO private.outbox (kind, record_id, idempotency_key) VALUES ('order_receipt', p_order_id, 'receipt_' || p_order_id) ON CONFLICT DO NOTHING;

  IF v_order.affiliate_id IS NOT NULL AND v_order.amount_minor > 0 THEN
    INSERT INTO public.affiliate_commissions (affiliate_id, order_id, amount_minor)
    VALUES (v_order.affiliate_id, v_order.id, (v_order.amount_minor * 0.15)::bigint);
  END IF;

  RETURN jsonb_build_object('ok', true, 'license_id', v_license_id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_payment_webhook(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook(uuid, text, text) TO service_role;

-- 13. Upgrade admin_upsert_product to support price_1w
DROP FUNCTION IF EXISTS public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb, numeric);
DROP FUNCTION IF EXISTS public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb);

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

-- Overload for backwards compatibility without p_price_1w
CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category_id uuid, p_tagline text, p_description text,
  p_price_label text, p_status text, p_logo_url text, p_features text[], p_version text,
  p_requirements text, p_release_status text, p_workflow_heading text,
  p_workflow_description text, p_workflow_media_url text, p_workflow_note text,
  p_price_1m numeric, p_price_3m numeric, p_price_lifetime numeric,
  p_ai_usage text, p_device_allowance text,
  p_extended_content jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.admin_upsert_product(
    p_id, p_slug, p_name, p_category_id, p_tagline, p_description,
    p_price_label, p_status, p_logo_url, p_features, p_version,
    p_requirements, p_release_status, p_workflow_heading,
    p_workflow_description, p_workflow_media_url, p_workflow_note,
    p_price_1m, p_price_3m, p_price_lifetime,
    p_ai_usage, p_device_allowance, p_extended_content,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb) TO authenticated;

-- 14. Upgrade admin_list_products to return price1w
CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS json language plpgsql security definer set search_path='' as $$
declare v_items json; v_categories json;
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  select coalesce(json_agg(json_build_object(
    'id',p.id,'slug',p.slug,'name',p.name,'categoryId',p.category_id,
    'category',case when c.id is null then null else json_build_object('id',c.id,'slug',c.slug,'name',c.name) end,
    'tagline',p.tagline,'description',p.description,'price',p.price_label,
    'price1w',p.price_1w,'price1m',p.price_1m,'price3m',p.price_3m,'price_lifetime',p.price_lifetime,
    'status',p.status,
    'logoUrl',p.logo_url,'features',p.features,'version',p.version,'requirements',p.requirements,
    'releaseStatus',p.release_status,'workflowHeading',p.workflow_heading,
    'workflowDescription',p.workflow_description,'workflowMediaUrl',p.workflow_media_url,
    'workflowNote',p.workflow_note,'updatedAt',p.created_at,
    'is_on_sale',p.is_on_sale,
    'aiUsage',p.ai_usage, 'deviceAllowance',p.device_allowance,
    'trialActive',p.trial_active,
    'extendedContent',coalesce(p.extended_content, '{}'::jsonb)
  ) order by p.created_at), '[]'::json) into v_items
  from public.products p left join public.categories c on c.id=p.category_id
  WHERE p.status != 'deleted';
  
  select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'createdAt',created_at) order by created_at),'[]'::json)
    into v_categories from public.categories;
    
  return json_build_object('items', v_items, 'categories', v_categories);
end;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_products() TO authenticated;
