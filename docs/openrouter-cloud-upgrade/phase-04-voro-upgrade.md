# Phase 4 — Voro Desktop Agent Upgrade

**Goal:** Switch **Voro** (`E:\Agency\_New folder\Voro`) from local `http://localhost:11434/v1` (`gemma4:cloud` + Ollama app requirement) to the **NORVI Supabase OpenRouter Proxy**, mapping Voro's 3 internal task providers (`voice_text`, `coding`, `vision`) to your Admin Panel models while leaving **STT (`app/speech/stt.py`) 100% untouched**.

---

## 1. Current State Observed in Voro

- `app/core/application.py`:
  - `reload_ai_provider()` (lines 991–1014) creates a single `OpenRouterProvider` pointing to `http://localhost:11434/v1` with `model="gemma4:cloud"` and `api_key="ollama_local"`, and reuses it for `ai_provider`, `ai_coding_provider`, and `ai_vision_provider`.
  - `__init__` / startup launches `OllamaManager(target_model="gemma4:cloud")` background setup.
  - `check_setup_status()` (lines 272–320) blocks Voro unless `ollama_installed` is `True`.
- `app/answer/engine.py` (lines 158–164):
  - `_pick_provider(b64, mode)` **already** splits requests into 3 distinct paths:
    1. `b64` image present → `self.ai_vision_provider`
    2. `mode == AnswerMode.CODING` → `self.ai_coding_provider`
    3. Everything else → `self.ai_provider`
- `app/ai/openrouter.py`:
  - Already implements `/chat/completions` streaming SSE and multimodal `image_url` payloads!
  - Injects local Ollama-only keys (`keep_alive`, `options.num_ctx`) when `"11434"` or `"localhost"` is in `base_url`.
- `app/core/norvi_gatekeeper.py`:
  - Stores the NORVI Lease JWT in `~/.norvi_voro_lease`, verifies daily against `https://nor-vi.in/api/agent-auth/verify`, and provides `get_hardware_id()`.
- `app/ui/settings.py` & `app/ui/tutorial.py`:
  - Shows "Step 1: Install Ollama" setup cards and readiness indicators.

---

## 2. Exact Changes Planned for Voro

### A. Lease Token Provider Helper (`app/core/norvi_gatekeeper.py`)
- Add `get_valid_lease_token(product_slug="voro") -> str`:
  - Reads `~/.norvi_voro_lease`.
  - If expired or missing, triggers `verify_online_lease("voro")` (or surfaces re-activation error if revoked).
  - Returns `(lease_jwt, hardware_id)` so AI requests always carry a fresh token.

### B. `OpenRouterProvider` Updates (`app/ai/openrouter.py`)
- Accept optional `task_key` (e.g. `"voice_text"`, `"coding"`, `"vision"`) and a `token_provider` callable (so every request gets the current Lease JWT rather than a stale token cached at app startup).
- Send headers:
  - `Authorization: Bearer <lease_jwt>`
  - `X-Norvi-Device: <hardware_id>`
  - `X-Norvi-Task: <task_key>`
- **Image Optimization (Saves Vision Tokens & Speeds Up Latency):**
  - Before encoding/sending `base64_image`, resize screenshots wider than e.g. 1280px and encode as JPEG (quality ~80–85) instead of huge uncompressed PNGs when appropriate — cuts vision input tokens significantly with crisp code readability.
- **Error Handling & Auto-Retry:**
  - If proxy returns `401` (lease just expired mid-interview), call `verify_online_lease("voro")` once and retry automatically!
  - If proxy returns `429` (cooldown / hidden limit / upstream busy), display a clean, non-technical status message (`"AI is temporarily busy. Please try again in a moment."`) without mentioning hidden limits.
- Remove local Ollama payload fields (`keep_alive`, `options`).

### C. Wire the 3 Task Providers (`app/core/application.py`)
- Point `NORVI_AI_BASE_URL` (default `https://nor-vi.in/api/agent-ai/v1`) in `reload_ai_provider()`:
  - `self.ai_provider = OpenRouterProvider(..., task_key="voice_text")`
  - `ai_coding_provider = OpenRouterProvider(..., task_key="coding")`
  - `ai_vision_provider = OpenRouterProvider(..., task_key="vision")`
- Remove `OllamaManager.start_setup_thread()` from startup.
- Update `check_setup_status()` so it checks **only**:
  1. Valid active NORVI Lease (`norvi_gatekeeper`)
  2. Voice STT readiness (`stt_ready` — Groq API key or local Whisper model; **no change to `stt.py`**)
- Update `setup` / `error` messages to no longer mention Ollama.

### D. UI Cleanup (`app/ui/settings.py`, `app/ui/tutorial.py`)
- Remove the **"Step 1: Download Ollama (Windows)"** box and Ollama installation status checks from Quick Setup Guide / Settings.
- Do **not** add any user-facing model selector or provider dropdown (AI model & provider are locked and managed from your Admin Panel).
- Leave the **Audio / Groq STT** settings tab completely untouched.

---

## 3. Phase 4 Acceptance Criteria

- [ ] Voro runs cleanly on a fresh Windows PC **with NO Ollama installed**.
- [ ] Voice/behavioral questions trigger `X-Norvi-Task: voice_text` and stream tokens via SSE.
- [ ] Coding questions trigger `X-Norvi-Task: coding` and use the Coding model set in Admin Panel.
- [ ] Screen capture / LeetCode questions trigger `X-Norvi-Task: vision` and use the Vision model set in Admin Panel.
- [ ] Changing any of those 3 model names in `/admin/releases` changes Voro's model immediately on the next question without restarting or updating Voro.
- [ ] Groq STT and local Whisper transcription behave identically to before.
