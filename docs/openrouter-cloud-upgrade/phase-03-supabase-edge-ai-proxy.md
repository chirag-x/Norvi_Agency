# Phase 3 — Supabase Edge Function AI Proxy (`supabase/functions/agent-ai`)

**Goal:** Build the fast, secure OpenRouter gateway inside your existing Supabase project so all desktop agents authenticate with their **NORVI Lease JWT**, never touch `OPENROUTER_API_KEY`, and strictly obey your Admin Panel model selections and hidden 1-day / 1-week / 1-month limits.

---

## 1. Files to Create / Configure

- `supabase/config.toml` — configure `[functions.agent-ai]` with `verify_jwt = false`.
- `supabase/functions/agent-ai/index.ts` — Deno Edge Function supporting OpenAI-compatible `POST .../v1/chat/completions` (plus `GET .../health`).

### Supabase Secrets Required (Encrypted Server-Side Only)

Set once via Supabase CLI or Dashboard (`Edge Functions -> Secrets`):
- `OPENROUTER_API_KEY` — your single OpenRouter API key (`sk-or-v1-...`).
- `LICENSE_ENCRYPTION_KEY` — exact same HMAC-SHA256 secret used in `apps/api/live.ts` to sign NORVI Lease JWTs (if `live.ts` falls back to `CRON_SECRET`, match the active signing secret).
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` — automatically available in Supabase Edge Functions (or explicitly configured if needed).

---

## 2. Why `verify_jwt = false` + Manual Verification

By default, Supabase's API gateway rejects any `Authorization: Bearer ...` token that is not a Supabase user Auth JWT.  
Because our desktop agents pass the **NORVI Gatekeeper Lease JWT** in `Authorization: Bearer <lease_jwt>`, we set `verify_jwt = false` for `agent-ai` in `supabase/config.toml` and verify the HMAC-SHA256 Lease JWT **immediately inside the function** before doing anything else.

---

## 3. Exact Request Execution Flow (Step-by-Step)

When an agent calls `POST https://<project-ref>.supabase.co/functions/v1/agent-ai/v1/chat/completions`:

1. **Extract Headers & Parse Payload:**
   - `Authorization: Bearer <lease_jwt>` (required)
   - `X-Norvi-Device: <hardware_id>` (required — must match `device_id` inside JWT!)
   - `X-Norvi-Task: <task_key>` (e.g. `voice_text`, `coding`, `vision`, `clip_analysis`, `job_match`)
   - JSON body: `messages`, `stream` (`true` or `false`), `temperature`, `response_format` (optional JSON mode).

2. **Verify NORVI Lease JWT Signature & Claims (`< 2 ms`):**
   - Verify HMAC-SHA256 signature using `LICENSE_ENCRYPTION_KEY` via Web Crypto `crypto.subtle.verify`.
   - Verify `payload.exp > now()`.
   - Verify `payload.device_id === X-Norvi-Device` (stops someone from copying a `.norvi_*_lease` file onto another PC).
   - Extract `license_id` and `product` slug.

3. **Input Size & Per-Minute Anti-Spam Check:**
   - Compute total text character length across `messages` (excluding base64 image prefix or checking image size cap, e.g., max 4 MB per screenshot).
   - Reject oversized abuse payloads cleanly (`413`).

4. **Database License + Policy + Hidden 1d/1w/1m Quota Check:**
   - Look up `product_id` from `products.slug = payload.product`.
   - Call Postgres RPC `consume_agent_ai_quota(p_license_id, p_product_id, p_device_id, p_task_key)`.
   - If `allowed === false`:
     - If license revoked/expired/blocked → return `403` (`{ error: "License is inactive or expired." }`).
     - If `1-day`, `1-week`, or `1-month` limit exceeded → return **`429`** with a **generic, non-revealing message**:  
       `{ error: "Temporary AI cooldown active due to high usage. Please try again later." }`  
       *(Never expose numbers like `50/50 daily limit` or `weekly cap`.)*

5. **Server-Side Model & Privacy Enforcement:**
   - Ignore whatever `model` string the client sent! Always use the `model`, `sort`, and `max_output_tokens` returned by `consume_agent_ai_quota` from your Admin Panel configuration.
   - If the request contains an `image_url` block and `allow_vision === false` for that task, strip the image or reject with `400` so cheap text-only models don't crash.
   - Build OpenRouter request body:
     ```json
     {
       "model": "<resolved_model_from_admin_panel>",
       "messages": [...],
       "stream": true/false,
       "temperature": ...,
       "max_tokens": <resolved_max_output_tokens>,
       "response_format": ...,
       "provider": {
         "sort": "<latency_or_price>",
         "data_collection": "deny"
       }
     }
     ```
   - Send to `https://openrouter.ai/api/v1/chat/completions` with:
     - `Authorization: Bearer <OPENROUTER_API_KEY>`
     - `HTTP-Referer: https://nor-vi.in`
     - `X-Title: NORVI-<product>`

6. **Stream / Forward Response + Async Usage Logging:**
   - **If `stream: true` (Voro):**
     - Pipe OpenRouter's SSE `ReadableStream` directly to the client using `TransformStream` so tokens arrive with near-zero buffering.
     - Include `"stream_options": { "include_usage": true }` when calling OpenRouter so the final SSE chunk includes exact `usage` (`prompt_tokens`, `completion_tokens`, `cost`).
   - **If `stream: false` (Nexus / Rolvio):**
     - Parse OpenRouter JSON, extract `usage`, return JSON response to the desktop app.
   - **Async Background Log (`EdgeRuntime.waitUntil`):**
     - If OpenRouter failed with `5xx` or network error before delivering a response, call `finalize_agent_ai_usage(..., 'failed', 0, 0, 0)` so the user's quota isn't penalized.
     - On success, call `finalize_agent_ai_usage(..., 'completed', prompt_tokens, completion_tokens, cost_usd)`.

---

## 4. Phase 3 Acceptance Criteria

- [ ] Function deploys to Supabase with `verify_jwt = false`.
- [ ] Requests with missing/tampered Lease JWT or mismatched `X-Norvi-Device` are rejected with `401`/`403`.
- [ ] Spoofing `"model": "openai/gpt-4o"` in the client body still executes the **Admin Panel's configured OpenRouter model**.
- [ ] SSE streaming works end-to-end with chunked delivery.
- [ ] Hitting the 1-day, 1-week, or 1-month cap triggers a clean generic `429` without revealing limit numbers.
- [ ] `agent_ai_usage_logs` records accurate `model_used`, `prompt_tokens`, `completion_tokens`, and `estimated_cost_usd`.
