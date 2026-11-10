# Phase 7 — Verification, Security Audit, Rollout & Future Agent Guide

**Goal:** Safely deploy the entire upgrade to production, verify security and hidden limits, monitor OpenRouter margins, and standardize how **future agents** plug into this system.

---

## 1. Pre-Launch Security & Privacy Verification

Run these checks before shipping updated installers (`Voro`, `Nexus`, `Rolvio`) to customers:

1. **Zero Secret Leakage Check:**
   - Search all desktop codebases (`Voro/`, `Nexus/`, `Rolvio/`) and built `.exe` strings to confirm `sk-or-v1-` (`OPENROUTER_API_KEY`) never appears anywhere on the client side.
   - Confirm `OPENROUTER_API_KEY` and `LICENSE_ENCRYPTION_KEY` exist **only** in Netlify server environment variables (and `.env.local` for local dev).
2. **Hidden Limits Leak Check:**
   - Call `GET https://nor-vi.in/api/catalog` unauthenticated → verify `daily_limit`, `weekly_limit`, `monthly_limit`, `trial_daily_limit`, and `task_models` are **absent**.
   - Call `/api/agent-auth/activate` & `/api/agent-auth/verify` → verify the Lease JWT payload contains only `{ license_id, device_id, exp, product }`.
   - Force a license past its `1-day` limit → confirm HTTP `429` returns only a generic cooldown message without numeric limit details.
3. **Model Lock Tamper Test:**
   - Send a spoofed request to `/api/agent-ai/v1/chat/completions` with `"model": "anthropic/claude-opus-4"` in the JSON body → confirm the backend proxy ignores the client field and executes only the Admin Panel's configured OpenRouter model.
4. **Device Binding Test:**
   - Copy a valid `.norvi_voro_lease` token to another machine (`X-Norvi-Device` mismatch) → confirm `agent-ai` rejects with `403`.
5. **Revocation Kill-Switch Test:**
   - Revoke a license in Admin Panel → confirm `agent-ai` immediately blocks subsequent AI calls (even if the 24h Lease JWT has not yet expired!).

---

## 2. Functional & Performance Rollout Order

Deploy in this exact order so nothing breaks live users:

1. **Step 1:** Run Supabase migration `063_agent_ai_policies.sql` (Phase 1).
2. **Step 2:** Deploy Admin API + **Agent Releases** UI update to `nor-vi.in` (Phase 2), configure initial OpenRouter models and 1d/1w/1m limits for `voro`, `nexus`, `rolvio`.
3. **Step 3:** Set `OPENROUTER_API_KEY` in Netlify Environment Variables and deploy the updated Netlify site with `/api/agent-ai/*` (Phase 3). Test `GET /api/agent-ai/health` and `POST /api/agent-ai/v1/chat/completions`.
4. **Step 4:** Upgrade & release **Voro** first (Phase 4) — test live interview streaming latency, coding answers, screenshot vision, and verify Groq STT still works identically.
5. **Step 5:** Upgrade & release **Nexus** (Phase 5) — test long video clip JSON extraction and social caption generation + Whisper STT untouched.
6. **Step 6:** Upgrade & release **Rolvio** (Phase 6) — test live `nor-vi.in` login/activation + all 4 AI tasks.
7. **Step 7:** Update website setup guides (`catalog.json` / Admin Setup Guide editor) to remove "Download Ollama" instructions once the new installers are live.

---

## 3. Operational Monitoring (Cost & Concurrency)

- **OpenRouter Dashboard:**
  - Enable **Auto Top-Up** or low-balance alerts so active concurrent users never hit OpenRouter `402 Payment Required` in-flight ceilings.
  - Verify ZDR / privacy settings match your `data_collection: "deny"` policy.
- **NORVI Admin Panel (`Agent Releases`):**
  - Review the 24h / 7d / 30d usage & cost indicators per agent weekly.
  - If a model becomes cheaper or better on OpenRouter (e.g., swapping `gemma-4-31b-it` → `gemma-4-26b-a4b-it` or `qwen/qwen3.5-flash-02-23`), simply type the new OpenRouter model ID in `/admin/releases` and click Save — **all live desktop users get the new model instantly with zero app update.**

---

## 4. How Future Agents Connect (Zero Backend Rework Needed)

Whenever you build **Agent #4, #5, or #10** in the future:

1. **Create the product** in Admin Panel (`/admin/products`), noting its `slug` (e.g., `syntra`).
2. **Configure AI models & hidden limits** in `/admin/releases`:
   - Enter `Default Model` + click `+ Add Task Model` for each task in the new agent (e.g., `drafting`, `vision`, `research`).
   - Set `1-Day`, `1-Week`, `1-Month`, and `Trial 1-Day` hidden limits.
3. **In the new agent's Python/App code:**
   - Authenticate via `/api/agent-auth/login` + `/api/agent-auth/activate` (`productSlug: "syntra"`).
   - Point any OpenAI SDK / `httpx` client at `https://nor-vi.in/api/agent-ai/v1/chat/completions` with `Authorization: Bearer <lease_jwt>`, `X-Norvi-Device: <hwid>`, and `X-Norvi-Task: <task_key>`.

No new SQL migrations, no new Netlify functions, and no user-facing API keys required.
