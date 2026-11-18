# Phase 17: Groq STT Provider Key Management, Dual-Tier Voice Policy, Checkout Bill Breakdown & Option A Plan Selector

## Executive Summary
Phase 17 delivers two massive structural upgrades to NORVI:
1. **Infrastructure & Voice AI Security:** Elevates Groq Voice STT (Speech-to-Text) to enterprise-grade multi-key encrypted management with live browser Whisper diagnostics, dual-tier voice policies (Paid vs Free Trial), and an explicit manual toggle for trial speech fallback. It also permanently resolves the `/admin/settings` view crash (`Cannot read properties of undefined (reading 'name')`).
2. **Checkout Conversion & Pricing Transparency:** Introduces a live, itemized **Order Summary & Bill Breakdown** in the checkout payment column with crossed-out pricing math, flash sale discounts, coupon deductions, and dynamic action buttons. Additionally, it upgrades the checkout plan selector to **Option A (Modern Badged Cards)** with 100% admin-editable copy, customizable badges, dynamic per-day rates, and a floating `⭐ MOST POPULAR` ribbon selector.

---

## 1. Root Cause Analysis: The `/admin/settings` View Crash

### 1.1 The Trigger
In the Admin Dashboard (`/admin`), the **Live Infrastructure Telemetry** card displays core system health checks:
* Supabase Database & Auth (`actionUrl: '/admin/settings'`)
* Razorpay Payments Gateway (`actionUrl: '/admin/settings'`)
* License Email Delivery (`actionUrl: '/admin/settings'`)

When an administrator clicks the `View ↗` button on any of these cards, `AdminSystemDiagnostics` triggers client-side navigation:
```ts
onNavigate('/settings');
```

### 1.2 The Mechanism of Failure
1. **Cached Data Persistence:** Prior to clicking `View ↗`, the administrator is viewing the Overview (`/admin`), where `useData` fetched and cached the analytics payload (`{ metrics: {...}, topProducts: [...] }`).
2. **Asynchronous Fetch Delay:** Upon switching sections to `/settings`, `useData` initiates a background network fetch for `/admin/settings`.
3. **Synchronous Render Race Condition:** React immediately renders the new section before the network request resolves. Because `useData` retains the previous section's data in local state, `!data` is `false` (the analytics object is present).
4. **Unprotected Property Access:**
   In `Workspace.tsx`:
   ```tsx
   {section === '/settings' && <SettingsForm initial={data.settings} ... />}
   ```
   Because `data` is the analytics object, `data.settings` is `undefined`.
   Inside `SettingsForm`:
   ```tsx
   <input name="name" required defaultValue={initial.name} />
   ```
   Evaluating `initial.name` on `undefined` throws an uncaught JavaScript runtime error:
   `TypeError: Cannot read properties of undefined (reading 'name')`.
5. **React Error Boundary Activation:** React's top-level `<ErrorBoundary>` intercepts the uncaught render failure and replaces the interface with:
   *"Something went wrong loading this view: Cannot read properties of undefined (reading 'name')"*.

### 1.3 The Resolution Plan
* **Guard in `Workspace.tsx`:** Ensure `<SettingsForm>` is only mounted when `data?.settings` is truthy; otherwise render `<Loading />`.
* **Safe Property Access in `SettingsForm`:** Implement optional chaining and default fallbacks: `defaultValue={initial?.name || ''}` across all fields (`name`, `company`, `email`, `domain`, `headline`, `description`).
* **Live Integration Readiness Panel:** Replace the hardcoded `"Not connected"` badges in `/admin/settings` with live indicators powered by `data.system` (`supabase`, `razorpay`, `resend`, `github`).

---

## 2. Voice AI & STT Key Management Architecture

### 2.1 Collapsible Accordion UI for Provider Keys (`/admin/releases`)
To prevent visual clutter on the Releases page while supporting multiple AI vendors, the AI Key Management section is restructured into collapsible accordion cards:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🌐 OpenRouter AI Provider Keys (LLM Inference)        [Active: ••••4a9b] ▼│
├────────────────────────────────────────────────────────────────────────┤
│ (Expanded view: Add Key | Manage Keys Modal | Test Key with Model)     │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ 🎙️ Groq Voice STT Provider Keys (Speech-to-Text)      [Active: ••••9x2z] ▼│
├────────────────────────────────────────────────────────────────────────┤
│ (Expanded view: Add Key | Manage Keys Modal | Test Whisper Model)      │
└────────────────────────────────────────────────────────────────────────┘
```

* **Default State:** Collapsible cards show summary header with active key badge and test status.
* **1-Click Expand/Collapse:** Smooth accordion interaction matching the design system of `AgentReleaseCard`.
* **Independent Management:** Managing Groq keys opens a Groq-scoped modal; managing OpenRouter keys opens an OpenRouter-scoped modal.

---

### 2.2 Database & Schema Upgrades (`076_groq_stt_and_dual_voice_policy.sql`)

1. **Leverage Existing `admin_ai_keys` Table:**
   Groq keys are stored in `public.admin_ai_keys` with:
   * `provider = 'groq'`
   * `label = 'Production Groq Whisper 1'`
   * `encrypted_key = <AES-GCM ciphertext>`
   * `key_suffix = <Last 4 characters of Groq key>`
   * `is_active = true | false`

2. **Add STT Policy Columns to `public.agent_ai_policies`:**
   ```sql
   ALTER TABLE public.agent_ai_policies
     ADD COLUMN IF NOT EXISTS stt_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL,
     ADD COLUMN IF NOT EXISTS trial_stt_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL,
     ADD COLUMN IF NOT EXISTS trial_stt_fallback_enabled boolean NOT NULL DEFAULT false;

   CREATE INDEX IF NOT EXISTS idx_agent_ai_policies_stt_key_id ON public.agent_ai_policies (stt_key_id);
   CREATE INDEX IF NOT EXISTS idx_agent_ai_policies_trial_stt_key_id ON public.agent_ai_policies (trial_stt_key_id);
   ```

3. **Safe Function Replacement:**
   Explicitly execute `DROP FUNCTION IF EXISTS public.admin_upsert_agent_ai_policy(...)` prior to recreation to prevent PostgreSQL error `42P13: cannot change return type of existing function`.

---

### 2.3 Dual-Tier Groq STT Manual Controls in `AgentAiPolicySection.tsx`

Administrators have full manual control over Voice STT per agent release:

#### A. Paid License Tier (Commercial Customers)
* **Groq STT Key Selector:**
  * Option 1: `Use Active Groq Key (Default)`
  * Option 2: Select a dedicated Groq key from `admin_ai_keys`
* **STT Engine Model:**
  * Default: `whisper-large-v3-turbo`
  * Options: `whisper-large-v3`, `whisper-large-v3-turbo`
* **STT Fallback Toggle:**
  * Toggle: `Enable Cloud STT Fallback for Paid Users` (Default: ON)

#### B. Free Trial License Tier (1-Day & Promotional Coupons)
* **Trial Groq STT Key Selector:**
  * Choose separate free-tier Groq key or share active key
* **Manual Trial STT Fallback Toggle:**
  * Toggle: `Enable Cloud STT Fallback for Free Trial Users` (Default: OFF / unchecked)
  * Policy Note: *"When disabled, free trial agents rely exclusively on local whisper/hardware STT. If the user's machine cannot run local speech recognition, cloud fallback is withheld until upgraded to a paid license."*

---

### 2.4 Live Diagnostic Verification for Groq Keys

1. **Backend Testing Endpoint (`POST /api/admin/ai/keys/test`):**
   * If `provider === 'groq'`:
     * Makes an authenticated ping to `https://api.groq.com/openai/v1/models` using the selected or input Groq key.
     * Verifies that the Whisper model (`whisper-large-v3-turbo` or custom input model) is available and authorized on the Groq account.
     * Returns live latency (ms), HTTP status, and account capabilities.
2. **Telemetry Check (`GET /api/admin/system/health`):**
   * Updates check `groq_stt` to inspect `admin_ai_keys` for `provider = 'groq' AND is_active = true`.
   * If found, performs an active health check and reports latency in ms.
   * If no database key is found, tests the fallback `GROQ_API_KEY` from environment variables.
   * Provides `actionUrl: '/admin/releases'` so clicking `Setup ↗` navigates directly to the key manager.

---

### 2.5 Runtime STT Proxy Key Resolution (`packages/shared/agentSttProxy.ts`)

Upgrades to the speech-to-text proxy engine:
1. **Tier Identification:** When an audio transcription request arrives with an agent lease JWT, inspect `lease.is_trial`.
2. **Trial Enforcement:**
   * If `is_trial` is `true` and `trial_stt_fallback_enabled` is `false`:
     * Reject request immediately with HTTP 403:
       `{ error: "Cloud speech transcription is reserved for paid license tiers. Upgrade your license to enable live voice input." }`
3. **Dynamic Decryption:**
   * Fetch assigned key ID (`trial_stt_key_id` if trial, otherwise `stt_key_id`).
   * Decrypt and use the specific Groq key from `admin_ai_keys`.
   * If no specific key is assigned, decrypt the active key where `provider = 'groq' AND is_active = true`.
   * If no database key exists, use `GROQ_API_KEY` from Netlify environment variables as a legacy fallback.

---

## 3. Checkout Experience: Live Bill Breakdown & Option A Plan Selector

### 3.1 Dynamic Order Summary & Bill Breakdown (Payment Column)
Located in `apps/web/src/ui/PublicPages.tsx` directly underneath the `Coupon or Referral Code` input and above the `Terms & Conditions` checkbox:

```
┌────────────────────────────────────────────────────────┐
│ 🧾 ORDER SUMMARY & BILL BREAKDOWN                      │
│                                                        │
│ Selected License Tier:   Voro · 1 Week Pass (7 Days)   │
│ Catalog Base Price:      ₹299                          │
│ ⚡ Flash Storefront Sale: -₹30 (10% OFF)               │
│ 🎟️ Coupon Applied (SAVE10): -₹27 (10% Extra OFF)       │
│ ────────────────────────────────────────────────────── │
│ Grand Total to Pay:      ₹299  ₹242                    │
│                          (You save ₹57 / 19% OFF)      │
│ Inclusive of all taxes · Instant license delivery      │
└────────────────────────────────────────────────────────┘
```

#### Dynamic Behavior & Edge Cases:
1. **Storefront Sale Only:** Displays base price crossed out, sale reduction in lime (`-₹30`), and total.
2. **Sale + Discount Coupon (e.g. `SAVE10`):** Automatically calculates compound discount (`Base -> Sale -> Coupon`), displays both deductions cleanly, and highlights total cumulative savings.
3. **100% Free Trial Coupon (e.g. `TESTING`):**
   * Deducts 100% of price: `🎟️ Promotional Pass: -₹269`
   * Grand Total displays: **`FREE (₹0)`**
   * Action button text switches from `Pay Securely (₹X) →` to **`Claim Free Access (₹0) →`**.

---

### 3.2 Upgraded Plan Selector: Option A (Modern Badged Cards)
On the right sidebar of `/checkout/:slug`, the plain radio buttons are replaced with elevated, glowing cards:

```
┌──────────────────────────────────────────────────────────────────┐
│ (●) 1 Week (7 Days)   [ 🚀 Starter Pass ]             ₹299 ₹269  │
│     Ideal for a technical interview or quick project   ₹38 / day │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│                  [ ⭐ MOST POPULAR ]                             │
│ ( ) 1 Month           [ 10% OFF ]                     ₹899 ₹809  │
│     Full month of high-speed cloud AI assist           ₹27 / day │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ ( ) 3 Months          [ 🔥 Save ₹240 ]               ₹2399 ₹2159 │
│     Multi-round job search & technical prep            ₹24 / day │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ ( ) Lifetime Access   [ 👑 Pay Once ]                ₹9999 ₹8999 │
│     Permanent ownership with all future agent models  Never renew│
└──────────────────────────────────────────────────────────────────┘
```

---

### 3.3 100% Admin Tweakability Architecture (Zero Hardcoding)

To give administrators absolute control over marketing copy, all plan attributes are stored on `product.extended_content.plan_configs`:

```json
{
  "featured_plan": "1_month",
  "featured_ribbon_text": "⭐ MOST POPULAR",
  "plan_configs": {
    "1_week": {
      "subtitle": "Ideal for a technical interview or quick project",
      "badge": "🚀 Starter Pass"
    },
    "1_month": {
      "subtitle": "Full month of high-speed cloud AI interview assist",
      "badge": "10% OFF"
    },
    "3_months": {
      "subtitle": "Multi-round job search & technical prep",
      "badge": "🔥 Save ₹240"
    },
    "lifetime": {
      "subtitle": "Permanent ownership with all future agent models",
      "badge": "👑 Pay Once"
    }
  }
}
```

#### What Is Automatic vs. What Is 100% Manually Tweakable:

| Element | Automatic Behavior | Admin Manual Override |
|---|---|---|
| **`⭐ MOST POPULAR` Ribbon** | Defaults to `1_month` if not specified | Dropdown in `/admin/releases` allows attaching this ribbon to **any plan** (`1_week`, `1_month`, `3_months`, `lifetime`, or `None`), and allows typing custom text (e.g. `🔥 BEST VALUE`, `🚀 STAFF PICK`). |
| **Plan Subtitles** | Sensible built-in defaults for Voro, Rolvio, and Nexus | Editable text input per duration in `/admin/releases`. Write whatever copy you want. |
| **Pill Badges (`Starter Pass`, `Save ₹240`)** | Auto-computes discount savings percentage from price math if blank | Editable text input per duration. Type custom text like `🔥 Save ₹240`, `BEST DEAL`, or leave blank for auto-computed math. |
| **Per-Day Pricing (`₹27 / day`)** | **100% Automatic Math:** Dynamically divides active price by days (7, 30, 90). | Always guarantees accurate math with zero manual math calculations required. |
| **1-Click Pre-fill Button** | Provides **`✨ Pre-fill Recommended Plan Copy`** in `/admin/releases` | 1 click populates high-converting copy across all 4 plans; you can then tweak any word. |

---

## 4. Implementation Steps & Verification Plan

| Step | Action | Files Impacted |
|------|--------|----------------|
| 1 | Fix `/admin/settings` render race condition | `apps/web/src/ui/Workspace.tsx` |
| 2 | Add SQL migration `076_groq_stt_and_dual_voice_policy.sql` | `supabase/migrations/` |
| 3 | Update Backend AI Key APIs to handle `provider = 'groq'` | `apps/api/live.ts` |
| 4 | Update System Health Telemetry for Groq STT | `apps/api/live.ts` |
| 5 | Build Collapsible Accordion Provider Key Cards | `apps/web/src/ui/AdminAiKeyManager.tsx` |
| 6 | Integrate Dual-Tier STT Controls into Policy Section | `apps/web/src/ui/AgentAiPolicySection.tsx` |
| 7 | Add Plan Selector Copy Controls to Agent Release Card | `apps/web/src/ui/Workspace.tsx` |
| 8 | Implement Dynamic Bill Breakdown in Checkout | `apps/web/src/ui/PublicPages.tsx` |
| 9 | Implement Option A Badged Plan Cards in Checkout | `apps/web/src/ui/PublicPages.tsx` |
| 10 | Upgrade STT Proxy Dynamic Key Decryption | `packages/shared/agentSttProxy.ts` |
| 11 | Run Full Test Suite & Static Production Build | `npm test`, `npm run build` |

---

## 5. Acceptance Criteria
* [ ] Navigating to `/admin/settings` or clicking `View ↗` on Supabase/Razorpay telemetry cards loads smoothly without crashing.
* [ ] Both OpenRouter and Groq provider keys appear in distinct, collapsible accordion sections in `/admin/releases`.
* [ ] Adding, activating, deleting, and testing a Groq API key works seamlessly from the UI.
* [ ] Paid and Free Trial tiers have independent Groq key dropdowns and a manual toggle for Free Trial STT fallback.
* [ ] Selecting any plan on checkout displays an itemized Bill Breakdown in the left column with crossed-out math and savings totals.
* [ ] Plan Selector renders Option A cards with customizable badges, subtitles, daily rates, and the floating ribbon.
* [ ] Admin Release tab allows changing the `⭐ MOST POPULAR` ribbon target, ribbon text, subtitles, and badges per duration.
* [ ] All automated tests pass with 0 regressions.
