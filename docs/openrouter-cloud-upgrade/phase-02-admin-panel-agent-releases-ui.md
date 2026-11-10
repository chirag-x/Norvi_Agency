# Phase 2 — Website Admin API & "Agent Releases" UI Controls

**Goal:** Give the NORVI Owner / Admin / Product Manager full control inside the existing **Agent Releases** tab (`/admin/releases`) to configure **OpenRouter model IDs per agent & per task** (for current and future agents) and set **hidden 1-Day, 1-Week, and 1-Month limits**.

---

## 1. Existing Files Involved

- Backend API: `apps/api/live.ts`
- Shared Types: `packages/shared/model.ts`
- Admin UI: `apps/web/src/ui/Workspace.tsx` (`AgentReleasesAdmin` and `AgentReleaseCard`, lines 1216–1381)

---

## 2. Backend API Additions (`apps/api/live.ts`)

Add two dedicated **staff-only** endpoints (completely separate from `/api/catalog` so limits and model configs stay private):

1. **`GET /api/admin/agent-ai-policies`**
   - Role check: `owner`, `administrator`, `product_manager` (same permissions as `/admin/releases` in `Workspace.tsx`).
   - Calls `c.get('db').rpc('admin_get_agent_ai_policies')`.
   - Returns `{ policies: Record<productId, AgentAiPolicy>, stats: Record<productId, { requests24h, requests7d, requests30d, cost30dUsd }> }`.

2. **`POST /api/admin/agent-ai-policies/:productId`**
   - Role check: `owner`, `administrator`, `product_manager`.
   - Zod-validated payload:
     - `aiEnabled: boolean`
     - `defaultModel: string` (trimmed OpenRouter model ID, e.g. `google/gemma-4-26b-a4b-it`)
     - `taskModels: Array<{ taskKey: string; label: string; model: string; sort: 'latency' | 'price'; maxOutputTokens: number; allowVision: boolean }>`
     - `dailyLimit: number` (`int >= 0`, `0` = unlimited)
     - `weeklyLimit: number` (`int >= 0`, `0` = unlimited)
     - `monthlyLimit: number` (`int >= 0`, `0` = unlimited)
     - `trialDailyLimit: number` (`int >= 0`, `0` = inherit `dailyLimit`)
     - `maxInputChars: number` (`int`, e.g. `1000`–`500000`)
     - `maxOutputTokens: number` (`int`, e.g. `128`–`16384`)
     - `enforceZdr: boolean`
   - Calls `c.get('db').rpc('admin_upsert_agent_ai_policy', ...)`.

> **Important:** `GET /api/catalog` remains untouched so public pages and storefront visitors never see internal models or usage limits.

---

## 3. Admin Panel UI Design (`Agent Releases` Tab in `Workspace.tsx`)

Inside each `AgentReleaseCard` (under `License, Trial & Usage Limits`), add two clear panels with a **"Save AI Config"** action (or saved together with **Save Release**):

### Section A: OpenRouter Cloud AI Model Routing (Per Task + Future-Proof)

1. **Cloud AI Status Toggle:** `Enabled` / `Paused` (lets you pause cloud AI for a single agent in 1 click if needed).
2. **Default Fallback OpenRouter Model:**
   - Editable text input (so you can paste **any** OpenRouter model slug like `google/gemma-4-26b-a4b-it` or `qwen/qwen3.5-flash-02-23`) + quick-fill preset dropdown/chips for common low-cost models:
     - `google/gemma-4-26b-a4b-it`
     - `google/gemma-4-31b-it`
     - `qwen/qwen3.5-flash-02-23`
     - `openai/gpt-5-nano`
     - `google/gemini-2.5-flash-lite`
3. **Per-Task Model Mapping List (Dynamic Rows):**
   - For **Voro**: shows `voice_text` (*Voice / Interview Q&A Text*), `coding` (*Coding / Algorithms*), `vision` (*Screen Vision / Screenshot OCR*).
   - For **Nexus**: shows `clip_analysis` (*Long Transcript Clip Analysis*), `social_copy` (*Titles, Captions & Hashtags*).
   - For **Rolvio**: shows `job_match` (*ATS Job Match Scoring*), `form_answer` (*Screening Answers*), `email_classify` (*Email Classifier*), `resume_parse` (*Resume Parser*).
   - **Each row lets you:**
     - Edit **Task Key** (slug identifier, e.g. `vision`, `voice_text`)
     - Edit **Task Label** (human-friendly name, e.g. `Voro Vision`)
     - Type or pick **OpenRouter Model ID** (e.g. `google/gemma-4-31b-it`)
     - Choose **OpenRouter Routing Priority**: `Lowest Latency (Speed)` or `Lowest Price`
     - Set **Max Output Tokens** & **Vision Capable** checkbox
     - Delete unused custom rows (or click **`+ Add Task Model`** to create new task slots for **future agents**).

### Section B: Hidden Usage Limits (Never Shown to Users)

Add a clearly labeled private box:  
`Hidden Per-License Usage Limits (Server-Enforced Only — Invisible to Customers)`

Four numeric inputs (with `0 = Unlimited`):
1. **1-Day Limit (24h):** Max AI requests per license per 24 hours.
2. **1-Week Limit (7 Days):** Max AI requests per license per rolling 7 days.
3. **1-Month Limit (30 Days):** Max AI requests per license per rolling 30 days.
4. **Free Trial 1-Day Limit (add this to not optional):** Stricter 24h cap for 1-day trial keys (`0` = same as 1-Day Limit).

Also display a compact **Live Usage & Cost Summary** pill strip inside the card (admin-only):  
`Last 24h: X reqs | Last 7d: Y reqs | Last 30d: Z reqs (~$A.BC OpenRouter est.)`

### Section C: Guardrail Notice on Public Copy

- Keep the existing `AI Usage Policy` field (`aiUsage`) purely for marketing display (e.g., *"Cloud AI Included — Zero Setup Required"*). Make sure staff know never to type internal numeric caps into `aiUsage` if they want limits hidden.

---

## 4. Phase 2 Acceptance Criteria

- [ ] Admin can open `/admin/releases`, edit model IDs per task (typing custom OpenRouter IDs or selecting presets), add/remove task slots for future agents, and save.
- [ ] Admin can set `1-Day`, `1-Week`, `1-Month`, and `Trial 1-Day` limits and save.
- [ ] Reloading `/admin/releases` persists all settings from Supabase.
- [ ] Visiting `/api/catalog` or customer `/account/*` pages reveals **zero** hidden limit numbers or OpenRouter model mappings.
- [ ] Non-staff users (`customer`, `support`) receive `403 Permission denied` on the new admin AI endpoints.
