# Phase 15: Dual-Tier AI Isolation, License Duration Expansion & Coupon Infrastructure

## Executive Summary
Phase 15 builds the foundational dual-tier commercial and AI architecture for NORVI Agency. 
It establishes a clean server-side separation between **Paid Customers** (who receive premium high-speed models, task-specific model routing, and dedicated paid API keys) and **Free Trial Users** (who receive a single community trial model, dedicated budget/trial API keys, and dynamic fair-use caps).

Additionally, this phase expands the core license duration taxonomy to introduce a **1-Week Paid License** (`1_week`) and dedicated **Gift / Promo Free Trial Licenses** (`1_week_trial` and `1_month_trial`), fully integrated into the Admin Gift Modal, the Promotions Coupon Engine, and hardware anti-abuse protection.

---

## 1. Core Architectural Pillars

### 1.1 Dual-Tier AI Separation (Zero Credit Bleed)
* **Dedicated Upstream Trial API Key (`trial_ai_key_id`):** 
  * Administrators can assign a specific OpenRouter API key for free trials (e.g. free-tier or budget key) or inherit the active default.
  * Free trial activity is strictly partitioned from paid accounts, preventing unexpected paid credit consumption.
* **Single Trial Model Architecture:**
  * Free trial users route through **one single default trial model** (e.g. `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`).
  * No per-task overrides for trials. All tasks (voice, coding, vision) in trial mode route through this single model.
  * **Task-specific model assignment remains an exclusive Paid Customer perk** (e.g. Gemma 31B for coding, Gemma 26B for voice).
* **Configurable Daily Trial Limit (`trial_daily_limit`):**
  * Fully editable number input per agent in `/admin/releases` (e.g. 20, 50, 100 requests/24h). Never hardcoded.
* **Explicit Manual Zero Data Retention (ZDR) Control:**
  * No automatic background overrides. Administrators retain 100% manual control over the `Enforce ZDR` toggle (`data_collection: "deny"`).
  * If the administrator selects a `:free` model while ZDR is checked, the UI displays a clear advisory warning explaining that OpenRouter free endpoints do not support ZDR, allowing the admin to decide whether to uncheck ZDR or switch to a paid model slug.

### 1.2 Direct License Classification & Strict Access Boundaries
* `public.licenses` stores a direct boolean column `is_trial boolean NOT NULL DEFAULT false`.
* **Public Claim Boundary:** Normal public users on the website can **only claim the 1-Day Free Trial** (`1_day`), and only when `1-Day Free Trial` is set to `Active` on that agent in `/admin/releases`. If disabled, no public trial can be claimed.
* **Exclusive Gift & Coupon Durations:** `1_week_trial` and `1_month_trial` are **never** publicly claimable on the website. They can **only** be issued by:
  1. An Administrator via the **Gift License** modal.
  2. A user redeeming an authorized promo/coupon code explicitly created for that trial duration.
* **Sub-Millisecond Lease Verification:** When desktop agents request an AI lease (`POST /api/agents/ai/lease`), the server checks `license.is_trial`:
  * `is_trial = true` ➔ Routes to `trial_ai_key_id`, enforces `trial_default_model`, and checks `trial_daily_limit`.
  * `is_trial = false` ➔ Routes to `ai_key_id`, enforces task-specific paid models, and checks paid rolling limits (`daily_limit`, `weekly_limit`, `monthly_limit`).

### 1.3 Hardware-Locked 1-Day Trial Anti-Abuse
* Prevents users from creating multiple dummy email accounts to claim repeated 1-day free trials on the same machine.
* When a 1-day free trial is claimed and activated on a PC, its hardware `installation_id` is recorded with a 30-day cooldown. If the same machine tries to activate another public trial key within 30 days, the activation is rejected with a clear invitation to upgrade to a paid plan.

### 1.4 Zero Desktop Agent Code Changes
* Desktop agents (`Voro`, `Rolvio`, `Nexus`) require **0 lines of code changed, 0 reinstalls, and 0 version bumps**.
* The desktop agents continue to exchange license keys for signed JWT leases and request tasks (`voice_text`, `coding`, `vision`). All tier resolution and model mapping occur securely on the backend.

---

## 2. Technical Deliverables

### 2.1 Database Migration (`supabase/migrations/075_dual_tier_ai_and_license_expansion.sql`)

1. **Schema Enhancements:**
   * `public.products`:
     * Add `price_1w numeric(10,2) DEFAULT NULL` (1-Week Paid License Price).
   * `public.agent_ai_policies`:
     * Add `trial_ai_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL`.
     * Add `trial_default_model text DEFAULT 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'`.
   * `public.licenses`:
     * Add `is_trial boolean NOT NULL DEFAULT false`.
     * Create index `idx_licenses_is_trial ON public.licenses(is_trial)`.

2. **RPC Updates:**
   * **`admin_get_agent_ai_policies()`:**
     * Exposes `trialAiKeyId`, `trialAiKeyLabel`, `trialAiKeySuffix`, `trialDefaultModel`, `trialDailyLimit`.
     * Calculates split analytics: `requests24hPaid`, `requests24hTrial`, `cost30dUsdPaid`, `cost30dUsdTrial`.
   * **`admin_upsert_agent_ai_policy()`:**
     * Persists `trial_ai_key_id`, `trial_default_model`, and `trial_daily_limit`.
   * **`consume_agent_ai_quota()`:**
     * Checks `v_license.is_trial`.
     * If `is_trial`:
       * Assigns `v_model := v_policy.trial_default_model`.
       * Resolves API key: `coalesce(v_policy.trial_ai_key_id, v_policy.ai_key_id)`.
       * Enforces `trial_daily_limit`.
     * If paid:
       * Assigns task-specific model from `task_models` array.
       * Resolves API key: `v_policy.ai_key_id`.
       * Enforces paid daily, weekly, monthly limits.
   * **`admin_gift_license()`:**
     * Supports durations: `'1_day'`, `'1_week'`, `'1_week_trial'`, `'1_month'`, `'1_month_trial'`, `'3_months'`, `'lifetime'`.
     * When duration is `'1_day'`, `'1_week_trial'`, or `'1_month_trial'`, marks the license with `is_trial = true` and `provider_payment_id = 'trial_gift_' || ...`.
     * When duration is `'1_week'`, `'1_month'`, `'3_months'`, or `'lifetime'`, marks the license with `is_trial = false` and `provider_payment_id = 'gift_' || ...`.
   * **`claim_free_trial()` Anti-Abuse:**
     * Ensures only products with `trial_active = true` allow claiming.
     * Records `device_id` / `installation_id` to enforce a 30-day cooldown per machine against multi-account trial spam.
   * **`validate_promo_code()` & `create_checkout_order()`:**
     * Expands duration parsing to allow `'1_week'`, `'1_week_trial'`, and `'1_month_trial'`.
     * Calculates pricing for `1_week` based on `product.price_1w`.

---

### 2.2 Backend & Shared Logic

1. **Shared Types (`packages/shared/agentAi.ts`):**
   * Update `AgentAiPolicyInput` and `AgentAiPolicy`:
     * `trialAiKeyId?: string | null`
     * `trialDefaultModel: string`
     * `trialDailyLimit: number`
     * `trialAiKeyLabel?: string | null`
     * `trialAiKeySuffix?: string | null`
   * Update `AgentAiPolicyStats` with separate metrics:
     * `requests24hPaid: number`
     * `requests24hTrial: number`
     * `cost30dUsdPaid: number`
     * `cost30dUsdTrial: number`

2. **API Handlers (`apps/api/live.ts`):**
   * Update `/api/admin/licenses/gift`:
     * Schema accepts `'1_week'`, `'1_week_trial'`, and `'1_month_trial'`.
     * Accepts optional boolean `sendEmail: boolean` to automatically trigger a branded Resend delivery email containing the activation key and download link.
   * Update `/api/admin/products/:id` update handler to persist `price_1w`.
   * Update coupon creation and validation routines to support multi-duration matching including trial durations.

---

### 2.3 Admin Panel UI Upgrades

1. **Agent Releases (`apps/web/src/ui/Workspace.tsx` & `AgentAiPolicySection.tsx`):**
   * **Relocate "AI Usage Policy":** Moved up into `License, Trial & Usage Limits` right next to `1-Day Free Trial` and `Device Allowance`.
   * **1-Week Price Field:** Added `1-Week License Price (₹ / $)` (`price1w`) input.
   * **Dual-Tier Tabbed Selector in `AgentAiPolicySection`:**
     * `👑 Paid Customer Tier`:
       * Upstream Paid OpenRouter API Key dropdown.
       * Default Fallback Paid Model.
       * Per-task model assignment table (Voice, Coding, Vision).
       * Paid rolling limits (1-Day, 1-Week, 1-Month).
     * `🎁 Free Trial Tier`:
       * Upstream Trial OpenRouter API Key dropdown.
       * Default Trial Model input with datalist suggestions.
       * Multimodal / Vision indicator badge (e.g. `👁 Vision Capable` or `📄 Text-Only`).
       * Dynamic `Daily Trial Limit (24h)` input.
       * Advisory note: *"Free trials use this single model for all tasks. Task-specific model routing is reserved for Paid Customers."*
   * **Rich Developer Hints:**
     * Tooltips and descriptive subtitles explaining `Max Output Tokens` (single response cap, 1 token ≈ 4 chars), `Routing Priority` (latency vs price), `Task Key`, and `Enforce ZDR`.

2. **Admin Gift Modal (`Workspace.tsx`):**
   * Dropdown options updated with clear tier labels:
     * `1-Day Free Trial (Trial Tier)`
     * `1-Week Free Trial (Gift — Trial Tier)`
     * `1-Month Free Trial (Gift — Trial Tier)`
     * `1-Week Full Access (Paid Tier)`
     * `1-Month Full Access (Paid Tier)`
     * `3-Months Full Access (Paid Tier)`
     * `Lifetime Full Access (Paid Tier)`
   * Checkbox: `[x] Send gift email to recipient with key and download instructions`.

3. **Admin Promotions / Coupons (`Workspace.tsx`):**
   * Expanded duration checkboxes:
     * `[ ] 1 Week (Paid)`
     * `[ ] 1 Week Free Trial`
     * `[ ] 1 Month (Paid)`
     * `[ ] 1 Month Free Trial`
     * `[ ] 3 Months`
     * `[ ] Lifetime Access`

---

## 3. Verification & Safety Criteria

* **Test Suite:**
  * Add unit tests in `tests/` verifying:
    * `is_trial` routing behavior in `consume_agent_ai_quota`.
    * Free trial requests routing to `trial_ai_key_id` and `trial_default_model`.
    * Paid requests routing to `ai_key_id` and task-specific models.
    * Gifting `1_week_trial` and `1_month_trial` vs paid licenses creating correct `is_trial` flags.
    * Validating coupons for `1_week`, `1_week_trial`, and `1_month_trial`.
    * Anti-abuse 30-day cooldown blocking duplicate 1-day trial claims on the same hardware ID.
* **Zero Regressions:** All existing 39 test suites must pass (272/272 tests).
* **TypeScript & Build:** `npm run check` and `npm run build` must compile cleanly with zero errors.
