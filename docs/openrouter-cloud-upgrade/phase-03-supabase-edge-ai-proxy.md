# Phase 3 — Netlify Backend AI Proxy (`/api/agent-ai`)

**Goal:** Host the centralized OpenRouter gateway inside your existing **Netlify Functions backend** (`netlify/functions/api.ts` + `apps/api/live.ts`) so `OPENROUTER_API_KEY` lives **only in Netlify Environment Variables** alongside `LICENSE_ENCRYPTION_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, with **no Supabase CLI or Edge Function secret duplication**.

---

## 1. Files Implemented

- [`packages/shared/agentAiProxy.ts`](../../packages/shared/agentAiProxy.ts) — Web-standard TypeScript proxy core (`verifyNorviLeaseJwt`, `createAgentAiHandler`) with OpenRouter forwarding, hidden 1d/1w/1m quota checks, ZDR privacy enforcement, `awaitFinalize: true` guarantees for AWS/Netlify Lambdas, and a `5 MB` payload ceiling cleanly inside Netlify's `6 MB` limit.
- [`apps/api/live.ts`](../../apps/api/live.ts) — Mounts `/api/agent-ai` and `/api/agent-ai/*` (`GET /api/agent-ai/health`, `POST /api/agent-ai/v1/chat/completions`, `POST /api/agent-ai/chat/completions`, `OPTIONS` CORS preflight) before browser cookie auth, with dedicated `5 MB` `bodyLimit` and desktop `Origin` exemption.
- [`netlify/functions/api.ts`](../../netlify/functions/api.ts) — Forwards `process.env.OPENROUTER_API_KEY` into `LiveEnv`.

### Netlify Environment Variables Required (Server-Side Only)

Already configured on Netlify:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LICENSE_ENCRYPTION_KEY` *(or `CRON_SECRET` fallback)*

Add **1 new secret** in **Netlify Dashboard → Site configuration → Environment variables** (and in `.env.local` for local dev):
- `OPENROUTER_API_KEY` — your single OpenRouter API key (`sk-or-v1-...`).

---

## 2. Exact Request Execution Flow (Step-by-Step)

When an agent calls `POST https://nor-vi.in/api/agent-ai/v1/chat/completions`:

1. **Extract Headers & Parse Payload:**
   - `Authorization: Bearer <lease_jwt>` (required)
   - `X-Norvi-Device: <hardware_id>` (required — must match `device_id` / `sub` inside JWT!)
   - `X-Norvi-Task: <task_key>` (e.g. `voice_text`, `coding`, `vision`, `clip_analysis`, `job_match`)
   - JSON body (`<= 5 MB`): `messages`, `stream` (`true` or `false`), `temperature`, `response_format` (optional JSON mode).

2. **Verify NORVI Lease JWT Signature & Claims (`< 2 ms`):**
   - Verify HMAC-SHA256 signature using `LICENSE_ENCRYPTION_KEY` (or `CRON_SECRET`) via Web Crypto `crypto.subtle.verify`.
   - Verify `payload.exp > now()`.
   - Verify `payload.device_id` (or `sub`) matches `X-Norvi-Device` and `X-Norvi-Product` (if sent) matches the licensed product.

3. **Input Size & Screenshot Cap:**
   - Reject raw JSON payloads over `5 MB` and image base64 strings over `3,500,000` chars with `413` before touching quota.

4. **Database License + Policy + Hidden 1d/1w/1m Quota Check:**
   - Look up `product_id` from `products` using `payload.product` (slug) or `payload.product_id`.
   - Call Supabase Postgres RPC `consume_agent_ai_quota(p_license_id, p_product_id, p_device_id, p_task_key)`.
   - If `allowed === false`:
     - License revoked/expired/blocked → `403`.
     - Hidden `1-day`, `1-week`, or `1-month` limit exceeded → **`429`** with a generic non-revealing cooldown message.

5. **Server-Side Model & Privacy Enforcement:**
   - Ignore whatever `model` string the client sent! Always execute the `model`, `sort`, `max_output_tokens`, and `enforce_zdr` (`data_collection: "deny"`) configured in your **Admin Panel (`/admin/releases`)**.
   - Strip `image_url` blocks if `allow_vision === false` for that task.

6. **Stream / Forward Response + Guaranteed Usage Logging (Netlify-Safe):**
   - **If `stream: true` (Voro):** Pipe OpenRouter SSE through `TransformStream` with `stream_options: { include_usage: true }`. `flush()` awaits `finalize_agent_ai_usage(...)` before closing the response stream so Netlify Lambda never freezes before logging tokens/USD cost.
   - **If `stream: false` (Nexus / Rolvio):** `await finalize_agent_ai_usage(...)` before returning JSON `200` (or `'failed'` on upstream error).
   - **Netlify Execution Limit Note:** Netlify synchronous & streaming functions run up to **60 seconds**. Voro & Rolvio finish quickly; for Nexus long transcripts, Phase 5 keeps each request chunked so calls finish comfortably inside 45 seconds.

---

## 3. Phase 3 Acceptance Criteria

- [x] `OPENROUTER_API_KEY` read solely from Netlify `LiveEnv` (`netlify/functions/api.ts` + `.env.local`).
- [x] Requests with missing/tampered Lease JWT or mismatched `X-Norvi-Device` are rejected with `401`/`403`.
- [x] Spoofing `"model": "openai/gpt-4o"` in the client body still executes the **Admin Panel's configured OpenRouter model**.
- [x] SSE streaming and non-streaming responses await `finalize_agent_ai_usage` cleanly inside Netlify Functions.
- [x] Hitting the 1-day, 1-week, or 1-month cap triggers a clean generic `429` without revealing limit numbers.
