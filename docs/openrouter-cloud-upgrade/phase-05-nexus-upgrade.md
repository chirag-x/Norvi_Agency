# Phase 5 — Nexus Desktop Agent Upgrade

**Goal:** Switch **Nexus** (`E:\Agency\_New folder\Nexus`) from local `http://127.0.0.1:11434/api/generate` (`gemma4:cloud` + Ollama app checks) to the **NORVI Supabase OpenRouter Proxy**, reusing Nexus's existing `SessionManager` Lease JWT while leaving **STT (`src/services/ai/transcriber.py` / `src/media/transcription/transcriber.py`) 100% untouched**.

---

## 1. Current State Observed in Nexus

- **NORVI Licensing Already Exists:**
  - `src/services/auth/client.py` (`AuthClient`) already runs `/api/agent-auth/login`, `/api/agent-auth/activate` (`PRODUCT_SLUG = "nexus"`), and `/api/agent-auth/verify`.
  - `src/services/auth/session.py` (`SessionManager`) already saves the Lease JWT to `~/.norvi_nexus_lease` and exposes `SessionManager.get_token()` and `SessionManager.is_authenticated()`.
  - `src/services/auth/hwid.py` provides `get_hardware_id()`.
- **Current Ollama Usage:**
  - `src/services/ai/gemma_engine.py`:
    1. `analyze_transcript(...)` — sends full timestamped transcript to `http://127.0.0.1:11434/api/generate` (`format: "json"`) for viral clip extraction (called by `src/ui/views/clip_lab.py`).
    2. `generate_text(...)` — sends prompt to `http://127.0.0.1:11434/api/generate` for titles, descriptions, and hashtags (called by `src/ui/views/publishing_queue.py`).
  - `src/ai/ollama_manager.py` & `src/ai/model_manager.py`: check/start `ollama serve`, pull/smoke-test `gemma4:cloud`.
  - `src/app/main.py`, `src/ui/main_window.py`, `src/ui/views/dashboard.py`, `src/ui/views/help.py`: launch Ollama, run a health watchdog timer, and show "Step 1: Install Ollama" setup blockers.

---

## 2. Exact Changes Planned for Nexus

### A. Upgrade `GemmaEngine` (`src/services/ai/gemma_engine.py`)
- Replace Ollama's `/api/generate` schema (`prompt`, `format: "json"`, `options.num_ctx`) with OpenAI-compatible `POST https://nor-vi.in/api/agent-ai/v1/chat/completions` (keeping long-transcript chunks sized to finish comfortably within Netlify's 60s function timeout):
  - Headers:
    - `Authorization: Bearer <SessionManager.get_token()>`
    - `X-Norvi-Device: <get_hardware_id()>`
    - `X-Norvi-Task: clip_analysis` (for `analyze_transcript`) or `social_copy` (for `generate_text`)
  - For `analyze_transcript`:
    - Send proper `messages: [{ role: "system", content: system_prompt }, { role: "user", content: user_prompt }]`
    - Pass `response_format: { type: "json_object" }` (or keep existing robust JSON array/fence parser so both JSON array and `{ "clips": [...] }` outputs parse cleanly across any OpenRouter model!).
    - Keep the existing post-processing duration splitter (`max_clip_duration`) intact.
  - Handle `401` (attempt lease refresh via `SessionManager.is_authenticated()` once and retry) and `429` (clean user-facing error without revealing hidden limits).

### B. Remove Local Ollama Dependencies Across Lifecycle & UI
- `src/ui/main_window.py`: remove `OllamaManager.get_instance().stop_sandboxed()` shutdown dependency.
- `src/ui/views/dashboard.py`:
  - Remove `OllamaManager` watchdog timer and `ollama_installed` check.
  - Setup status check verifies **only** active NORVI cloud auth/lease + Whisper/Groq STT readiness (**keep `transcriber.py` untouched**).
- `src/ui/views/help.py`:
  - Remove "Step 1: Download & Install Ollama" frame; keep Groq STT guide & Clip Lab instructions.
- `src/app/main.py` & `src/config/config.py`:
  - Replace `ollama_host` / `ollama_model` references with `norvi_ai_url` (defaulting to `https://nor-vi.in/api/agent-ai/v1`).
  - Do **not** add any user-facing model/provider picker in `src/ui/views/settings.py`.

---

## 3. Phase 5 Acceptance Criteria

- [ ] Nexus launches and runs Clip Lab (`clip_analysis`) + Publishing Queue copy generation (`social_copy`) on a PC **without Ollama installed**.
- [ ] `clip_analysis` and `social_copy` each respect the model set in the Admin Panel (`/admin/releases` → Nexus).
- [ ] JSON clip parsing handles both `[{...}]` and `{"clips": [{...}]}` responses reliably across models (e.g., `gemma-4-26b-a4b-it`, `qwen/qwen3.5-flash-02-23`).
- [ ] Groq Whisper & local Faster-Whisper transcription remain unchanged.
