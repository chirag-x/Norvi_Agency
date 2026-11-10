-- 063_agent_ai_policies.sql
-- Phase 1 (OpenRouter Cloud Upgrade):
-- Private server-side storage for per-agent OpenRouter task model mappings,
-- hidden 1-day / 1-week / 1-month per-license usage limits, and atomic quota/cost tracking.
-- Never exposed via public /api/catalog or customer RLS policies.

BEGIN;

-- 1. Private AI policy configuration table (1:1 per product/agent)
CREATE TABLE IF NOT EXISTS public.agent_ai_policies (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  ai_enabled boolean NOT NULL DEFAULT true,
  default_model text NOT NULL DEFAULT 'google/gemma-4-26b-a4b-it' CHECK (length(trim(default_model)) > 0),
  task_models jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(task_models) = 'array'),
  daily_limit integer NOT NULL DEFAULT 0 CHECK (daily_limit >= 0),
  weekly_limit integer NOT NULL DEFAULT 0 CHECK (weekly_limit >= 0),
  monthly_limit integer NOT NULL DEFAULT 0 CHECK (monthly_limit >= 0),
  trial_daily_limit integer NOT NULL DEFAULT 0 CHECK (trial_daily_limit >= 0),
  max_input_chars integer NOT NULL DEFAULT 60000 CHECK (max_input_chars >= 1000),
  max_output_tokens integer NOT NULL DEFAULT 2048 CHECK (max_output_tokens BETWEEN 64 AND 32768),
  enforce_zdr boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- 2. Private per-request usage & cost ledger
CREATE TABLE IF NOT EXISTS public.agent_ai_usage_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  device_id text,
  task_key text NOT NULL,
  model_used text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_ai_usage_license_created
  ON public.agent_ai_usage_logs (license_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_ai_usage_product_created
  ON public.agent_ai_usage_logs (product_id, created_at DESC);

-- 3. Strict RLS & privilege lockdown (zero anon/customer access)
ALTER TABLE public.agent_ai_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_ai_usage_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.agent_ai_policies, public.agent_ai_usage_logs FROM public, anon, authenticated;
GRANT ALL ON public.agent_ai_policies, public.agent_ai_usage_logs TO service_role;

-- 4. Atomic quota check + reservation + model resolution RPC (Edge Function / service_role only)
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
  v_task_key text;
  v_task_match jsonb;
  v_model text;
  v_sort text := 'latency';
  v_max_output_tokens integer := 2048;
  v_max_input_chars integer := 60000;
  v_enforce_zdr boolean := true;
  v_allow_vision boolean := true;
  v_is_trial boolean := false;
  v_effective_daily integer := 0;
  v_day_count integer := 0;
  v_week_count integer := 0;
  v_month_count integer := 0;
  v_usage_log_id bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_license_id IS NULL OR p_product_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_invalid',
      'error', 'License is invalid.'
    );
  END IF;

  -- Serialize concurrent requests for the same license to prevent quota races
  PERFORM pg_advisory_xact_lock(hashtext(p_license_id::text));

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

  -- Load agent AI policy (fallback safely to defaults if unconfigured)
  SELECT * INTO v_policy
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  v_has_policy := FOUND;

  IF v_has_policy AND NOT v_policy.ai_enabled THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 503,
      'reason', 'ai_disabled',
      'error', 'Cloud AI is currently disabled for this agent.'
    );
  END IF;

  v_task_key := lower(coalesce(nullif(trim(p_task_key), ''), 'default'));

  IF v_has_policy THEN
    v_model := v_policy.default_model;
    v_max_input_chars := v_policy.max_input_chars;
    v_max_output_tokens := v_policy.max_output_tokens;
    v_enforce_zdr := v_policy.enforce_zdr;

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
  ELSE
    v_model := 'google/gemma-4-26b-a4b-it';
  END IF;

  -- Determine whether this license is currently an un-upgraded free trial
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

  IF v_has_policy THEN
    IF v_is_trial AND v_policy.trial_daily_limit > 0 THEN
      v_effective_daily := v_policy.trial_daily_limit;
    ELSE
      v_effective_daily := v_policy.daily_limit;
    END IF;

    IF v_effective_daily > 0 OR v_policy.weekly_limit > 0 OR v_policy.monthly_limit > 0 THEN
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        count(*) FILTER (WHERE created_at >= now() - interval '30 days')
      INTO v_day_count, v_week_count, v_month_count
      FROM public.agent_ai_usage_logs
      WHERE license_id = v_license.id
        AND status IN ('reserved', 'completed')
        AND created_at >= now() - interval '30 days';

      IF (v_effective_daily > 0 AND v_day_count >= v_effective_daily)
         OR (v_policy.weekly_limit > 0 AND v_week_count >= v_policy.weekly_limit)
         OR (v_policy.monthly_limit > 0 AND v_month_count >= v_policy.monthly_limit)
      THEN
        -- Intentionally return a non-numeric cooldown message so hidden limits are never leaked
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
    'allow_vision', v_allow_vision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) TO service_role;

-- 5. Finalize token usage & OpenRouter cost asynchronously (service_role only)
CREATE OR REPLACE FUNCTION public.finalize_agent_ai_usage(
  p_usage_log_id bigint,
  p_status text,
  p_prompt_tokens integer DEFAULT 0,
  p_completion_tokens integer DEFAULT 0,
  p_estimated_cost_usd numeric DEFAULT 0
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

  UPDATE public.agent_ai_usage_logs
  SET
    status = p_status,
    prompt_tokens = greatest(0, coalesce(p_prompt_tokens, 0)),
    completion_tokens = greatest(0, coalesce(p_completion_tokens, 0)),
    estimated_cost_usd = greatest(0, coalesce(p_estimated_cost_usd, 0))
  WHERE id = p_usage_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_agent_ai_usage(bigint, text, integer, integer, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_agent_ai_usage(bigint, text, integer, integer, numeric) TO service_role;

-- 6. Staff Admin RPC: List AI policies + aggregated usage stats across all agents
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
    'updatedAt', ap.updated_at,
    'stats', jsonb_build_object(
      'requests24h', coalesce(st.req_24h, 0),
      'requests7d', coalesce(st.req_7d, 0),
      'requests30d', coalesce(st.req_30d, 0),
      'cost30dUsd', coalesce(st.cost_30d, 0)
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
  WHERE p.status <> 'deleted';

  RETURN jsonb_build_object('items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_agent_ai_policies() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_agent_ai_policies() TO authenticated;

-- 7. Staff Admin RPC: Upsert AI policy & per-task OpenRouter models for an agent
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
  p_enforce_zdr boolean DEFAULT true
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
BEGIN
  PERFORM private.require_staff(array['owner', 'administrator', 'product_manager']);

  SELECT slug INTO v_slug FROM public.products WHERE id = p_product_id AND status <> 'deleted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  IF nullif(trim(coalesce(p_default_model, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Default OpenRouter model ID is required.';
  END IF;

  IF coalesce(p_daily_limit, -1) < 0 OR coalesce(p_weekly_limit, -1) < 0
     OR coalesce(p_monthly_limit, -1) < 0 OR coalesce(p_trial_daily_limit, -1) < 0 THEN
    RAISE EXCEPTION 'Usage limits must be 0 or greater.';
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

  INSERT INTO public.agent_ai_policies (
    product_id, ai_enabled, default_model, task_models,
    daily_limit, weekly_limit, monthly_limit, trial_daily_limit,
    max_input_chars, max_output_tokens, enforce_zdr,
    updated_at, updated_by
  )
  VALUES (
    p_product_id, coalesce(p_ai_enabled, true), trim(p_default_model), v_clean_tasks,
    p_daily_limit, p_weekly_limit, p_monthly_limit, p_trial_daily_limit,
    p_max_input_chars, p_max_output_tokens, coalesce(p_enforce_zdr, true),
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
    updated_at = now(),
    updated_by = auth.uid();

  INSERT INTO private.audit_log (actor_id, action, target_id)
  VALUES (auth.uid(), 'product.ai_policy_saved', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_agent_ai_policy(uuid, boolean, text, jsonb, integer, integer, integer, integer, integer, integer, boolean) TO authenticated;

-- 8. Seed initial OpenRouter task-model configurations for existing agents (idempotent)
INSERT INTO public.agent_ai_policies (
  product_id, ai_enabled, default_model, task_models,
  daily_limit, weekly_limit, monthly_limit, trial_daily_limit,
  max_input_chars, max_output_tokens, enforce_zdr
)
SELECT
  id,
  true,
  'google/gemma-4-26b-a4b-it',
  '[
    {"task_key":"voice_text","label":"Voro Voice / Interview Q&A Text","model":"google/gemma-4-26b-a4b-it","sort":"latency","max_output_tokens":1800,"allow_vision":false},
    {"task_key":"coding","label":"Voro Live Coding / Algorithms","model":"google/gemma-4-31b-it","sort":"latency","max_output_tokens":2200,"allow_vision":false},
    {"task_key":"vision","label":"Voro Screen Vision / Screenshot OCR","model":"google/gemma-4-31b-it","sort":"latency","max_output_tokens":2200,"allow_vision":true}
  ]'::jsonb,
  0, 0, 0, 0,
  60000, 2048, true
FROM public.products WHERE slug = 'voro'
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.agent_ai_policies (
  product_id, ai_enabled, default_model, task_models,
  daily_limit, weekly_limit, monthly_limit, trial_daily_limit,
  max_input_chars, max_output_tokens, enforce_zdr
)
SELECT
  id,
  true,
  'google/gemma-4-26b-a4b-it',
  '[
    {"task_key":"clip_analysis","label":"Nexus Long Transcript Clip Analysis","model":"google/gemma-4-26b-a4b-it","sort":"price","max_output_tokens":4096,"allow_vision":false},
    {"task_key":"social_copy","label":"Nexus Titles, Captions & Hashtags","model":"google/gemma-4-26b-a4b-it","sort":"price","max_output_tokens":1024,"allow_vision":false}
  ]'::jsonb,
  0, 0, 0, 0,
  180000, 4096, true
FROM public.products WHERE slug = 'nexus'
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.agent_ai_policies (
  product_id, ai_enabled, default_model, task_models,
  daily_limit, weekly_limit, monthly_limit, trial_daily_limit,
  max_input_chars, max_output_tokens, enforce_zdr
)
SELECT
  id,
  true,
  'google/gemma-4-26b-a4b-it',
  '[
    {"task_key":"job_match","label":"Rolvio ATS Job Match Scoring","model":"google/gemma-4-26b-a4b-it","sort":"price","max_output_tokens":1024,"allow_vision":false},
    {"task_key":"form_answer","label":"Rolvio Screening Form Answers","model":"google/gemma-4-26b-a4b-it","sort":"price","max_output_tokens":1024,"allow_vision":false},
    {"task_key":"email_classify","label":"Rolvio Recruiter Email Classifier","model":"google/gemma-4-26b-a4b-it","sort":"price","max_output_tokens":256,"allow_vision":false},
    {"task_key":"resume_parse","label":"Rolvio Resume Parser","model":"google/gemma-4-26b-a4b-it","sort":"price","max_output_tokens":2048,"allow_vision":false}
  ]'::jsonb,
  0, 0, 0, 0,
  80000, 2048, true
FROM public.products WHERE slug = 'rolvio'
ON CONFLICT (product_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
