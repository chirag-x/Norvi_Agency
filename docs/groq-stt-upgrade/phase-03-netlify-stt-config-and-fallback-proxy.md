# Phase 3 — Netlify Backend STT Config & Secure Fallback Proxy (`/api/agent-stt/*`)

**Goal:** Expose authenticated desktop endpoints under `/api/agent-stt/*` inside Netlify Functions (`netlify/functions/api.ts` + `apps/api/live.ts` + new `packages/shared/agentSttProxy.ts`) so:
1. Licensed agents always learn the current Admin-chosen `stt_model` and `fallback_enabled` flag securely (`GET /api/agent-stt/config`).
2. Licensed agents without a user Groq key can transcribe audio cleanly via NORVI's secret server-side `GROQ_API_KEY` (`POST /api/agent-stt/v1/audio/transcriptions`), with model locking and hidden 1d/1w/1m/trial quota enforcement.

---

## 1. Netlify Environment Variable Binding

| File | Change |
| :--- | :--- |
| `apps/api/live.ts` (`LiveEnv` type) | Add `GROQ_API_KEY?: string;` alongside `OPENROUTER_API_KEY`. |
| `netlify/functions/api.ts` | Forward `GROQ_API_KEY: process.env.GROQ_API_KEY,` inside `handler()`. |

> **Operational Reminder:** Just like `OPENROUTER_API_KEY`, adding or changing `GROQ_API_KEY` in the Netlify dashboard requires triggering a fresh deploy (`Trigger deploy` / `Clear cache and deploy site`) for Netlify Functions to reload the runtime env var.

---

## 2. Routing, CSRF & Body Limits (`apps/api/live.ts`)

1. **Origin / CSRF Exemption:**
   - Desktop apps (Voro, Nexus) do not send browser `Origin` headers matching `APP_ORIGIN`. Exempt `/api/agent-stt` and `/api/agent-stt/*` alongside `/api/agent-ai/*`.
2. **Audio Payload Body Limit (`sttBodyLimit`):**
   - Regular API JSON routes are capped at `16,384 bytes` (`regularBodyLimit` in `apps/api/live.ts:76`).
   - Exempt `/api/agent-stt/*` from `regularBodyLimit` and apply `sttBodyLimit` (`5.5 * 1024 * 1024` bytes = 5.5 MB, safely matching Netlify Functions' 6 MB total request limit cleanly before multipart boundary overhead).
   - Register routes:
     - `app.get('/api/agent-stt/config', handleAgentStt)`
     - `app.post('/api/agent-stt/v1/audio/transcriptions', handleAgentStt)`
   - Exclude `/api/agent-stt/*` from browser session middleware (uses Lease JWT auth just like `/api/agent-ai`).

---

## 3. Proxy Implementation (`packages/shared/agentSttProxy.ts`)

Mirror the hardened authentication flow of `packages/shared/agentAiProxy.ts`:

### A. Common Authentication Step (Both `GET` & `POST`)
1. Extract `Authorization: Bearer <lease_jwt>`, `X-Norvi-Device: <hardware_id>`, and `X-Norvi-Product: <slug>`.
2. Verify HMAC signature and `exp` of `<lease_jwt>` against `LICENSE_ENCRYPTION_KEY || CRON_SECRET`.
3. Confirm device ID is present and matches lease claims (`product_id` + `license_id` + `device_id`).

### B. `GET /api/agent-stt/config` Handler
1. Call Supabase RPC `get_agent_stt_policy(p_license_id, p_product_id, p_device_id)`.
2. If license/device invalid or expired/suspended -> return `401` or `403`.
3. Otherwise return `200 OK` with `Cache-Control: no-store`:
   ```json
   {
     "stt_model": "whisper-large-v3-turbo",
     "fallback_enabled": true
   }
   ```
   *(Never returns `GROQ_API_KEY` or hidden quota caps.)*

### C. `POST /api/agent-stt/v1/audio/transcriptions` Handler
1. Validate `c.req.raw.headers.get('content-type')` starts with `multipart/form-data`.
2. Parse multipart form (`await c.req.parseBody()` or `await c.req.raw.formData()`).
3. Validate a non-empty audio `file` (`Blob` / `File`) is present and `> 0` bytes and `<= 5 MB`.
4. Confirm `env.GROQ_API_KEY` is configured on Netlify; if missing, return `503` generic message (`"Cloud speech fallback is temporarily unavailable."`).
5. Call atomic Supabase RPC `consume_agent_stt_quota(p_license_id, p_product_id, p_device_id, file.size)`:
   - If `allowed === false`, return `status_code` (`403` when Admin toggle OFF, `429` when cooldown limit reached, `401/403` on revoked/expired lease).
6. Build clean outbound `FormData` to forward to `https://api.groq.com/openai/v1/audio/transcriptions`:
   - Attach `file` (`Blob`, sanitized filename e.g. `audio.wav` or `audio.mp3`).
   - **Lock `model` server-side:** always set `form.set('model', rpcResult.stt_model)` — completely ignoring any `model` field sent by the client!
   - Forward safe optional speech parameters from client (`response_format` validated in `['json', 'verbose_json', 'text']`, `language`, `temperature`, sanitized `prompt`).
7. Execute upstream `fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY }, body: outboundForm })`.
8. Schedule `finalize_agent_stt_usage(...)` asynchronously (`waitUntil`) recording `'completed'` + `duration` from Groq JSON (if `verbose_json`), or `'failed'` on upstream error (`>= 400`). *(Important: if upstream Groq fails with 5xx, also consider whether failed calls count cleanly as `'failed'` so they don't unfairly consume the user's quota!)*
9. Return Groq's exact JSON/text response body with upstream status (`200` on success, sanitized non-leaking error if Groq rejects).

---

## 4. Security & Anti-Abuse Guarantees
- **Model spoofing impossible:** Client cannot send `model: "anything-else"` to NORVI's fallback proxy because the server overwrites it with `policy.stt_model`.
- **Key confidentiality:** `GROQ_API_KEY` never leaves the Netlify Function runtime.
- **No free unauthenticated transcription:** Every call checks a live NORVI Lease JWT + DB license + DB HWID binding + `groq_fallback_enabled === true`.
- **No leak of hidden caps:** Quota `429` message never tells the user how many requests/day or trial limits exist.
