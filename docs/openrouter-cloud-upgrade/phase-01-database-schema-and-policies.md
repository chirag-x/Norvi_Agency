# Phase 1 — Supabase Database Schema, Hidden Limits & Atomic Quota RPC

**Goal:** Create secure, completely hidden database storage for per-agent OpenRouter task model configurations, 1-day / 1-week / 1-month usage limits, and per-license usage tracking.

---

## 1. Security & Privacy Rules (Critical)

1. **Zero Public Exposure:**
   - Public storefront routes like `GET /api/catalog` in `apps/api/live.ts` MUST NOT read or return these fields.
   - Do **not** store daily/weekly/monthly limits inside `products.extended_content`, because `extended_content` is returned publicly by `/api/catalog`.
   - Do **not** embed limits inside the NORVI Lease JWT returned by `/api/agent-auth/activate` or `/api/agent-auth/verify`.
2. **Row Level Security (RLS):**
   - Enable RLS on all new tables with **no `anon` or `customer` `SELECT` policies**.
   - Staff access happens only through `SECURITY DEFINER` RPCs calling `private.require_staff(...)`, matching existing NORVI migrations (`061_agent_extended_content.sql`, etc.).
   - The Netlify backend AI proxy reads and writes using `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Database Tables to Add (New Migration `063_agent_ai_policies.sql`)

### Table A: `public.agent_ai_policies` (One Row per Product / Agent)

Stores all AI routing and hidden limit configuration for current agents (`voro`, `nexus`, `rolvio`) and any future agent created in the website database:

| Column | Type | Default / Constraint | Purpose |
| :--- | :--- | :--- | :--- |
| `product_id` | `uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE` | Required | Links 1:1 to a product in `public.products` |
| `ai_enabled` | `boolean NOT NULL` | `true` | Master kill-switch to pause cloud AI for an agent without revoking licenses |
| `default_model` | `text NOT NULL` | `'google/gemma-4-26b-a4b-it'` | Fallback OpenRouter model ID if a task key is missing or unknown |
| `task_models` | `jsonb NOT NULL` | `'[]'::jsonb` | Array of task-slot objects (see schema below) |
| `daily_limit` | `integer NOT NULL` | `0` (`>= 0`) | Max AI uses per license in rolling 24 hours (`0` = unlimited) |
| `weekly_limit` | `integer NOT NULL` | `0` (`>= 0`) | Max AI uses per license in rolling 7 days (`0` = unlimited) |
| `monthly_limit` | `integer NOT NULL` | `0` (`>= 0`) | Max AI uses per license in rolling 30 days (`0` = unlimited) |
| `trial_daily_limit` | `integer NOT NULL` | `0` (`>= 0`) | Optional stricter 24h cap for trial licenses (`0` = fall back to `daily_limit`) |
| `max_input_chars` | `integer NOT NULL` | `60000` | Safety cap per request so 1 call cannot send an oversized payload |
| `max_output_tokens` | `integer NOT NULL` | `2048` | Default output token ceiling sent to OpenRouter |
| `enforce_zdr` | `boolean NOT NULL` | `true` | Sends `provider: { data_collection: "deny" }` to OpenRouter |
| `updated_at` | `timestamptz NOT NULL` | `now()` | Last updated timestamp |
| `updated_by` | `uuid` | `NULL` | Staff user ID who last edited |

#### `task_models` JSONB Structure (Extensible for Current & Future Agents)

Each entry in `task_models` represents one configurable task slot shown in the Admin Panel's **Agent Releases** card:

```json
[
  {
    "task_key": "voice_text",
    "label": "Voice / Interview Q&A Text",
    "model": "google/gemma-4-26b-a4b-it",
    "sort": "latency",
    "max_output_tokens": 1800,
    "allow_vision": false
  },
  {
    "task_key": "coding",
    "label": "Live Coding / Algorithms",
    "model": "google/gemma-4-31b-it",
    "sort": "latency",
    "max_output_tokens": 2200,
    "allow_vision": false
  },
  {
    "task_key": "vision",
    "label": "Screen Vision / Screenshot OCR",
    "model": "google/gemma-4-31b-it",
    "sort": "latency",
    "max_output_tokens": 2200,
    "allow_vision": true
  }
]
```

**Why JSONB array instead of fixed columns?**  
When you create a new agent in the future (e.g., Agent #4 with tasks `research`, `summary`, `vision`), you do **not** need a SQL migration — you just add its task rows directly from the Admin Panel UI.

---

### Table B: `public.agent_ai_usage_logs` (Usage Ledger & Cost Analytics)

Records every AI request made through the `/api/agent-ai` proxy for rolling 1-day / 1-week / 1-month enforcement and admin cost analytics:

| Column | Type | Purpose |
| :--- | :--- | :--- |
| `id` | `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | Fast sequential key |
| `license_id` | `uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE` | Tracks consumption per license |
| `product_id` | `uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE` | Tracks consumption per agent |
| `device_id` | `text` | Hardware installation ID from Lease JWT |
| `task_key` | `text NOT NULL` | e.g. `voice_text`, `vision`, `clip_analysis`, `job_match` |
| `model_used` | `text NOT NULL` | Actual OpenRouter model ID executed |
| `prompt_tokens` | `integer NOT NULL DEFAULT 0` | Filled asynchronously after OpenRouter responds |
| `completion_tokens` | `integer NOT NULL DEFAULT 0` | Filled asynchronously after OpenRouter responds |
| `estimated_cost_usd` | `numeric(12, 6) NOT NULL DEFAULT 0` | OpenRouter cost reported or calculated |
| `status` | `text NOT NULL DEFAULT 'reserved'` | `'reserved'`, `'completed'`, `'failed'` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Indexed for fast 24h / 7d / 30d window counts |

**Indexes:**
- `CREATE INDEX idx_agent_ai_usage_license_created ON public.agent_ai_usage_logs (license_id, created_at DESC);`
- `CREATE INDEX idx_agent_ai_usage_product_created ON public.agent_ai_usage_logs (product_id, created_at DESC);`

---

## 3. Atomic SQL Functions (RPCs)

### A. `public.consume_agent_ai_quota(...)` (Called by Netlify AI Proxy)

Why atomic in Postgres? If a user triggers 5 parallel requests (or shares a lease before revocation), checking and inserting in one row-locked transaction prevents race conditions.

1. Lock or fetch `public.licenses` row for `p_license_id`:
   - Reject if missing, `status != 'active'`, or `expires_at <= now()`.
   - If `p_device_id` provided, verify device exists in `public.devices` with `active = true`.
   - Determine if license is a trial license (check license source/order/trial flag in existing schema).
2. Fetch `public.agent_ai_policies` for `p_product_id` (if none exists yet, use safe defaults).
   - Reject if `ai_enabled = false`.
3. Acquire a lightweight advisory transaction lock (`pg_advisory_xact_lock(hashtext(p_license_id::text))`) so concurrent calls from the same license serialize cleanly in ~1ms.
4. Count non-failed rows in `public.agent_ai_usage_logs` for `p_license_id`:
   - `v_day_count` (`created_at >= now() - interval '24 hours'`)
   - `v_week_count` (`created_at >= now() - interval '7 days'`)
   - `v_month_count` (`created_at >= now() - interval '30 days'`)
5. Check limits:
   - Effective daily limit = `trial_daily_limit` if trial & `trial_daily_limit > 0`, else `daily_limit`.
   - If `effective_daily > 0` and `v_day_count >= effective_daily` → return `{ allowed: false, reason: 'cooldown' }`.
   - If `weekly_limit > 0` and `v_week_count >= weekly_limit` → return `{ allowed: false, reason: 'cooldown' }`.
   - If `monthly_limit > 0` and `v_month_count >= monthly_limit` → return `{ allowed: false, reason: 'cooldown' }`.
   - *(Notice: never return numeric counts or limit thresholds to the client!)*
6. Resolve `task_key` against `task_models` JSONB (or fall back to `default_model`), insert a `'reserved'` row in `agent_ai_usage_logs`, and return `{ allowed: true, usage_log_id, model, sort, max_output_tokens, max_input_chars, enforce_zdr, allow_vision }`.

### B. `public.finalize_agent_ai_usage(p_usage_log_id, p_status, p_prompt_tokens, p_completion_tokens, p_cost_usd)`

- Updates the `'reserved'` log row after OpenRouter finishes (`'completed'` or `'failed'`).
- Note: if OpenRouter fails before returning a response (upstream `5xx`), marking it `'failed'` ensures failed upstream attempts don't unfairly consume the customer's daily/weekly/monthly quota.

### C. Staff Admin RPCs (Called by `apps/api/live.ts`)

1. `public.admin_get_agent_ai_policies()`:
   - Calls `private.require_staff(array['owner','administrator','product_manager'])`.
   - Returns all products' policies + 24h / 7d / 30d total request & cost aggregates for Admin visibility.
2. `public.admin_upsert_agent_ai_policy(...)`:
   - Calls `private.require_staff(array['owner','administrator','product_manager'])`.
   - Validates `daily_limit >= 0`, `weekly_limit >= 0`, `monthly_limit >= 0`, `trial_daily_limit >= 0`, and non-empty `default_model` + valid `task_models` entries.
   - Upserts `public.agent_ai_policies` and logs an entry in `private.audit_log` (`'product.ai_policy_saved'`).

---

## 4. Seed Defaults for Existing Agents

Migration `063` will seed initial rows in `agent_ai_policies` for existing products by slug (`voro`, `nexus`, `rolvio`) if present:
- **`voro`**: `voice_text`, `coding`, `vision`
- **`nexus`**: `clip_analysis`, `social_copy`
- **`rolvio`**: `job_match`, `form_answer`, `email_classify`, `resume_parse`

---

## 5. Phase 1 Acceptance Criteria

- [ ] Migration `063_agent_ai_policies.sql` applies cleanly on Supabase.
- [ ] `GET /api/catalog` output is verified to contain **zero** new AI policy or limit fields.
- [ ] Anonymous / customer Supabase roles cannot read `agent_ai_policies` or `agent_ai_usage_logs` directly.
- [ ] Concurrent calls to `consume_agent_ai_quota` strictly enforce `daily_limit`, `weekly_limit`, and `monthly_limit` without race-condition bypasses.
