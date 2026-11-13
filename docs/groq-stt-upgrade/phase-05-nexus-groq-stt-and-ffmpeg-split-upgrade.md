# Phase 5 — Nexus Desktop Agent Upgrade & FFmpeg <4 MB Auto-Split (Fallback Only)

**Goal:** Upgrade **Nexus** (`E:\Agency\_New folder\Nexus`) so that:
1. The **Groq Model** dropdown in Settings is **completely removed** — Admin Releases controls 100% of Groq STT model selection.
2. Users with their own Groq key continue calling `api.groq.com` directly (supports up to 25 MB files identically to today, just using Admin's `stt_model`).
3. Users **without** their own Groq key can transcribe seamlessly via **NORVI's Netlify fallback proxy** when Admin enables fallback for `nexus`.
4. **Strictly ONLY when using NORVI's Netlify fallback Groq key** (and NEVER when using a user's own Groq key or Local Faster-Whisper), any audio file larger than **~3.8 MB** is automatically re-encoded/split by Nexus's bundled **FFmpeg (`imageio_ffmpeg`)** into chunks strictly **under 4 MB**, transcribed sequentially/concurrently, and stitched back with exact millisecond-accurate offsets.

---

## 1. Current State Observed in Nexus

- `src/config/config.py`: Already holds `norvi_api_url` (`https://nor-vi.in`) and helper `get_ai_base_url()`.
- `src/services/auth/session.py` / `SessionManager` & `src/services/auth/hwid.py`: Manages Lease JWT and hardware ID for `/api/agent-ai/v1`.
- `src/services/media/downloader.py`: Extracts 64 kbps mono MP3 via `imageio_ffmpeg.get_ffmpeg_exe()` (`MediaProcessor._extract_audio`).
- `src/services/ai/transcriber.py`:
  - `WhisperTranscriber.transcribe()` chooses between `"Local (Faster-Whisper)"` and `_transcribe_cloud()`.
  - `_transcribe_cloud()` reads `groq_api_key` and `cloud_whisper_model` from `QSettings("Nexus", "SocialMediaAgent")`, rejects if `groq_api_key` is missing, checks `25 MB` max file size, and uploads directly to `https://api.groq.com/openai/v1/audio/transcriptions` using `"response_format": "verbose_json"`.
- `src/ui/views/settings.py` (lines 180–280):
  - Renders `self.combo_engine` (`"Local (Faster-Whisper)"`, `"Cloud (Groq API)"`), `self.txt_groq_api`, and `self.combo_cloud_model` (`["whisper-large-v3", "whisper-large-v3-turbo"]`) + saves `cloud_whisper_model`.
- `src/ui/views/dashboard.py` & `src/ui/views/help.py`:
  - Check local `groq_api_key` to show setup status banners and instruct users to pick `whisper-large-v3-turbo` in Settings.

---

## 2. Exact Changes Planned for Nexus

### A. Backend Config Helper (`src/config/config.py` + `src/services/ai/transcriber.py`)
1. Add `get_stt_base_url()` in `src/config/config.py` -> `{NORVI_API_URL}/api/agent-stt`.
2. Add async helper in `WhisperTranscriber` (with TTL cache, e.g., 5 min) to fetch `{ "stt_model", "fallback_enabled" }` from `GET /api/agent-stt/config` using `SessionManager` Lease JWT + `get_hardware_id()` + `X-Norvi-Product: nexus` (re-authenticating once on `401` just like `GemmaEngine`).

### B. Remove User Groq Model Selection & Clean Cloud Engine UX (`src/ui/views/settings.py` + `help.py`)
1. **`src/ui/views/settings.py`:**
   - **Delete `self.combo_cloud_model` and `lbl_cmod` ("Groq Model:") completely.**
   - Remove `settings.setValue("cloud_whisper_model", ...)` in `_save_transcription_settings()`.
   - Update `combo_engine` labels / helper note clearly:
     - `"Local (Faster-Whisper)"` — untouched offline mode.
     - `"Cloud (Groq / NORVI Speech)"` *(treat existing saved `"Cloud (Groq API)"` cleanly as Cloud mode for existing installs so no user config breaks!)*.
   - Keep `"Groq API Key (Optional):"` input (`txt_groq_api`) with placeholder/hint:
     *"Leave empty to use NORVI Cloud Speech Fallback (if enabled on your license), or paste your own free Groq API key (gsk_...) for direct 25 MB uploads."*
2. **`src/ui/views/help.py`:**
   - Remove mentions of manually picking `whisper-large-v3-turbo` in Settings; state that Groq Speech models are managed centrally by NORVI.
3. **`src/ui/views/dashboard.py`:**
   - Keep accurate status checks without blocking users if fallback is active on Cloud mode.

### C. Transcription Routing Rules (`src/services/ai/transcriber.py`)
When `WhisperTranscriber.transcribe(audio_path, progress_callback)` runs:

1. **Case 1: Engine is `"Local (Faster-Whisper)"`:**
   - Runs `_sync_transcribe_local(...)` identically to today. **Zero FFmpeg splitting. Zero network calls.**

2. **Case 2: Engine is Cloud AND User Entered Their Own `groq_api_key`:**
   - Fetches Admin's active `stt_model` from `/api/agent-stt/config` (with fallback `"whisper-large-v3-turbo"` if offline cache unavailable).
   - Validates `file_size <= 25 MB`. **Zero FFmpeg `< 4 MB` splitting — preserves exact current behavior!**
   - Posts directly to `https://api.groq.com/openai/v1/audio/transcriptions` with user's `groq_api_key`, `"model": admin_stt_model`, and `"response_format": "verbose_json"`.

3. **Case 3: Engine is Cloud AND User Left `groq_api_key` EMPTY -> Check NORVI Fallback:**
   - Calls `GET /api/agent-stt/config` to verify `fallback_enabled == True` and retrieve `stt_model`.
   - If `fallback_enabled == False`: raise clear actionable error telling the user to paste their own free Groq API key in Settings or switch to **Local (Faster-Whisper)**.
   - If `fallback_enabled == True`: route to `_transcribe_via_norvi_fallback(audio_path, progress_callback)`:
     - Check file size against `NORVI_FALLBACK_MAX_BYTES = 3_800_000` (~3.8 MB safe margin under Netlify's 6 MB limit).
     - **If `file_size <= 3.8 MB`:** Upload the file directly in 1 call to `POST https://nor-vi.in/api/agent-stt/v1/audio/transcriptions` with Lease JWT + HWID (`X-Norvi-Product: nexus`).
     - **ONLY IF `file_size > 3.8 MB`:** Run the **FFmpeg `<4 MB` Smart Re-Encode & Split Pipeline** below!

---

## 3. FFmpeg `<4 MB` Smart Re-Encode & Split Algorithm (Fallback-Only!)

Implemented cleanly as an isolated helper inside `Nexus` (using `imageio_ffmpeg.get_ffmpeg_exe()`):

1. **Create Isolated Temp Folder:** `tempfile.TemporaryDirectory(prefix="nexus_stt_split_")` (guaranteed cleanup in `finally`).
2. **Step 1 — Compact Speech Re-Encode Check:**
   - Re-encode source audio to speech-optimized mono MP3 (`-vn -ac 1 -ar 16000 -b:a 32k`, ~`240 KB/minute`).
   - Example: a 10 MB 64 kbps MP3 (approx. 21 minutes) shrinks to ~5.0 MB; a 6 MB MP3 shrinks to ~3.0 MB (**single upload, no splitting required!**).
3. **Step 2 — Split Into Strictly `< 3.8 MB` Segments (If Compact Audio Still Exceeds `3.8 MB`):**
   - Measure total duration using `ffmpeg -i <compact.mp3>` stderr (`Duration: HH:MM:SS.xx` — requires zero external `ffprobe.exe`).
   - Compute safe chunk duration in seconds: e.g. start with `~600s` (10 min at 32 kbps = ~2.4 MB; even with VBR/bitrate spikes stays safely under 3.8 MB).
   - Run `ffmpeg -i <compact.mp3> -f segment -segment_time <secs> -c copy chunk_%03d.mp3` (with `CREATE_NO_WINDOW` on Windows).
   - **Strict Post-Verify Guarantee:** Inspect every generated `chunk_*.mp3` byte size. If any chunk exceeds `3_800_000` bytes (rare bitrate edge case), sub-split that specific chunk cleanly before upload so **zero chunks ever trigger HTTP 413 on Netlify**.
4. **Step 3 — Accurate Offset Calculation & Segment Merging:**
   - Measure each chunk's exact actual decoded duration (`running_offset_sec` accumulated from each chunk's measured duration via `ffmpeg -i chunk_NNN.mp3`, NOT assumed fixed `600.0s`, preventing cumulative drift on MP3 frame boundaries!).
   - Transcribe chunks sequentially (updating `progress_callback`: e.g. `"Transcribing part 2/3 via NORVI Cloud..."`).
   - Refresh Lease JWT automatically once on HTTP `401`.
   - For every returned segment `seg` in chunk `k`:
     ```python
     {
       "start": round(float(seg["start"]) + running_offset_sec, 3),
       "end": round(float(seg["end"]) + running_offset_sec, 3),
       "text": seg["text"].strip(),
     }
     ```
   - Merge all segments chronologically and delete the temporary folder cleanly in `finally`.

---

## 4. Nexus Verification Plan
- Unit tests (`E:\Agency\_New folder\Nexus\tests\`):
  1. `settings.py` renders **no** `combo_cloud_model` widget and never persists `cloud_whisper_model`.
  2. Cloud mode + User Groq Key -> does **not** split a 10 MB file; calls `https://api.groq.com/...` directly using Admin `stt_model`.
  3. Local Faster-Whisper mode -> does **not** split or make network calls.
  4. Cloud mode + No User Key + `fallback_enabled=True` + 2 MB file -> calls `/api/agent-stt/v1/audio/transcriptions` directly in 1 shot without running FFmpeg split.
  5. Cloud mode + No User Key + `fallback_enabled=True` + >3.8 MB file -> runs FFmpeg split (<3.8 MB per chunk), calls proxy per chunk, offsets `start`/`end` timestamps cumulatively without drift, and cleans up temp chunks.
  6. Cloud mode + No User Key + `fallback_enabled=False` -> blocks safely with clear user message.
