# Phase 1 — Supabase Database Schema, Hidden STT Quotas & Admin RPCs

**Goal:** Extend Supabase Postgres cleanly so every agent stores its centralized **Groq STT model**, **NORVI Fallback Groq Key Enable/Disable toggle**, and **dedicated hidden 1-Day / 1-Week / 1-Month / Free Trial 1-Day STT fallback limits** completely separated from OpenRouter usage counters and never exposed to public or customer RLS policies.

---

## 1. Current Database Baseline

- Existing migration: `supabase/migrations/063_agent_ai_policies.sql`
  - Table `public.agent_ai_policies` (keyed `1:1` by `product_id` -> `products(id)`).
  - Table `public.agent_ai_usage_logs` (tracks OpenRouter `reserved` / `completed` / `failed` calls).
  - RPCs:
    - `public.consume_agent_ai_quota(p_license_id, p_product_id, p_device_id, p_task_key)`
    - `public.finalize_agent_ai_usage(...)`
    - `public.admin_get_agent_ai_policies()`
    - `public.admin_upsert_agent_ai_policy(...)`

> **Critical Design Separation:** Do **not** mix Groq STT fallback logs into `agent_ai_usage_logs`. OpenRouter quota counts rows in `agent_ai_usage_logs`; keeping a separate `public.agent_stt_usage_logs` table guarantees Groq STT fallback calls never consume OpenRouter chat/vision limits and OpenRouter calls never consume Groq STT limits.

---

## 2. Planned Migration: `supabase/migrations/064_agent_stt_policies.sql`

### A. Extend `public.agent_ai_policies`
Add columns with safe idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:
- `stt_model text NOT NULL DEFAULT 'whisper-large-v3-turbo'` (`CHECK (length(trim(stt_model)) > 0)`)
- `groq_fallback_enabled boolean NOT NULL DEFAULT false` *(starts `false` until explicitly turned ON per agent in `/admin/releases`, or toggled ON immediately for Voro/Nexus in admin UI)*
- `stt_daily_limit integer NOT NULL DEFAULT 0 CHECK (stt_daily_limit >= 0)` *(Paid/default 24h fallback request cap; `0 = unlimited`)*
- `stt_weekly_limit integer NOT NULL DEFAULT 0 CHECK (stt_weekly_limit >= 0)` *(Paid/default rolling 7-day cap; `0 = unlimited`)*
- `stt_monthly_limit integer NOT NULL DEFAULT 0 CHECK (stt_monthly_limit >= 0)` *(Paid/default rolling 30-day cap; `0 = unlimited`)*
- `stt_trial_daily_limit integer NOT NULL DEFAULT 0 CHECK (stt_trial_daily_limit >= 0)` *(1-day trial 24h fallback cap; `0 = inherits stt_daily_limit`, matching OpenRouter behavior)*

### B. Dedicated Private Ledger: `public.agent_stt_usage_logs`
Create table locked strictly to `service_role` (`ENABLE ROW LEVEL SECURITY`, `REVOKE ALL FROM public, anon, authenticated`, `GRANT ALL TO service_role`):
- `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
- `license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE`
- `product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE`
- `device_id text`
- `model_used text NOT NULL`
- `audio_bytes integer NOT NULL DEFAULT 0 CHECK (audio_bytes >= 0)`
- `audio_seconds numeric(10, 2) NOT NULL DEFAULT 0 CHECK (audio_seconds >= 0)`
- `status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'failed'))`
- `created_at timestamptz NOT NULL DEFAULT now()`
- Indexes:
  - `(license_id, created_at DESC)` — fast per-license 24h / 7d / 30d window counting
  - `(product_id, created_at DESC)` — fast per-agent Admin dashboard stats aggregation

### C. Authenticated Config Lookup RPC: `public.get_agent_stt_policy(...)`
- Parameters: `(p_license_id uuid, p_product_id uuid, p_device_id text DEFAULT NULL)`
- `SECURITY DEFINER`, `service_role` only.
- Verifies license exists, belongs to `p_product_id`, is `active`, is not suspended, has not expired, and device (`p_device_id`) is active & not revoked (using the exact same license/device validation checks as `consume_agent_ai_quota` in `063_agent_ai_policies.sql`).
- Returns **only safe config** (never exposes `stt_daily_limit`, `stt_weekly_limit`, `stt_monthly_limit`, or `stt_trial_daily_limit`):
  ```json
  {
    "allowed": true,
    "stt_model": "whisper-large-v3-turbo",
    "fallback_enabled": true
  }
  ```

### D. Atomic Fallback Reservation RPC: `public.consume_agent_stt_quota(...)`
- Parameters: `(p_license_id uuid, p_product_id uuid, p_device_id text DEFAULT NULL, p_audio_bytes integer DEFAULT 0)`
- `SECURITY DEFINER`, `service_role` only.
- Steps inside one transaction:
  1. Verify active license + expiry + suspension + bound device (`device_id`).
  2. Load `agent_ai_policies` row for `p_product_id`.
  3. Confirm `coalesce(v_policy.groq_fallback_enabled, false)` is `true` — otherwise return:
     `{"allowed": false, "status_code": 403, "reason": "stt_fallback_disabled", "error": "Cloud Speech fallback is currently disabled for this agent. Add your own free Groq API key or use Offline Whisper in Settings."}`
  4. Detect whether license is a **1-day free trial** using the exact same `orders.provider_payment_id LIKE 'trial_%'` (without paid renewal) check as `063_agent_ai_policies.sql:220-230`.
  5. Resolve effective 24h limit (`stt_trial_daily_limit > 0` for trials, else `stt_daily_limit`).
  6. Count `agent_stt_usage_logs` (`status IN ('reserved', 'completed')`) over `24 hours`, `7 days`, `30 days`.
  7. Enforce 1-Day, 1-Week, and 1-Month limits symmetrically. When exceeded, return HTTP `429` with a non-numeric cooldown message (`"Temporary speech transcription cooldown active due to high usage. Add your own free Groq API key in Settings or try again later."`) — **never revealing exact cap numbers**.
  8. Insert `'reserved'` row into `agent_stt_usage_logs` and return:
     `{"allowed": true, "usage_log_id": ..., "stt_model": v_stt_model}`.

### E. Usage Finalization RPC: `public.finalize_agent_stt_usage(...)`
- Parameters: `(p_usage_log_id bigint, p_status text, p_audio_seconds numeric DEFAULT 0)` (`service_role` only).
- Updates `status` (`'completed'` or `'failed'`) and `audio_seconds` asynchronously via `waitUntil` after Groq returns.

### F. Update Staff Admin RPCs
1. Update `public.admin_get_agent_ai_policies()`:
   - Include `sttModel`, `groqFallbackEnabled`, `sttDailyLimit`, `sttWeeklyLimit`, `sttMonthlyLimit`, `sttTrialDailyLimit`.
   - Include aggregated STT fallback telemetry inside `stats`:
     `sttRequests24h`, `sttRequests7d`, `sttRequests30d`, `sttAudioMinutes30d`.
2. Update `public.admin_upsert_agent_ai_policy(...)`:
   - Accept optional default parameters (`p_stt_model`, `p_groq_fallback_enabled`, `p_stt_daily_limit`, `p_stt_weekly_limit`, `p_stt_monthly_limit`, `p_stt_trial_daily_limit`) so existing callers stay backward-compatible and new admin saves update both OpenRouter and Groq STT policy fields atomically in one click.

---

## 3. Security Verification Checklist for Phase 1
- `REVOKE ALL` verified on `agent_stt_usage_logs` and all `service_role` functions (`consume_agent_stt_quota`, `finalize_agent_stt_usage`, `get_agent_stt_policy`).
- `admin_get_agent_ai_policies` and `admin_upsert_agent_ai_policy` continue calling `PERFORM private.require_staff(array['owner', 'administrator', 'product_manager'])`.
- Hidden STT limit numbers never appear in public tables, views, or `/api/catalog`.
