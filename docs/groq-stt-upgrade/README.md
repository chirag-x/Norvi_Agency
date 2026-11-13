# NORVI Multi-Agent Centralized Groq STT & Fallback Proxy Upgrade

> **Status:** Planned / Approved Blueprint (Zero code changes made yet)  
> **Scope:** NORVI Admin Releases UI (`AgentAiPolicySection`), Supabase Postgres (`agent_ai_policies` + `agent_stt_usage_logs`), Netlify Backend Proxy (`/api/agent-stt/*`), and Desktop Agents (**Voro**, **Nexus**, **Rolvio**-compatible architecture & future agents).  
> **Non-Goal:** Does NOT move Speech-to-Text onto OpenRouter. STT remains **100% Groq Whisper** (with existing local `faster-whisper` offline fallback preserved).

---

## 1. Why We Are Doing This Upgrade

1. **Eliminate Hardcoded Groq STT Models in Desktop Apps:**
   - Currently **Voro** hardcodes `"whisper-large-v3-turbo"` inside `app/speech/stt.py`, and **Nexus** lets users choose between `"whisper-large-v3"` and `"whisper-large-v3-turbo"` in Settings (`QSettings`).
   - If Groq deprecates `whisper-large-v3-turbo` or releases a faster/better speech model, existing `.exe` builds would break until patched and re-released.
   - Moving STT model configuration into **Admin Panel -> Releases** ensures every active desktop installation automatically uses the exact Groq STT model you configure centrally.

2. **Remove Manual Model Choice in Nexus Settings:**
   - Nexus's `"Groq Model"` dropdown (`whisper-large-v3` / `whisper-large-v3-turbo`) is removed so **all users** receive identical, admin-controlled transcription behavior configured exclusively from NORVI Admin Releases.

3. **Keep User-Owned Free Groq Keys Working — Plus Add Optional Server Fallback:**
   - Users can still paste their own free Groq API key (`gsk_...`) into Voro or Nexus Settings (`Priority 1`: fast direct `api.groq.com` upload, `$0` server quota used by NORVI, still enforcing your Admin-chosen `stt_model`).
   - If a user leaves their Groq key blank AND **NORVI Fallback Groq Key** is enabled for that agent in Admin Releases, the desktop app routes STT through your authenticated Netlify backend using **your private Netlify `GROQ_API_KEY`**.
   - A per-agent **Enable / Disable toggle** in Admin Releases lets you turn NORVI's fallback Groq key ON or OFF independently for Voro, Nexus, Rolvio, or any future agent.

4. **Hidden Server-Side Fallback Quota Protection (Paid & 1-Day Trial):**
   - Separate from OpenRouter chat/vision limits, Admin Releases lets you configure silent per-license **1-Day**, **1-Week**, **1-Month**, and **Free Trial 1-Day** limits specifically for NORVI's fallback Groq STT endpoint (`0 = unlimited`).
   - Customers using their own Groq key never consume NORVI fallback limits.

5. **Safe Support for Long Nexus Videos Under Netlify's 6 MB Request Ceiling:**
   - Voro audio clips are short (~60 KB–500 KB WAV) and pass through Netlify directly.
   - Nexus transcribes full videos up to **25 MB** MP3. When a user relies on **NORVI's Netlify fallback key** (and ONLY then — never when using their own Groq key or local Faster-Whisper), Nexus uses its bundled **FFmpeg (`imageio_ffmpeg`)** to re-encode/split audio into chunks strictly **under 4 MB**, transcribes them cleanly, and stitches exact timestamps back together.

---

## 2. Target Architecture & Priority Flow

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ DESKTOP AGENT (Voro / Nexus / Future Audio Agents)                         │
│                                                                            │
│  0. Sync STT Config (startup + short TTL cache, NOT blocking each mic turn)│
│     GET https://nor-vi.in/api/agent-stt/config                             │
│     Headers: Bearer <LEASE_JWT>, X-Norvi-Device, X-Norvi-Product           │
│     Returns: { "stt_model": "<admin_model>", "fallback_enabled": true/false }
│                                                                            │
│  1. Priority 1 — User Entered Personal Groq Key (gsk_...)                  │
│     -> Direct HTTPS POST https://api.groq.com/openai/v1/audio/transcriptions
│     -> Uses USER key + ADMIN `stt_model`                                   │
│     -> Nexus sends full file up to 25 MB as-is (NO FFmpeg <4 MB splitting) │
│                                                                            │
│  2. Priority 2 — No Personal Key + Admin `fallback_enabled == true`        │
│     -> Nexus checks file size: ONLY if > ~3.8 MB, FFmpeg splits < 4 MB     │
│     -> HTTPS POST https://nor-vi.in/api/agent-stt/v1/audio/transcriptions  │
│     -> Headers: Bearer <LEASE_JWT>, X-Norvi-Device, X-Norvi-Product        │
│     -> Server validates license/device, 1d/1w/1m/trial STT limits,         │
│        attaches Netlify `GROQ_API_KEY`, locks `model = policy.stt_model`   │
│                                                                            │
│  3. Priority 3 — Local Offline Faster-Whisper / Setup Prompt               │
│     -> Used if `fallback_enabled == false` (with no user key), offline, or │
│        selected explicitly / as resilience backup                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Behavior Matrix

| Scenario | Groq STT Model Used | Auth / Key Used | Nexus >4 MB FFmpeg Split? | Counts Against NORVI STT Limit? |
| :--- | :--- | :--- | :--- | :--- |
| **User has own `gsk_...` key** | Admin `stt_model` | User's Groq Key (Direct to Groq) | **No** (keeps 25 MB direct flow) | **No** (`$0` NORVI cost) |
| **No user key + Admin Toggle ON (Paid)** | Admin `stt_model` | NORVI Netlify `GROQ_API_KEY` Proxy | **Yes** (only if file > ~3.8 MB) | **Yes** (`1d / 1w / 1m` paid caps) |
| **No user key + Admin Toggle ON (1-Day Trial)** | Admin `stt_model` | NORVI Netlify `GROQ_API_KEY` Proxy | **Yes** (only if file > ~3.8 MB) | **Yes** (`Trial 1d` + `1w / 1m` caps) |
| **No user key + Admin Toggle OFF** | Local / None | Blocked from NORVI Groq Proxy | **No** | **No** |
| **Nexus Engine = Local (Faster-Whisper)** | User's Local Whisper Size | Offline CPU/GPU | **No** (runs identically to today) | **No** |

---

## 4. Phased Implementation Roadmap

| Phase | Document | Summary |
| :--- | :--- | :--- |
| **Phase 1** | [phase-01-database-schema-and-stt-policies.md](./phase-01-database-schema-and-stt-policies.md) | Migration `064_agent_stt_policies.sql`: add `stt_model`, `groq_fallback_enabled`, and hidden STT 1d/1w/1m/trial caps to `agent_ai_policies`, create `agent_stt_usage_logs`, and add/update Supabase RPCs. |
| **Phase 2** | [phase-02-admin-panel-stt-controls-ui.md](./phase-02-admin-panel-stt-controls-ui.md) | Shared types (`agentAi.ts`), Admin API routes (`apps/api/live.ts`), and `/admin/releases` UI (`AgentAiPolicySection.tsx`) with custom Groq STT model selector, fallback ON/OFF toggle, hidden 1d/1w/1m/trial STT limits, and live STT stats. |
| **Phase 3** | [phase-03-netlify-stt-config-and-fallback-proxy.md](./phase-03-netlify-stt-config-and-fallback-proxy.md) | Wire `GROQ_API_KEY` into Netlify Function (`netlify/functions/api.ts`), build `packages/shared/agentSttProxy.ts`, expose authenticated `GET /api/agent-stt/config` + `POST /api/agent-stt/v1/audio/transcriptions`. |
| **Phase 4** | [phase-04-voro-groq-stt-upgrade.md](./phase-04-voro-groq-stt-upgrade.md) | Upgrade Voro (`norvi_gatekeeper.py`, `app/speech/stt.py`, `app/core/application.py`, `app/ui/settings.py`) to sync Admin `stt_model`, support NORVI fallback when user key is empty, and lift setup blocker when fallback is active. |
| **Phase 5** | [phase-05-nexus-groq-stt-and-ffmpeg-split-upgrade.md](./phase-05-nexus-groq-stt-and-ffmpeg-split-upgrade.md) | Upgrade Nexus (`config.py`, `transcriber.py`, `settings.py`, `dashboard.py`, `help.py`): remove `Groq Model` dropdown, sync Admin `stt_model`, add fallback routing + FFmpeg <4 MB smart split strictly on NORVI fallback path. |
| **Phase 6** | [phase-06-security-audit-testing-and-rollout.md](./phase-06-security-audit-testing-and-rollout.md) | Full automated test suites (Vitest + Voro/Nexus/Rolvio pytest), Netlify env deploy steps, security leak checks, live endpoint smoke verification, and checklist for future agents. |
