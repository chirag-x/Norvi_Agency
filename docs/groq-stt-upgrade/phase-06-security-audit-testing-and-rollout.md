# Phase 6 — Security Audit, End-to-End Testing, Rollout & Future Agents

**Goal:** Verify the entire Groq STT upgrade across Supabase, Netlify, Admin Releases UI, Voro, Nexus, and Rolvio (non-regression) with zero leaks of secret keys or hidden fallback quotas, deploy cleanly to production, and document how any future NORVI agent plugs into the exact same system.

---

## 1. Automated Verification Matrix

| Target | Test Scope |
| :--- | :--- |
| **Website / TypeScript** | `npm run check` (`astro check`), `npm test` (Vitest unit + proxy security audit tests), `npm run build`. |
| **Proxy Security Tests** (`tests/`) | Verify `agent_stt_usage_logs` isolation from OpenRouter limits; verify client-supplied `model` is overwritten server-side by `policy.stt_model`; verify `401` on invalid JWT/HWID; verify `403` when `groq_fallback_enabled === false`; verify non-numeric `429` cooldown on `1d`, `1w`, `1m`, and `trial_1d` limits; verify `/api/catalog` contains zero STT policy/limit/key fields. |
| **Voro** | `pytest` covering Admin `stt_model` sync, user-key direct fast path, NORVI fallback proxy path, setup blocker bypass when fallback enabled, and local Whisper fallback. |
| **Nexus** | `pytest` covering removal of `Groq Model` dropdown, user-key 25 MB no-split path, local mode untouched path, and fallback-only FFmpeg <4 MB chunk split + accurate timestamp offset merging. |
| **Rolvio** | `pytest` confirming zero regressions in existing auth/AI pipeline. |

---

## 2. Production Rollout Sequence (Zero Downtime)

1. **Supabase:** Run `064_agent_stt_policies.sql` in Supabase SQL Editor (`NOTIFY pgrst, 'reload schema'`). Existing agents immediately default safely (`stt_model = 'whisper-large-v3-turbo'`, `groq_fallback_enabled = false`, limits = `0`).
2. **Netlify Environment Variables:**
   - Add **`GROQ_API_KEY`** (`gsk_...` from your Groq Console) in Netlify -> Site configuration -> Environment variables.
3. **Website & Netlify Functions Deploy:**
   - Push/deploy website + Functions (`netlify/functions/api.ts`, `apps/api/live.ts`, `AgentAiPolicySection.tsx`, `packages/shared/*`) so Netlify Functions receive `process.env.GROQ_API_KEY`.
   - *(Note: If you ever swap `GROQ_API_KEY` later in Netlify UI, always run **Trigger deploy** in Netlify so serverless Functions pick up the new value.)*
4. **Configure Admin Panel (`/admin/releases`):**
   - For **Voro** & **Nexus**: verify `stt_model` (`whisper-large-v3-turbo`), decide whether **Allow NORVI Fallback Groq API Key** should be `Enabled` or `Disabled`, and optionally enter hidden `1-Day`, `1-Week`, `1-Month`, and `Free Trial 1-Day` fallback limits.
5. **Live Production Smoke Probes (`nor-vi.in`):**
   - Confirm public `GET /api/catalog` contains zero `stt_model`, `groq_fallback_enabled`, or `GROQ_API_KEY` traces.
   - Confirm unauthenticated `GET /api/agent-stt/config` and `POST /api/agent-stt/v1/audio/transcriptions` reject with `401`.
   - Live-test Voro & Nexus with personal Groq key (verify Admin-configured `stt_model` is used) and with blank Groq key (verify NORVI fallback toggle ON vs OFF behavior + Nexus >4 MB video transcription!).

---

## 3. Adding Any Future Audio-Enabled Agent Later

No new database tables or Netlify API endpoints are ever required for future agents:
1. Create the new product in `/admin/products`.
2. In `/admin/releases`, set its **Groq STT Model**, toggle **NORVI Fallback Groq API Key** ON/OFF, and set hidden `1d / 1w / 1m / trial_1d` limits.
3. In the new desktop agent, simply:
   - Call `GET https://nor-vi.in/api/agent-stt/config` with `Bearer <LEASE_JWT>`, `X-Norvi-Device`, and `X-Norvi-Product: <new_slug>` to read `{ stt_model, fallback_enabled }`.
   - Use user's Groq key directly with `stt_model` if provided; otherwise POST `< 4 MB` audio chunks to `POST https://nor-vi.in/api/agent-stt/v1/audio/transcriptions` if `fallback_enabled == true`.
