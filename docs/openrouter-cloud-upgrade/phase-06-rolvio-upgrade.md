# Phase 6 — Rolvio Desktop Agent Upgrade (Auth Wiring + OpenRouter Proxy)

**Goal:** Connect **Rolvio** (`E:\Agency\_New folder\Rolvio`) to real NORVI Gatekeeper licensing on `nor-vi.in` (replacing the current stub in `src/rolvio/core/api.py`) and switch all 4 AI tasks in `src/rolvio/core/ai_gateway.py` from local Ollama (`localhost:11434`) to the **NORVI Supabase OpenRouter Proxy**.

---

## 1. Current State Observed in Rolvio

- **Auth Is Currently Stubbed (`src/rolvio/core/api.py` & `src/rolvio/core/auth.py`):**
  - `NorviApiClient` currently defaults `base_url = "https://api.norvi.com"` and returns `"mock_secure_token_123"` with stubbed validation (`return token == "mock_secure_token_123"`).
  - Because our Netlify AI proxy authenticates requests via a real signed **NORVI Lease JWT**, Rolvio **must** connect to your real `https://nor-vi.in/api/agent-auth/*` endpoints first.
- **Current AI Calls (`src/rolvio/core/ai_gateway.py`):**
  - Calls `http://localhost:11434/api/generate` (`model="gemma4:cloud"`) across 4 distinct methods:
    1. `evaluate_job_match()` — ATS compatibility scoring (high volume!)
    2. `solve_form_field()` — screening question answers
    3. `classify_email()` — IMAP recruiter email classification
    4. `parse_resume_to_profile()` — resume text → JSON `CandidateProfile`
- **Startup Dependency (`src/rolvio/ui/orchestrator.py`):**
  - `_async_startup_tasks()` (lines 161–171) calls `self.ollama.start_silently()` and `self.ollama.check_health(retries=3)`.

---

## 2. Exact Changes Planned for Rolvio

### A. Real NORVI Gatekeeper Integration (`src/rolvio/core/api.py`, `auth.py`, `orchestrator.py`)
- Update `NorviApiClient`:
  - Base URL: `os.getenv("NORVI_API_URL", "https://nor-vi.in")`
  - Generate consistent Windows hardware ID (`platform.node()` + `uuid.getnode()`, matching Voro & Nexus).
  - `login(request)`:
    1. `POST /api/agent-auth/login` with `{ email, password }` → get `access_token`.
    2. `POST /api/agent-auth/activate` with `{ licenseKey, deviceId, productSlug: "rolvio" }` and `Bearer <access_token>` → get real signed `lease` JWT + `expires_at`.
  - `validate_session(token, license_key=None)`:
    - `POST /api/agent-auth/verify` with `{ deviceId, productSlug: "rolvio", lease: token }` → refreshes and returns fresh 24-hour `lease` JWT (with 24h offline resilience fallback if server unreachable briefly, matching Voro/Nexus).
  - Store `lease` JWT, `expires_at`, `last_verified_at`, and `license_key` securely in `WindowsCredentialStore` (under `"NorviRolvioApp"`).

### B. Upgrade `AIGateway` (`src/rolvio/core/ai_gateway.py`)
- Add `_generate_json(task_key: str, system: str, prompt: str, ...)` targeting `https://nor-vi.in/api/agent-ai/v1/chat/completions`:
  - Headers:
    - `Authorization: Bearer <lease_jwt>`
    - `X-Norvi-Device: <hardware_id>`
    - `X-Norvi-Task: <task_key>`
  - Payload uses `messages: [{"role": "system", "content": system}, {"role": "user", "content": prompt}]` and `response_format: {"type": "json_object"}`.
  - Tag each method with its Admin Panel task key:
    - `evaluate_job_match` → `X-Norvi-Task: job_match`
    - `solve_form_field` → `X-Norvi-Task: form_answer`
    - `classify_email` → `X-Norvi-Task: email_classify`
    - `parse_resume_to_profile` → `X-Norvi-Task: resume_parse`
- **Cost-Saver Optimization for `job_match`:**
  - Before sending a scraped job description to cloud AI, add a fast local pre-filter (check required title/skill overlap or skip already-scored `job_id`s in SQLite) so Rolvio does not waste OpenRouter tokens and daily/weekly quota on completely irrelevant jobs.
- Handle `401` (auto-refresh lease once via `NorviApiClient.validate_session`) and `429` (graceful pause/cooldown without exposing hidden quotas).

### C. Remove Ollama Boot Checks (`src/rolvio/ui/orchestrator.py`)
- Remove `OllamaManager` startup (`start_silently` / `check_health`) from `_async_startup_tasks()`.
- Replace status text with `"Verifying NORVI Cloud AI connection..."` (quick license/session ready state, no local binary check).
- Ensure there is no user-facing model or provider selector UI.

---

## 3. Phase 6 Acceptance Criteria

- [ ] Rolvio authenticates against real `https://nor-vi.in/api/agent-auth/*` (no mock tokens remain).
- [ ] All 4 AI workflows (resume parsing, job matching, screening answers, email classification) succeed on a PC **without Ollama installed**.
- [ ] Each of the 4 tasks uses the specific OpenRouter model configured in `/admin/releases` → Rolvio.
- [ ] Duplicate or wildly mismatched scraped jobs are filtered locally before consuming cloud AI quota.
