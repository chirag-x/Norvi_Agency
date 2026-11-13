# Phase 4 — Voro Desktop Agent Upgrade

**Goal:** Upgrade **Voro** (`E:\Agency\_New folder\Voro`) so it:
1. Automatically uses the **Admin-configured Groq STT model** (both when the user enters their own Groq API key AND when using NORVI's fallback Groq key).
2. Seamlessly uses **NORVI's Netlify Fallback Groq proxy** when the user leaves `groq_api_key` empty and Admin enables fallback for `voro`.
3. Keeps **~0.4s ultra-low transcription latency** whenever a user provides their own Groq key (direct to `api.groq.com`), while adding zero pre-turn config blocking during live interviews.

---

## 1. Current State Observed in Voro

- `app/speech/stt.py`:
  - `SpeechToText.transcribe()` (lines 164–225) sends audio WAV chunks directly to `https://api.groq.com/openai/v1/audio/transcriptions` with hardcoded `"model": "whisper-large-v3-turbo"` when `clean_groq_key` is present, and falls back to local `faster-whisper` on failure.
- `app/core/norvi_gatekeeper.py`:
  - Provides `API_BASE_URL`, `get_lease_token(product_slug="voro")`, `verify_online_lease("voro")`, and `get_hardware_id()`.
- `app/core/application.py`:
  - `check_setup_status()` (lines 290–320) and `stt_worker` (lines 678–688) block/warn with `"Setup is not completed... Voice Recognition is not ready"` if neither `config.groq_api_key` nor a local Faster-Whisper model is found.
- `app/ui/settings.py`:
  - Audio tab lets users paste their `groq_api_key` (`_test_groq_key()` at lines 3120–3164 validates via `GET https://api.groq.com/openai/v1/models`) and shows readiness status pills (`_is_stt_ready()` / lines 3356–3488).

---

## 2. Exact Changes Planned for Voro

### A. Live STT Policy Sync (`app/core/norvi_gatekeeper.py`)
1. Add `get_stt_base_url()` -> `{API_BASE_URL}/api/agent-stt`.
2. Add `get_stt_policy(product_slug="voro", force_refresh=False) -> dict`:
   - Returns cached `{ "stt_model": "whisper-large-v3-turbo", "fallback_enabled": False }` synced from `GET /api/agent-stt/config` using `Authorization: Bearer <lease_jwt>`, `X-Norvi-Device: <hwid>`, `X-Norvi-Product: voro`.
   - Uses an in-memory TTL cache (e.g., 5 minutes) + startup pre-warm in a background thread right after login/startup so live speech utterances **never wait** for an extra config HTTP round-trip!
   - If offline / request fails, safely returns last cached policy or default `whisper-large-v3-turbo` (`fallback_enabled: False` unless cached `True` during current valid lease).

### B. 3-Tier STT Routing (`app/speech/stt.py`)
Update `SpeechToText.__init__` and `SpeechToText.transcribe`:
- Accept a `policy_provider` (returns `(stt_model, fallback_enabled)`) and `lease_token_provider` / `hwid_provider`.
- On each `transcribe()` call:
  1. **Resolve active Groq STT model** from cached policy (`stt_model`, fallback `"whisper-large-v3-turbo"`).
  2. **Priority 1 — User's Own Groq Key (`clean_groq_key` is non-empty):**
     - Post directly to `https://api.groq.com/openai/v1/audio/transcriptions` with `Authorization: Bearer {clean_groq_key}` and `"model": active_stt_model` (no Netlify hop -> preserves ~0.4s latency!).
  3. **Priority 2 — NORVI Fallback Groq Key (`clean_groq_key` is empty AND `fallback_enabled == True`):**
     - Post `multipart/form-data` audio WAV (`< 1 MB`) to `https://nor-vi.in/api/agent-stt/v1/audio/transcriptions` with `Authorization: Bearer {lease_jwt}`, `X-Norvi-Device: {hwid}`, `X-Norvi-Product: voro`.
     - Retry once on HTTP `401` by refreshing `verify_online_lease("voro")`.
     - If NORVI returns `403` (`fallback_disabled`), update local cached `fallback_enabled = False` cleanly and fall back to Priority 3.
     - If NORVI returns `429` (cooldown), log warning cleanly and fall back to Priority 3 (or emit friendly cooldown hint if no local backup model exists — **never exposing hidden limits**).
  4. **Priority 3 — Local Faster-Whisper Backup:**
     - Same automatic local transcription fallback as today whenever cloud STT is unavailable/disabled/fails and local model exists.
- Update `SpeechToText.is_model_available()`:
  - Returns `True` if ANY of the 3 tiers is ready (`clean_groq_key` OR `fallback_enabled` with active lease OR local Faster-Whisper model downloaded).

### C. Startup Readiness & Setup Blocker Updates (`app/core/application.py`)
- Ensure `VoroApplication` pre-warms `get_stt_policy("voro")` on startup and exposes live status to `SpeechToText`.
- Update `check_setup_status()` and `stt_worker`:
  - When `self.stt.is_model_available()` is `True` (including when `fallback_enabled == True` via Admin Releases even with NO personal Groq key and NO offline Whisper download!), Voro starts interviewing **immediately with zero setup errors**.

### D. Audio Settings UI & Key Test Polish (`app/ui/settings.py` & `app/ui/tutorial.py`)
- Update readiness indicator (`_is_stt_ready` & status badge at lines 3486–3488):
  - User Groq Key present -> `"🟢 Ready (Personal Groq Cloud Speech)"`
  - No user key + NORVI Fallback ON -> `"🟢 Ready (NORVI Cloud Speech Fallback — Add optional personal Groq key for lowest latency)"`
  - Neither + local Whisper downloaded -> `"🟡 Ready (Offline Backup Model)"`
  - Nothing available -> existing prompt to add free Groq key or download offline backup.
- Update `_test_groq_key()`: keep `GET /models` key validation AND optionally verify that the currently Admin-configured `stt_model` appears in Groq's returned models list (or handle nicely if unlisted) without letting users override the model.

---

## 3. Voro Verification Plan
- Unit tests mocking:
  1. Config sync from `/api/agent-stt/config` dynamically changing `"whisper-large-v3-turbo"` -> custom model `"custom-stt-v4"`.
  2. User Groq key present -> sends direct to `api.groq.com` using custom Admin model (NEVER calls `/api/agent-stt`).
  3. User Groq key empty + `fallback_enabled=True` -> sends to `/api/agent-stt/v1/audio/transcriptions` with Lease JWT + HWID, `is_model_available()` is `True`, `check_setup_status()` returns `(True, "")`.
  4. User Groq key empty + `fallback_enabled=False` -> NEVER calls `/api/agent-stt`; uses local Faster-Whisper if available or shows setup error.
  5. Fallback HTTP `401` refreshes lease once; HTTP `429` handles non-numeric cooldown safely without crashing interview.
