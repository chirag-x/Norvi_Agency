-- 074_agent_ai_policy_key_assignment.sql
-- Phase 13: Per-Agent Dedicated AI Key Assignment & Multi-Key Isolation
-- Allows assigning specific encrypted OpenRouter API keys to individual agents (Voro, Rolvio, Nexus & future agents)
-- with automatic cascading fallback to the Global Active Key if unset or deleted.

-- 1. Add ai_key_id column to public.agent_ai_policies
ALTER TABLE public.agent_ai_policies
  ADD COLUMN IF NOT EXISTS ai_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_ai_policies_ai_key_id ON public.agent_ai_policies (ai_key_id);

-- 2. Update admin_get_agent_ai_policies() to include aiKeyId, aiKeyLabel, aiKeySuffix
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
  LEFT JOIN public.admin_ai_keys ak ON ak.id = ap.ai_key_id
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

-- 3. Update admin_upsert_agent_ai_policy to accept p_ai_key_id
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
  p_stt_trial_daily_limit integer DEFAULT NULL,
  p_ai_key_id uuid DEFAULT NULL
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
  v_resolved_ai_key_id uuid;
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
    RAISE EXCEPTION 'STT model cannot be empty if specified.';
  END IF;

  IF p_task_models IS NOT NULL AND jsonb_typeof(p_task_models) = 'array' THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_task_models) LOOP
      v_task_key := lower(trim(coalesce(v_elem->>'task_key', v_elem->>'taskKey', '')));
      IF length(v_task_key) = 0 THEN
        CONTINUE;
      END IF;

      v_model := trim(coalesce(v_elem->>'model', ''));
      IF length(v_model) = 0 THEN
        v_model := trim(p_default_model);
      END IF;

      v_label := trim(coalesce(v_elem->>'label', v_task_key));
      v_sort := lower(trim(coalesce(v_elem->>'sort', 'latency')));
      IF v_sort NOT IN ('latency', 'price') THEN
        v_sort := 'latency';
      END IF;

      v_max_out := coalesce((v_elem->>'max_output_tokens')::integer, (v_elem->>'maxOutputTokens')::integer, p_max_output_tokens);
      IF v_max_out < 64 OR v_max_out > 32768 THEN
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
  END IF;

  -- Load existing policy to preserve unspecified STT and key settings
  SELECT * INTO v_existing
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  v_resolved_stt_model := coalesce(
    nullif(trim(p_stt_model), ''),
    v_existing.stt_model,
    'whisper-large-v3-turbo'
  );

  v_resolved_fallback := coalesce(
    p_groq_fallback_enabled,
    v_existing.groq_fallback_enabled,
    false
  );

  v_resolved_stt_daily := coalesce(p_stt_daily_limit, v_existing.stt_daily_limit, 0);
  v_resolved_stt_weekly := coalesce(p_stt_weekly_limit, v_existing.stt_weekly_limit, 0);
  v_resolved_stt_monthly := coalesce(p_stt_monthly_limit, v_existing.stt_monthly_limit, 0);
  v_resolved_stt_trial_daily := coalesce(p_stt_trial_daily_limit, v_existing.stt_trial_daily_limit, 0);
  v_resolved_ai_key_id := p_ai_key_id;

  -- Verify key exists if provided
  IF v_resolved_ai_key_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.admin_ai_keys WHERE id = v_resolved_ai_key_id) THEN
      v_resolved_ai_key_id := NULL;
    END IF;
  END IF;

  INSERT INTO public.agent_ai_policies (
    product_id, ai_enabled, default_model, task_models,
    daily_limit, weekly_limit, monthly_limit, trial_daily_limit,
    max_input_chars, max_output_tokens, enforce_zdr,
    stt_model, groq_fallback_enabled,
    stt_daily_limit, stt_weekly_limit, stt_monthly_limit, stt_trial_daily_limit,
    ai_key_id,
    updated_at, updated_by
  )
  VALUES (
    p_product_id, coalesce(p_ai_enabled, true), trim(p_default_model), v_clean_tasks,
    p_daily_limit, p_weekly_limit, p_monthly_limit, p_trial_daily_limit,
    p_max_input_chars, p_max_output_tokens, coalesce(p_enforce_zdr, true),
    v_resolved_stt_model, v_resolved_fallback,
    v_resolved_stt_daily, v_resolved_stt_weekly, v_resolved_stt_monthly, v_resolved_stt_trial_daily,
    v_resolved_ai_key_id,
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
    ai_key_id = EXCLUDED.ai_key_id,
    updated_at = now(),
    updated_by = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean, text, boolean, integer, integer, integer, integer, uuid) TO authenticated;

-- 4. Update consume_agent_ai_quota to return ai_key_id
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
  v_suspended boolean := false;
  v_device record;
  v_policy record;
  v_has_policy boolean := false;
  v_task_elem jsonb;
  v_model text;
  v_sort text := 'latency';
  v_max_input_chars integer := 60000;
  v_max_output_tokens integer := 2048;
  v_enforce_zdr boolean := true;
  v_allow_vision boolean := false;
  v_usage_log_id bigint;
  v_effective_daily integer;
  v_day_count integer;
  v_week_count integer;
  v_month_count integer;
  v_clean_task text := lower(trim(coalesce(p_task_key, 'default')));
BEGIN
  -- 1. Validate license exists and is active
  SELECT l.id, l.user_id, l.product_id, l.status, l.duration
  INTO v_license
  FROM public.licenses l
  WHERE l.id = p_license_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'status_code', 404, 'reason', 'license_not_found', 'error', 'License not found.');
  END IF;

  IF v_license.status <> 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'status_code', 403, 'reason', 'license_inactive', 'error', 'License is ' || v_license.status || '.');
  END IF;

  IF v_license.product_id <> p_product_id THEN
    RETURN jsonb_build_object('allowed', false, 'status_code', 403, 'reason', 'product_mismatch', 'error', 'License does not grant access to this agent.');
  END IF;

  -- 2. Verify customer account status
  SELECT suspended INTO v_suspended
  FROM public.profiles
  WHERE id = v_license.user_id;

  IF coalesce(v_suspended, false) THEN
    RETURN jsonb_build_object('allowed', false, 'status_code', 403, 'reason', 'account_suspended', 'error', 'Account access is suspended.');
  END IF;

  -- 3. Verify hardware device authorization & timed ban status
  IF p_device_id IS NOT NULL AND length(trim(p_device_id)) > 0 THEN
    SELECT id, is_active, banned_until INTO v_device
    FROM public.devices
    WHERE license_id = v_license.id
      AND device_id = trim(p_device_id);

    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'status_code', 403, 'reason', 'device_not_registered', 'error', 'Device is not bound to this license.');
    END IF;

    IF v_device.banned_until IS NOT NULL AND v_device.banned_until > now() THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_banned',
        'error', 'Device access temporarily suspended until ' || to_char(v_device.banned_until, 'YYYY-MM-DD HH24:MI:SS UTC') || '.'
      );
    END IF;

    IF NOT coalesce(v_device.is_active, true) THEN
      RETURN jsonb_build_object('allowed', false, 'status_code', 403, 'reason', 'device_inactive', 'error', 'Device has been deactivated or disconnected.');
    END IF;
  END IF;

  -- 4. Load AI policy for product
  SELECT * INTO v_policy
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  v_has_policy := FOUND;

  IF v_has_policy AND NOT v_policy.ai_enabled THEN
    RETURN jsonb_build_object('allowed', false, 'status_code', 503, 'reason', 'ai_disabled', 'error', 'AI capabilities are temporarily paused for this agent.');
  END IF;

  -- Resolve model for task
  IF v_has_policy THEN
    v_model := v_policy.default_model;
    v_max_input_chars := v_policy.max_input_chars;
    v_max_output_tokens := v_policy.max_output_tokens;
    v_enforce_zdr := v_policy.enforce_zdr;

    IF v_policy.task_models IS NOT NULL AND jsonb_typeof(v_policy.task_models) = 'array' THEN
      FOR v_task_elem IN SELECT * FROM jsonb_array_elements(v_policy.task_models) LOOP
        IF lower(trim(coalesce(v_task_elem->>'task_key', ''))) = v_clean_task THEN
          v_model := coalesce(nullif(trim(v_task_elem->>'model'), ''), v_model);
          v_sort := coalesce(nullif(trim(v_task_elem->>'sort'), ''), v_sort);
          v_max_output_tokens := coalesce((v_task_elem->>'max_output_tokens')::integer, v_max_output_tokens);
          v_allow_vision := coalesce((v_task_elem->>'allow_vision')::boolean, false);
          EXIT;
        END IF;
      END LOOP;
    END IF;
  ELSE
    v_model := 'google/gemma-4-26b-a4b-it';
  END IF;

  -- 5. Hidden per-license limits
  IF v_has_policy THEN
    v_effective_daily := v_policy.daily_limit;
    IF v_license.duration = '1_day' AND v_policy.trial_daily_limit > 0 THEN
      v_effective_daily := v_policy.trial_daily_limit;
    END IF;

    IF v_effective_daily > 0 OR v_policy.weekly_limit > 0 OR v_policy.monthly_limit > 0 THEN
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        count(*)
      INTO v_day_count, v_week_count, v_month_count
      FROM public.agent_ai_usage_logs
      WHERE license_id = v_license.id
        AND status IN ('reserved', 'completed')
        AND created_at >= now() - interval '30 days';

      IF (v_effective_daily > 0 AND v_day_count >= v_effective_daily)
         OR (v_policy.weekly_limit > 0 AND v_week_count >= v_policy.weekly_limit)
         OR (v_policy.monthly_limit > 0 AND v_month_count >= v_policy.monthly_limit)
      THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'cooldown',
          'error', 'Temporary AI cooldown active due to high usage. Please try again later.'
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.agent_ai_usage_logs (license_id, product_id, device_id, task_key, model_used, status)
  VALUES (v_license.id, p_product_id, nullif(trim(coalesce(p_device_id, '')), ''), v_task_key, v_model, 'reserved')
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
    'ai_key_id', v_policy.ai_key_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) TO service_role;
