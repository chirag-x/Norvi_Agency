-- 076_groq_stt_and_dual_voice_policy.sql
-- Phase 17: Database-Encrypted Groq Voice STT Key Management & Dual-Tier Voice Policy

-- 1. Add STT key assignment columns to agent_ai_policies table
ALTER TABLE public.agent_ai_policies
  ADD COLUMN IF NOT EXISTS stt_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_stt_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_stt_fallback_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_stt_model text NOT NULL DEFAULT 'whisper-large-v3-turbo';

CREATE INDEX IF NOT EXISTS idx_agent_ai_policies_stt_key_id ON public.agent_ai_policies (stt_key_id);
CREATE INDEX IF NOT EXISTS idx_agent_ai_policies_trial_stt_key_id ON public.agent_ai_policies (trial_stt_key_id);

-- 2. Upgrade admin_get_agent_ai_policies()
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
    'sttKeyId', ap.stt_key_id,
    'sttKeyLabel', ak_stt.label,
    'sttKeySuffix', ak_stt.key_suffix,
    'trialSttKeyId', ap.trial_stt_key_id,
    'trialSttKeyLabel', ak_trial_stt.label,
    'trialSttKeySuffix', ak_trial_stt.key_suffix,
    'trialSttFallbackEnabled', coalesce(ap.trial_stt_fallback_enabled, false),
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
    'trialSttModel', coalesce(ap.trial_stt_model, ap.stt_model, 'whisper-large-v3-turbo'),
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
  LEFT JOIN public.admin_ai_keys ak_stt ON ak_stt.id = ap.stt_key_id
  LEFT JOIN public.admin_ai_keys ak_trial_stt ON ak_trial_stt.id = ap.trial_stt_key_id
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

-- 3. Upgrade admin_upsert_agent_ai_policy() with clean function signature drops
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid, uuid, text, boolean, uuid, uuid, boolean);
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

-- 4. Upgrade get_agent_stt_policy() with dual-tier fallback check & stt_key_id resolution
CREATE OR REPLACE FUNCTION public.get_agent_stt_policy(
  p_license_id uuid,
  p_product_id uuid,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check jsonb;
  v_is_trial boolean := false;
  v_policy record;
  v_stt_model text := 'whisper-large-v3-turbo';
  v_fallback_enabled boolean := false;
  v_resolved_stt_key_id uuid := NULL;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_check := private.verify_active_agent_license(p_license_id, p_product_id, p_device_id);
  IF NOT coalesce((v_check->>'allowed')::boolean, false) THEN
    RETURN v_check;
  END IF;

  v_is_trial := coalesce((v_check->>'is_trial')::boolean, false);

  SELECT
    stt_model,
    groq_fallback_enabled,
    stt_key_id,
    trial_stt_key_id,
    trial_stt_fallback_enabled
  INTO v_policy
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  IF FOUND THEN
    v_stt_model := coalesce(nullif(trim(v_policy.stt_model), ''), 'whisper-large-v3-turbo');
    
    IF v_is_trial THEN
      v_fallback_enabled := coalesce(v_policy.trial_stt_fallback_enabled, false);
      v_resolved_stt_key_id := coalesce(v_policy.trial_stt_key_id, v_policy.stt_key_id);
      
      IF NOT v_fallback_enabled THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 403,
          'reason', 'trial_stt_disabled',
          'error', 'Voice speech-to-text is reserved for paid licenses. Upgrade your license to enable live cloud voice input.'
        );
      END IF;
    ELSE
      v_fallback_enabled := coalesce(v_policy.groq_fallback_enabled, false);
      v_resolved_stt_key_id := v_policy.stt_key_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'stt_model', v_stt_model,
    'fallback_enabled', v_fallback_enabled,
    'stt_key_id', v_resolved_stt_key_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_stt_policy(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_stt_policy(uuid, uuid, text) TO service_role;

-- 5. Upgrade consume_agent_stt_quota() with dual-tier fallback check & stt_key_id resolution
CREATE OR REPLACE FUNCTION public.consume_agent_stt_quota(
  p_license_id uuid,
  p_product_id uuid,
  p_device_id text DEFAULT NULL,
  p_audio_bytes integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check jsonb;
  v_is_trial boolean := false;
  v_policy record;
  v_has_policy boolean := false;
  v_stt_model text := 'whisper-large-v3-turbo';
  v_fallback_enabled boolean := false;
  v_resolved_stt_key_id uuid := NULL;
  v_effective_daily integer := 0;
  v_day_count integer := 0;
  v_week_count integer := 0;
  v_month_count integer := 0;
  v_usage_log_id bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_license_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('stt:' || p_license_id::text));
  END IF;

  v_check := private.verify_active_agent_license(p_license_id, p_product_id, p_device_id);
  IF NOT coalesce((v_check->>'allowed')::boolean, false) THEN
    RETURN v_check;
  END IF;

  v_is_trial := coalesce((v_check->>'is_trial')::boolean, false);

  SELECT
    stt_model,
    groq_fallback_enabled,
    stt_key_id,
    trial_stt_key_id,
    trial_stt_fallback_enabled,
    stt_daily_limit,
    stt_weekly_limit,
    stt_monthly_limit,
    stt_trial_daily_limit
  INTO v_policy
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  v_has_policy := FOUND;

  IF v_has_policy THEN
    v_stt_model := coalesce(nullif(trim(v_policy.stt_model), ''), 'whisper-large-v3-turbo');
    
    IF v_is_trial THEN
      v_fallback_enabled := coalesce(v_policy.trial_stt_fallback_enabled, false);
      v_resolved_stt_key_id := coalesce(v_policy.trial_stt_key_id, v_policy.stt_key_id);
      
      IF NOT v_fallback_enabled THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 403,
          'reason', 'trial_stt_fallback_disabled',
          'error', 'Cloud speech-to-text fallback is reserved for paid license tiers. Upgrade your license to enable live voice input.'
        );
      END IF;
    ELSE
      v_fallback_enabled := coalesce(v_policy.groq_fallback_enabled, false);
      v_resolved_stt_key_id := v_policy.stt_key_id;
    END IF;
  END IF;

  IF NOT v_fallback_enabled THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'stt_fallback_disabled',
      'error', 'Cloud Speech fallback is disabled for this agent. Add your own free Groq API key or use Offline Whisper in Settings.'
    );
  END IF;

  IF v_has_policy THEN
    IF v_is_trial AND coalesce(v_policy.stt_trial_daily_limit, 0) > 0 THEN
      v_effective_daily := v_policy.stt_trial_daily_limit;
    ELSE
      v_effective_daily := coalesce(v_policy.stt_daily_limit, 0);
    END IF;

    IF v_effective_daily > 0 OR coalesce(v_policy.stt_weekly_limit, 0) > 0 OR coalesce(v_policy.stt_monthly_limit, 0) > 0 THEN
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        count(*) FILTER (WHERE created_at >= now() - interval '30 days')
      INTO v_day_count, v_week_count, v_month_count
      FROM public.agent_stt_usage_logs
      WHERE license_id = p_license_id
        AND status IN ('reserved', 'completed')
        AND created_at >= now() - interval '30 days';

      IF (v_effective_daily > 0 AND v_day_count >= v_effective_daily)
         OR (coalesce(v_policy.stt_weekly_limit, 0) > 0 AND v_week_count >= v_policy.stt_weekly_limit)
         OR (coalesce(v_policy.stt_monthly_limit, 0) > 0 AND v_month_count >= v_policy.stt_monthly_limit)
      THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'quota_exceeded',
          'error', 'Speech recognition usage limit reached for this billing window. You can provide your own free Groq API key in Settings.'
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.agent_stt_usage_logs (
    license_id,
    product_id,
    device_id,
    model,
    audio_bytes,
    status,
    created_at
  ) VALUES (
    p_license_id,
    p_product_id,
    coalesce(p_device_id, 'unknown'),
    v_stt_model,
    coalesce(p_audio_bytes, 0),
    'reserved',
    now()
  )
  RETURNING id INTO v_usage_log_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'stt_model', v_stt_model,
    'usage_log_id', v_usage_log_id,
    'stt_key_id', v_resolved_stt_key_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_stt_quota(uuid, uuid, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_stt_quota(uuid, uuid, text, integer) TO service_role;
