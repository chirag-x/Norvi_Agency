# NORVI Multi-Agent OpenRouter Cloud AI & Admin Control Upgrade

> **Status:** Planning / Design Review (No code changes implemented yet)  
> **Scope:** NORVI Website Admin Panel (`Agent Releases` tab), Supabase Database & Edge Proxy, and all Desktop Agents (**Voro**, **Nexus**, **Rolvio**, and future agents).  
> **Non-Goal / Unchanged:** Speech-to-Text (**STT / Groq Whisper / Faster-Whisper**) in Voro and Nexus remains **100% untouched**.

---

## 1. Why We Are Doing This Upgrade

1. **Ollama Cloud free access ended:** Customers can no longer rely on free `gemma4:cloud` access through a local Ollama install.
2. **Eliminate Ollama desktop installation completely:** Users on low-end PCs no longer need to download, install, or run `OllamaSetup.exe`.
3. **One centralized OpenRouter account, zero key leaks:** NORVI pays OpenRouter directly using a single account/key stored **only on the server** inside **Supabase Edge Function Secrets** (`OPENROUTER_API_KEY`). No desktop `.exe` ever receives or stores the OpenRouter key.
4. **Full Admin Panel control (`Agent Releases` tab):**
   - Choose or type **any OpenRouter model ID per agent and per task** (e.g., separate models for Voro Voice/Text, Voro Coding, Voro Vision, Nexus Clip Analysis, Rolvio Job Matching, and any future agent task) without rebuilding desktop apps.
   - Configure **3 hidden per-license usage limits** per agent: **1-Day**, **1-Week**, and **1-Month** (plus optional Trial 1-Day cap), enforced silently server-side and **never exposed to customers**.
5. **No new third-party hosting vendor:** Uses your existing **Supabase** project (`Supabase Edge Functions` + `Postgres`) alongside your existing **NORVI Gatekeeper** HMAC Lease JWTs.

---

## 2. Target Architecture Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│  DESKTOP AGENTS (Voro / Nexus / Rolvio / Future Agents)                   │
│  • No Ollama app required; no user-facing AI model/provider dropdowns     │
│  • STT (Groq Whisper / Faster-Whisper) remains completely untouched       │
│  • Authenticates using NORVI Gatekeeper Lease JWT + Device ID             │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │ HTTPS POST .../functions/v1/agent-ai/v1/chat/completions
                                     │ Authorization: Bearer <NORVI_LEASE_JWT>
                                     │ X-Norvi-Device: <hardware_id>
                                     │ X-Norvi-Task: <task_key> (e.g. voice_text, vision, coding)
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  SUPABASE EDGE FUNCTION: agent-ai  (verify_jwt = false)                   │
│  1. Verify NORVI Lease JWT signature (LICENSE_ENCRYPTION_KEY) & expiry    │
│  2. Verify active license & active device in Supabase Postgres            │
│  3. Load private agent AI policy for productId (NEVER public /api/catalog)│
│  4. Resolve task_key -> Admin-configured OpenRouter Model ID              │
│  5. Atomic check & increment: 1-Day, 1-Week, and 1-Month hidden limits    │
│  6. Attach secret OPENROUTER_API_KEY + ZDR privacy + sort preference      │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │ HTTPS POST https://openrouter.ai/api/v1/chat/completions
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  OPENROUTER MULTI-PROVIDER CLOUD                                          │
│  • Scales to 100–1,000+ concurrent users across providers                 │
│  • Streams SSE tokens (Voro) or JSON (Nexus / Rolvio) back via proxy      │
│  • Edge Function logs token count & cost asynchronously in Supabase       │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Initial Task-Slot Mapping Across Agents

These task slots are configurable and extensible in the Admin Panel (**Agent Releases** tab) for current and future agents:

| Agent (`slug`) | Task Key (`X-Norvi-Task`) | Purpose in Code | Recommended Starting OpenRouter Model | Routing Preference |
| :--- | :--- | :--- | :--- | :--- |
| **Voro** (`voro`) | `voice_text` | Live interview conversational/behavioral answers | `google/gemma-4-26b-a4b-it` | `latency` |
| **Voro** (`voro`) | `coding` | Coding & algorithm mode (`AnswerMode.CODING`) | `google/gemma-4-31b-it` *(or `26b-a4b`)* | `latency` |
| **Voro** (`voro`) | `vision` | Screen OCR / LeetCode screenshot vision | `google/gemma-4-31b-it` | `latency` |
| **Nexus** (`nexus`) | `clip_analysis` | Long video transcript viral clip extraction (`JSON`) | `qwen/qwen3.5-flash-02-23` *(or `gemma-4-26b-a4b-it`)* | `price` |
| **Nexus** (`nexus`) | `social_copy` | Viral titles, descriptions, hashtags | `qwen/qwen3.5-flash-02-23` | `price` |
| **Rolvio** (`rolvio`) | `job_match` | ATS resume-vs-job compatibility scoring | `google/gemma-4-26b-a4b-it` *(or `openai/gpt-5-nano`)* | `price` |
| **Rolvio** (`rolvio`) | `form_answer` | Application screening question answers | `google/gemma-4-26b-a4b-it` | `price` |
| **Rolvio** (`rolvio`) | `email_classify` | Recruiter IMAP email classification | `google/gemma-4-26b-a4b-it` | `price` |
| **Rolvio** (`rolvio`) | `resume_parse` | Resume PDF/DOCX to structured JSON profile | `google/gemma-4-26b-a4b-it` | `price` |
| **Future Agents** | Custom keys + `default_model` | Added directly in Admin UI without SQL migrations | Any OpenRouter `provider/model` string | Configurable |

---

## 4. Phased Implementation Roadmap

Each phase is isolated, testable, and can be reviewed/deployed step by step:

| Phase | Document | Summary |
| :--- | :--- | :--- |
| **Phase 1** | [phase-01-database-schema-and-policies.md](./phase-01-database-schema-and-policies.md) | Private Supabase tables for per-agent task models & hidden 1d/1w/1m limits + atomic quota RPC + usage tracking. |
| **Phase 2** | [phase-02-admin-panel-agent-releases-ui.md](./phase-02-admin-panel-agent-releases-ui.md) | Admin API endpoints + **Agent Releases** UI to type/select OpenRouter models per task (current & future agents) and set hidden 1d/1w/1m limits. |
| **Phase 3** | [phase-03-supabase-edge-ai-proxy.md](./phase-03-supabase-edge-ai-proxy.md) | Supabase Edge Function `agent-ai` (Lease JWT validation, hidden quota enforcement, server-side model lock, OpenRouter SSE/JSON streaming, usage logging). |
| **Phase 4** | [phase-04-voro-upgrade.md](./phase-04-voro-upgrade.md) | Upgrade **Voro** to use the NORVI OpenRouter proxy for `voice_text`, `coding`, and `vision`; remove Ollama requirement; keep STT untouched. |
| **Phase 5** | [phase-05-nexus-upgrade.md](./phase-05-nexus-upgrade.md) | Upgrade **Nexus** to use the NORVI OpenRouter proxy via existing `SessionManager` Lease JWT for `clip_analysis` & `social_copy`; remove Ollama requirement; keep STT untouched. |
| **Phase 6** | [phase-06-rolvio-upgrade.md](./phase-06-rolvio-upgrade.md) | Wire **Rolvio**'s stubbed `NorviApiClient` to real `nor-vi.in` NORVI Gatekeeper auth + migrate `AIGateway` tasks to the OpenRouter proxy; remove Ollama requirement. |
| **Phase 7** | [phase-07-testing-rollout-and-future-agents.md](./phase-07-testing-rollout-and-future-agents.md) | End-to-end verification, security audit, secret rotation, cost monitoring, and repeatable guide for adding future agents. |
