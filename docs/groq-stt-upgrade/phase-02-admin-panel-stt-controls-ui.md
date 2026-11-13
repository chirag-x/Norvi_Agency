# Phase 2 — Admin Panel (`Agent Releases`) & Shared Policy API Upgrade

**Goal:** Add complete Groq STT configuration and NORVI Fallback controls to every agent inside `/admin/releases`, seamlessly matching the existing OpenRouter controls in `AgentAiPolicySection.tsx`.

---

## 1. Files Covered in This Phase

| File | Purpose |
| :--- | :--- |
| `packages/shared/agentAi.ts` | Add Groq STT preset slugs, TypeScript types, defaults, and strict payload normalization (`sttModel`, `groqFallbackEnabled`, `sttDailyLimit`, `sttWeeklyLimit`, `sttMonthlyLimit`, `sttTrialDailyLimit`). |
| `apps/api/live.ts` | Pass new STT policy fields to `admin_upsert_agent_ai_policy` in `POST /api/admin/products/:id/ai-policy`. |
| `apps/web/src/ui/AgentAiPolicySection.tsx` | Render the Groq STT subsection inside every agent's release card. |

---

## 2. Exact Shared Schema & Presets (`packages/shared/agentAi.ts`)

1. **Add `GROQ_STT_MODEL_PRESETS`:**
   - `whisper-large-v3-turbo` — *Whisper Large V3 Turbo (Fastest, Multilingual, Recommended Default)*
   - `whisper-large-v3` — *Whisper Large V3 (Highest Accuracy, Multilingual)*
   - `distil-whisper-large-v3-en` — *Distil Whisper V3 English (English-Only Ultra-Fast)*
   *(And just like OpenRouter models, the admin UI uses an editable `<input list="...">` datalist so you can type **any future Groq STT model ID** even before presets are updated.)*

2. **Extend Types:**
   - `AgentAiPolicyStats`:
     - Keep `requests24h`, `requests7d`, `requests30d`, `cost30dUsd`
     - Add `sttRequests24h`, `sttRequests7d`, `sttRequests30d`, `sttMinutes30d`
   - `AgentAiPolicyInput`:
     - `sttModel: string` (default `'whisper-large-v3-turbo'`)
     - `groqFallbackEnabled: boolean` (default `false`)
     - `sttDailyLimit: number` (default `0`)
     - `sttWeeklyLimit: number` (default `0`)
     - `sttMonthlyLimit: number` (default `0`)
     - `sttTrialDailyLimit: number` (default `0`)

3. **Validation in `normalizeAgentAiPolicyPayload(...)`:**
   - Require non-empty `sttModel` (valid safe Groq model characters: alphanumeric, `.`, `-`, `_`, `/`, `:`, max 120 chars).
   - Clamp all 4 STT limit integers to `>= 0`.
   - Normalize `groqFallbackEnabled` strictly as boolean.

---

## 3. Admin Releases UI Design (`apps/web/src/ui/AgentAiPolicySection.tsx`)

Inside every agent card (right below OpenRouter per-task settings, sharing the single **Save AI Models & Limits** button so admins never forget to save):

1. **Section Header + Live STT Fallback Telemetry Pill:**
   - Displays `Fallback STT 24h: X · 7d: Y · 30d: Z reqs (~M mins)`.

2. **Groq Speech-to-Text (STT) Controls:**
   - **Groq STT Model ID** (`input` + `<datalist id="groq-stt-presets-...">`):
     - Hint: *"Applied across all users for this agent (even when users enter their own Groq API key)."*
   - **NORVI Fallback Groq API Key Toggle** (`<select>` or checkbox clearly labeled `Enabled (Allow NORVI Netlify GROQ_API_KEY fallback)` / `Disabled (Require User Groq Key or Offline Whisper)`):
     - Hint: *"Only used when a user has NOT entered their own Groq API key in the desktop app. Requires `GROQ_API_KEY` in Netlify environment variables."*

3. **Hidden Per-License STT Fallback Limits (`0 = Unlimited`):**
   - Exact 4-field grid matching OpenRouter limits:
     - **STT Fallback 1-Day Limit (24h)** — *"Max NORVI fallback transcriptions per license every 24h (0 = unlimited)"*
     - **STT Fallback 1-Week Limit (7 Days)** — *"Max NORVI fallback transcriptions per license in rolling 7 days (0 = unlimited)"*
     - **STT Fallback 1-Month Limit (30 Days)** — *"Max NORVI fallback transcriptions per license in rolling 30 days (0 = unlimited)"*
     - **STT Fallback Free Trial 1-Day Limit** — *"24h fallback cap for 1-day free trial licenses (0 = uses STT Fallback 1-Day Limit)"*

4. **Contextual Warning Banner (Only when relevant):**
   - If `groqFallbackEnabled === true` and you enabled it on an agent like Nexus where files >4 MB are split client-side, display a helpful non-blocking admin note reminding that user-supplied Groq keys still bypass NORVI limits completely.

---

## 4. Admin API Wiring (`apps/api/live.ts`)

Update `POST /api/admin/products/:id/ai-policy` (`apps/api/live.ts:1022-1045`) to pass:
- `p_stt_model: p.sttModel`
- `p_groq_fallback_enabled: p.groqFallbackEnabled`
- `p_stt_daily_limit: p.sttDailyLimit`
- `p_stt_weekly_limit: p.sttWeeklyLimit`
- `p_stt_monthly_limit: p.sttMonthlyLimit`
- `p_stt_trial_daily_limit: p.sttTrialDailyLimit`

All staff role permissions (`owner`, `administrator`, `product_manager`) remain unchanged, and `/api/catalog` stays 100% untouched (zero exposure of private STT policies or limits).
