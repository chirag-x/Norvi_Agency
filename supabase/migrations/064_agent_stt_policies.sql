-- 064_agent_stt_policies.sql
-- Phase 1 (Centralized Groq STT & Fallback Proxy Upgrade):
-- Extends private agent_ai_policies with centralized Groq STT model control,
-- per-agent NORVI fallback toggle, dedicated agent_stt_usage_logs ledger,
-- and separate hidden 1d/1w/1m/trial STT fallback caps.

BEGIN;

-- 1. Extend private agent_ai_policies with Groq STT configuration & hidden STT fallback limits
ALTER TABLE public.agent_ai_policies
  ADD COLUMN IF NOT EXISTS stt_model text NOT NULL DEFAULT 'whisper-large-v3-turbo',
  ADD COLUMN IF NOT EXISTS groq_fallback_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stt_daily_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stt_weekly_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stt_monthly_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stt_trial_daily_limit integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_ai_policies_stt_model_check'
  ) THEN
    ALTER TABLE public.agent_ai_policies
      ADD CONSTRAINT agent_ai_policies_stt_model_check CHECK (length(trim(stt_model)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_ai_policies_stt_daily_limit_check'
  ) THEN
    ALTER TABLE public.agent_ai_policies
      ADD CONSTRAINT agent_ai_policies_stt_daily_limit_check CHECK (stt_daily_limit >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_ai_policies_stt_weekly_limit_check'
  ) THEN
    ALTER TABLE public.agent_ai_policies
      ADD CONSTRAINT agent_ai_policies_stt_weekly_limit_check CHECK (stt_weekly_limit >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_ai_policies_stt_monthly_limit_check'
  ) THEN
    ALTER TABLE public.agent_ai_policies
      ADD CONSTRAINT agent_ai_policies_stt_monthly_limit_check CHECK (stt_monthly_limit >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_ai_policies_stt_trial_daily_limit_check'
  ) THEN
    ALTER TABLE public.agent_ai_policies
      ADD CONSTRAINT agent_ai_policies_stt_trial_daily_limit_check CHECK (stt_trial_daily_limit >= 0);
  END IF;
END
$$;

-- 2. Dedicated private STT fallback usage ledger (strictly isolated from OpenRouter agent_ai_usage_logs)
CREATE TABLE IF NOT EXISTS public.agent_stt_usage_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  device_id text,
  model_used text NOT NULL,
  audio_bytes integer NOT NULL DEFAULT 0 CHECK (audio_bytes >= 0),
  audio_seconds numeric(10, 2) NOT NULL DEFAULT 0 CHECK (audio_seconds >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_stt_usage_license_created
  ON public.agent_stt_usage_logs (license_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_stt_usage_product_created
  ON public.agent_stt_usage_logs (product_id, created_at DESC);

ALTER TABLE public.agent_stt_usage_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.agent_stt_usage_logs FROM public, anon, authenticated;
GRANT ALL ON public.agent_stt_usage_logs TO service_role;

-- 3. Shared internal helper validating active license, product match, expiry, suspension, device binding, and trial status
CREATE OR REPLACE FUNCTION private.verify_active_agent_license(
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
  v_license record;
  v_suspended boolean := false;
  v_device record;
  v_is_trial boolean := false;
BEGIN
  IF p_license_id IS NULL OR p_product_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_invalid',
      'error', 'License is invalid.'
    );
  END IF;

  SELECT id, user_id, product_id, order_id, status, expires_at
  INTO v_license
  FROM public.licenses
  WHERE id = p_license_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_invalid',
      'error', 'License is invalid.'
    );
  END IF;

  IF v_license.product_id <> p_product_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'product_mismatch',
      'error', 'License is not valid for this agent.'
    );
  END IF;

  IF v_license.status <> 'active' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_revoked',
      'error', 'This license has been deactivated or revoked.'
    );
  END IF;

  IF v_license.expires_at IS NOT NULL AND v_license.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_expired',
      'error', 'This license has expired.'
    );
  END IF;

  SELECT suspended INTO v_suspended
  FROM public.profiles
  WHERE id = v_license.user_id;

  IF coalesce(v_suspended, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'account_suspended',
      'error', 'This account is suspended.'
    );
  END IF;

  IF nullif(trim(coalesce(p_device_id, '')), '') IS NOT NULL THEN
    SELECT id, active INTO v_device
    FROM public.devices
    WHERE license_id = v_license.id
      AND installation_id = trim(p_device_id);

    IF NOT FOUND OR NOT v_device.active THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_blocked',
        'error', 'This device is inactive or blocked.'
      );
    END IF;
  END IF;

  v_is_trial := EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = v_license.order_id
      AND coalesce(o.provider_payment_id, '') LIKE 'trial_%'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.orders r
    WHERE r.renewal_for_license_id = v_license.id
      AND r.status = 'paid'
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'license_id', v_license.id,
    'is_trial', v_is_trial
  );
END;
$$;

REVOKE ALL ON FUNCTION private.verify_active_agent_license(uuid, uuid, text) FROM public, anon, authenticated;

-- 4. Authenticated STT config lookup RPC (service_role only; never exposes hidden quota numbers)
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
  v_policy record;
  v_stt_model text := 'whisper-large-v3-turbo';
  v_fallback_enabled boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_check := private.verify_active_agent_license(p_license_id, p_product_id, p_device_id);
  IF NOT coalesce((v_check->>'allowed')::boolean, false) THEN
    RETURN v_check;
  END IF;

  SELECT stt_model, groq_fallback_enabled
  INTO v_policy
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  IF FOUND THEN
    v_stt_model := coalesce(nullif(trim(v_policy.stt_model), ''), 'whisper-large-v3-turbo');
    v_fallback_enabled := coalesce(v_policy.groq_fallback_enabled, false);
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'stt_model', v_stt_model,
    'fallback_enabled', v_fallback_enabled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_stt_policy(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_stt_policy(uuid, uuid, text) TO service_role;

-- 5. Atomic STT fallback quota check + reservation + model lock RPC (service_role only)
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
    -- Serialize concurrent STT fallback quota checks per license separately from AI quota
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
    v_fallback_enabled := coalesce(v_policy.groq_fallback_enabled, false);
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
    IF v_is_trial AND v_policy.stt_trial_daily_limit > 0 THEN
      v_effective_daily := v_policy.stt_trial_daily_limit;
    ELSE
      v_effective_daily := v_policy.stt_daily_limit;
    END IF;

    IF v_effective_daily > 0 OR v_policy.stt_weekly_limit > 0 OR v_policy.stt_monthly_limit > 0 THEN
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
         OR (v_policy.stt_weekly_limit > 0 AND v_week_count >= v_policy.stt_weekly_limit)
         OR (v_policy.stt_monthly_limit > 0 AND v_month_count >= v_policy.stt_monthly_limit)
      THEN
        -- Non-numeric cooldown message so hidden limits are never leaked to clients
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'cooldown',
          'error', 'Temporary speech service cooldown active due to high usage. Add your own free Groq API key in Settings or try again later.'
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.agent_stt_usage_logs (
    license_id, product_id, device_id, model_used, audio_bytes, status
  )
  VALUES (
    p_license_id,
    p_product_id,
    nullif(trim(coalesce(p_device_id, '')), ''),
    v_stt_model,
    greatest(0, coalesce(p_audio_bytes, 0)),
    'reserved'
  )
  RETURNING id INTO v_usage_log_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_log_id', v_usage_log_id,
    'stt_model', v_stt_model
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_stt_quota(uuid, uuid, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_stt_quota(uuid, uuid, text, integer) TO service_role;

-- 6. Finalize STT fallback usage & audio duration asynchronously (service_role only)
CREATE OR REPLACE FUNCTION public.finalize_agent_stt_usage(
  p_usage_log_id bigint,
  p_status text,
  p_audio_seconds numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid usage status.';
  END IF;

  UPDATE public.agent_stt_usage_logs
  SET
    status = p_status,
    audio_seconds = greatest(0, coalesce(p_audio_seconds, 0))
  WHERE id = p_usage_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_agent_stt_usage(bigint, text, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_agent_stt_usage(bigint, text, numeric) TO service_role;

-- 7. Staff Admin RPC: Include Groq STT policy fields and isolated STT fallback stats
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
    'defaultModel', coalesce(ap.default_model, 'google/gemma-4-26b-a4b-it'),
    'taskModels', coalesce(ap.task_models, '[]'::jsonb),
    'dailyLimit', coalesce(ap.daily_limit, 0),
    'weeklyLimit', coalesce(ap.weekly_limit, 0),
    'monthlyLimit', coalesce(ap.monthly_limit, 0),
    'trialDailyLimit', coalesce(ap.trial_daily_limit, 0),
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
      'sttRequests24h', coalesce(st_stt.req_24h, 0),
      'sttRequests7d', coalesce(st_stt.req_7d, 0),
      'sttRequests30d', coalesce(st_stt.req_30d, 0),
      'sttMinutes30d', round(coalesce(st_stt.audio_secs_30d, 0) / 60.0, 2)
    )
  ) ORDER BY p.created_at ASC), '[]'::jsonb)
  INTO v_items
  FROM public.products p
  LEFT JOIN public.agent_ai_policies ap ON ap.product_id = p.id
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE u.created_at >= now() - interval '24 hours') AS req_24h,
      count(*) FILTER (WHERE u.created_at >= now() - interval '7 days') AS req_7d,
      count(*) FILTER (WHERE u.created_at >= now() - interval '30 days') AS req_30d,
      coalesce(sum(u.estimated_cost_usd), 0) AS cost_30d
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

-- 8. Staff Admin RPC: Drop 11-arg overload and replace with backward-compatible 17-arg signature
DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(
  uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean
);

CREATE OR REPLACE FUNCTION public.admin_upsert_agent_ai_policy(
  p_product_id uuid,
  p_ai_enabled boolean,
  p_default_model text,
  p_task_models jsonb,
  p_daily_limit integer,
  p_weekly_limit integer,
  p_monthly_limit integer,
  p_trial_daily_limit integer DEFAULT 0,
  p_max_input_chars integer DEFAULT 60000,
  p_max_output_tokens integer DEFAULT 2048,
  p_enforce_zdr boolean DEFAULT true,
  p_stt_model text DEFAULT NULL,
  p_groq_fallback_enabled boolean DEFAULT NULL,
  p_stt_daily_limit integer DEFAULT NULL,
  p_stt_weekly_limit integer DEFAULT NULL,
  p_stt_monthly_limit integer DEFAULT NULL,
  p_stt_trial_daily_limit integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text;
  v_clean_tasks jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_task_key text;
  v_model text;
  v_label text;
  v_sort text;
  v_max_out integer;
  v_vision boolean;
  v_existing record;
  v_resolved_stt_model text;
  v_resolved_fallback boolean;
  v_resolved_stt_daily integer;
  v_resolved_stt_weekly integer;
  v_resolved_stt_monthly integer;
  v_resolved_stt_trial_daily integer;
BEGIN
  PERFORM private.require_staff(array['owner', 'administrator', 'product_manager']);

  SELECT slug INTO v_slug FROM public.products WHERE id = p_product_id AND status <> 'deleted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  IF nullif(trim(coalesce(p_default_model, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Default OpenRouter model ID is required.';
  END IF;

  IF p_stt_model IS NOT NULL AND nullif(trim(p_stt_model), '') IS NULL THEN
    RAISE EXCEPTION 'Groq STT model ID cannot be empty.';
  END IF;

  IF coalesce(p_daily_limit, -1) < 0 OR coalesce(p_weekly_limit, -1) < 0
     OR coalesce(p_monthly_limit, -1) < 0 OR coalesce(p_trial_daily_limit, -1) < 0 THEN
    RAISE EXCEPTION 'Usage limits must be 0 or greater.';
  END IF;

  IF (p_stt_daily_limit IS NOT NULL AND p_stt_daily_limit < 0)
     OR (p_stt_weekly_limit IS NOT NULL AND p_stt_weekly_limit < 0)
     OR (p_stt_monthly_limit IS NOT NULL AND p_stt_monthly_limit < 0)
     OR (p_stt_trial_daily_limit IS NOT NULL AND p_stt_trial_daily_limit < 0) THEN
    RAISE EXCEPTION 'STT usage limits must be 0 or greater.';
  END IF;

  IF coalesce(p_max_input_chars, 0) < 1000 THEN
    RAISE EXCEPTION 'Max input characters must be at least 1000.';
  END IF;

  IF coalesce(p_max_output_tokens, 0) NOT BETWEEN 64 AND 32768 THEN
    RAISE EXCEPTION 'Max output tokens must be between 64 and 32768.';
  END IF;

  IF jsonb_typeof(coalesce(p_task_models, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'task_models must be a JSON array.';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(coalesce(p_task_models, '[]'::jsonb))
  LOOP
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each task model entry must be an object.';
    END IF;

    v_task_key := lower(trim(coalesce(v_elem->>'task_key', v_elem->>'taskKey', '')));
    v_model := trim(coalesce(v_elem->>'model', ''));
    IF v_task_key = '' OR v_model = '' THEN
      RAISE EXCEPTION 'Each task model entry requires both task_key and model.';
    END IF;

    v_label := coalesce(nullif(trim(coalesce(v_elem->>'label', '')), ''), v_task_key);
    v_sort := lower(coalesce(v_elem->>'sort', 'latency'));
    IF v_sort NOT IN ('latency', 'price') THEN
      v_sort := 'latency';
    END IF;

    IF coalesce(v_elem->>'max_output_tokens', v_elem->>'maxOutputTokens', '') ~ '^\d+$' THEN
      v_max_out := greatest(64, least(32768, coalesce(v_elem->>'max_output_tokens', v_elem->>'maxOutputTokens')::integer));
    ELSE
      v_max_out := p_max_output_tokens;
    END IF;

    v_vision := coalesce((v_elem->>'allow_vision')::boolean, (v_elem->>'allowVision')::boolean, false);

    v_clean_tasks := v_clean_tasks || jsonb_build_array(jsonb_build_object(
      'task_key', v_task_key,
      'label', v_label,
      'model', v_model,
      'sort', v_sort,
      'max_output_tokens', v_max_out,
      'allow_vision', v_vision
    ));
  END LOOP;

  -- Preserve existing STT settings when called by legacy 11-arg OpenRouter callers
  SELECT
    stt_model,
    groq_fallback_enabled,
    stt_daily_limit,
    stt_weekly_limit,
    stt_monthly_limit,
    stt_trial_daily_limit
  INTO v_existing
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  v_resolved_stt_model := coalesce(
    nullif(trim(p_stt_model), ''),
    v_existing.stt_model,
    'whisper-large-v3-turbo'
  );
  v_resolved_fallback := coalesce(p_groq_fallback_enabled, v_existing.groq_fallback_enabled, false);
  v_resolved_stt_daily := coalesce(p_stt_daily_limit, v_existing.stt_daily_limit, 0);
  v_resolved_stt_weekly := coalesce(p_stt_weekly_limit, v_existing.stt_weekly_limit, 0);
  v_resolved_stt_monthly := coalesce(p_stt_monthly_limit, v_existing.stt_monthly_limit, 0);
  v_resolved_stt_trial_daily := coalesce(p_stt_trial_daily_limit, v_existing.stt_trial_daily_limit, 0);

  INSERT INTO public.agent_ai_policies (
    product_id, ai_enabled, default_model, task_models,
    daily_limit, weekly_limit, monthly_limit, trial_daily_limit,
    max_input_chars, max_output_tokens, enforce_zdr,
    stt_model, groq_fallback_enabled,
    stt_daily_limit, stt_weekly_limit, stt_monthly_limit, stt_trial_daily_limit,
    updated_at, updated_by
  )
  VALUES (
    p_product_id, coalesce(p_ai_enabled, true), trim(p_default_model), v_clean_tasks,
    p_daily_limit, p_weekly_limit, p_monthly_limit, p_trial_daily_limit,
    p_max_input_chars, p_max_output_tokens, coalesce(p_enforce_zdr, true),
    v_resolved_stt_model, v_resolved_fallback,
    v_resolved_stt_daily, v_resolved_stt_weekly, v_resolved_stt_monthly, v_resolved_stt_trial_daily,
    now(), auth.uid()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    ai_enabled = EXCLUDED.ai_enabled,
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
    updated_at = now(),
    updated_by = auth.uid();

  INSERT INTO private.audit_log (actor_id, action, target_id)
  VALUES (auth.uid(), 'product.ai_policy_saved', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_agent_ai_policy(
  uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean,
  text, boolean, integer, integer, integer, integer
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_agent_ai_policy(
  uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean,
  text, boolean, integer, integer, integer, integer
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
