# NORVI Agency — Admin Release Tab & AI Limits Master Guide

This guide explains **every single setting, number, limit, and task slot** in the NORVI Agency Admin Panel (**Releases** tab at `/admin/releases`).

Use this guide whenever you are:
1. Setting or changing limits for existing agents (**Voro**, **Nexus**, **Rolvio**).
2. Choosing which AI or STT models to use.
3. Releasing an update or releasing a brand-new NORVI desktop agent.

---

## 1. What Does the Number Mean? (Limits Explained)

When you see a field like **1-Day Limit**, **1-Week Limit**, **1-Month Limit**, or **Free Trial 1-Day Limit**, you might wonder:
> *"If I write 1000, what does 1000 mean? Is it 1,000 tokens? 1,000 words? 1,000 questions?"*

### Plain English Answer:
👉 **It means 1,000 AI Questions / Requests (Prompt Turns).**

- Every time a user's desktop agent sends a question to the AI and gets an answer back, that is **1 request**.
- If you write **`100`** in **1-Day Limit**, that user can ask **100 questions** in a rolling 24-hour period.
- When they make the **101st question**, the server blocks them with a friendly cooldown message:
  `"Temporary AI cooldown active due to high usage. Please try again later."`
- Setting **`0`** means **Unlimited** (no cap is enforced).

### The Two Separate Limit Systems:

| Limit Category | Where It Applies | What 1 Count Means | Example |
| :--- | :--- | :--- | :--- |
| **AI Brain Limits** | OpenRouter Chat / Vision / Coding | **1 AI Answer / Prompt Turn** | Asking an interview question, solving a screen, or tailoring a resume. |
| **Groq STT Limits** | Speech-to-Text Fallback via your Netlify Key | **1 Audio Voice Transcription** | One spoken sentence chunk in Voro, or one audio chunk in Nexus. *(Only counts if the user does NOT have their own Groq key!)* |

> [!NOTE]
> **Zero Data Conflict:** The AI Brain limit and the Groq STT limit are completely independent in the database. Using voice transcription does NOT reduce a user's AI questions, and asking AI questions does NOT reduce voice transcription limits.

---

## 2. All AI Brain Fields Explained

Here is what each field in the **AI Brain & Fallback Policies** card controls:

### A. Default Model ID
- **What it is:** The AI model from OpenRouter that handles requests when no specific task slot is matched.
- **Format:** `provider/model-name` (e.g. `google/gemma-4-26b-a4b-it`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, `meta-llama/llama-3.3-70b-instruct`).
- **How to pick:** You can type any model slug from [openrouter.ai/models](https://openrouter.ai/models) or pick one from the autocomplete dropdown.

### B. Routing Priority
How OpenRouter selects which data center server handles the request:
- **`latency` (Recommended for Voro):** Routes to the fastest provider server so the user gets answers in under ~0.5 seconds.
- **`cost`:** Routes to the cheapest provider server to save money on paid models.
- **`throughput`:** Prioritizes high token output per second (great for long coding blocks or essays).

### C. Max Input Characters (e.g., `60000`)
- **What it is:** The maximum number of text letters/symbols a user can send in one single question.
- **What the number means:**
  - 1 character = 1 letter/space.
  - `60,000 characters` ≈ **10,000 to 12,000 words** (about 20-25 pages of single-spaced text).
- **Why this exists:** It acts as a shield for your OpenRouter wallet. It stops users or broken automated loops from pasting huge 500-page books that would eat up all your credits in one second.

### D. Default Max Output Tokens (e.g., `1500`)
- **What it is:** The maximum length of the answer that the AI is allowed to write back.
- **What the number means:**
  - In AI, **1 token ≈ 0.75 words** (or 100 tokens ≈ 75 words).
  - `500 tokens` ≈ ~375 words (short, punchy response).
  - `1,500 tokens` ≈ ~1,100 words (thorough multi-paragraph response).
  - `3,000 tokens` ≈ ~2,250 words (large code architecture or comprehensive essay).
- **Recommended settings:**
  - **Voro:** `1000` to `1500` (an interview response should be concise and spoken naturally, not an essay).
  - **Nexus:** `2000` to `3000` (comprehensive meeting minutes and video summaries).
  - **Rolvio:** `1500` to `2000` (cover letters and tailored resumes).

### E. Zero Data Retention (ZDR) Toggle
- **Enabled (Default):** Forces OpenRouter to only use upstream AI endpoints that legally guarantee zero training and zero storage on user prompts. Keeps user data 100% private.
- **Disabled:** Allows endpoints that might store logs according to their standard provider terms.

### F. Allow Vision Toggle
- **Enabled:** Allows the agent to send screenshots and images to the AI (requires a multimodal model like `google/gemini-2.0-flash-001` or `qwen/qwen-2.5-vl-72b-instruct`).
- **Disabled:** Strips images before calling the AI, saving tokens if the agent only needs text.

---

## 3. Hidden AI Limits (Safety Caps)

| Limit Field | What It Does | Recommended for Free Tier | Recommended for Paid Tier |
| :--- | :--- | :--- | :--- |
| **1-Day Limit** | Max questions in rolling 24 hours | `50` to `150` | `300` to `1000` (or `0` for unlimited) |
| **1-Week Limit** | Max questions in rolling 7 days | `200` to `500` | `1500` to `5000` (or `0` for unlimited) |
| **1-Month Limit** | Max questions in rolling 30 days | `500` to `1500` | `5000` to `15000` (or `0` for unlimited) |
| **Free Trial 1-Day Limit** | Max questions for 1-day free trial licenses | `25` to `50` | `50` |

> [!TIP]
> **Hidden Means Safe:** Users can NEVER see these numbers in the app or network logs. If a user hits a limit, they only see:
> *"Temporary AI cooldown active due to high usage. Please try again later."*
> They will never see *"You used 50 of 50"*, preventing scrapers from reverse-engineering your quota system.

---

## 4. Task Slots: What They Are & How They Work

In the Admin Panel for Voro, you see **Task Slots**:
- `voice_text`
- `coding`
- `vision`

### Why do Task Slots exist?
In a desktop agent like Voro, different situations need different AI superpowers:
1. When an interviewer asks *"Tell me about yourself"*, you want an **ultra-fast conversational model** with low latency.
2. When the interviewer asks *"Write a quicksort algorithm in C++"*, you want a **specialized coding model** with higher output token limits.
3. When the user takes a screenshot of a LeetCode problem, you need a **multimodal vision model** that can read code from pictures.

Instead of being forced to use one single model for everything, **Task Slots let you assign different models to different tasks inside the same agent!**

### How Does the Agent Know Which Task Slot to Use?
Inside the desktop agent's code, whenever it calls the NORVI server, it passes one header:
```python
headers["X-Norvi-Task"] = "voice_text"  # or "coding", or "vision"
```
The server checks your Admin settings:
- If that task slot exists in your Admin list -> The server automatically runs the **Task-Specific Model**!
- If that task slot does NOT exist (or the agent didn't specify one) -> The server automatically falls back to your **Default Model**!

### Can You Add More Task Slots?
**YES!** Any agent can define new task slots. 
Here are real examples of task slots you can use for current and future agents:

| Agent | Task Slot Name | What It Is Used For | Recommended Model |
| :--- | :--- | :--- | :--- |
| **Voro** | `voice_text` | Spoken interview Q&A (fastest response) | `google/gemma-4-26b-a4b-it` (or `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`) |
| **Voro** | `coding` | Technical code generation & debugging | `qwen/qwen-2.5-coder-32b-instruct` |
| **Voro** | `vision` | Screen solve & OCR image analysis | `google/gemini-2.0-flash-001` |
| **Nexus** | `summary` | Summarizing full meetings / long videos | `meta-llama/llama-3.3-70b-instruct` |
| **Nexus** | `action_items` | Extracting to-do lists and key takeaways | `google/gemma-4-26b-a4b-it` |
| **Rolvio** | `resume_tailor` | Matching resume bullet points to job description | `deepseek/deepseek-chat` |
| **Rolvio** | `cover_letter` | Writing customized job application letters | `meta-llama/llama-3.3-70b-instruct` |

---

## 5. Groq Speech-to-Text (STT) Settings Explained

At the bottom of each agent card in `/admin/releases`, you have the **Groq Speech-to-Text (STT)** section:

### A. Groq STT Model ID
- **Default:** `whisper-large-v3-turbo`
- **What it does:** This controls what Whisper STT model Groq uses when transcribing audio.
- **Available Models:**
  - `whisper-large-v3-turbo` *(Recommended: Fastest cloud Whisper, lowest hallucination rate)*.
  - `distil-whisper-large-v3-en` *(Ultra-compact, English only)*.
  - `whisper-large-v3` *(Classic high-precision Whisper)*.
- **Power of this setting:** When you change this in the Admin Panel, **every single user immediately uses the new model** without having to download an app update!

### B. Allow NORVI Fallback Groq API Key
- **`Disabled`:** Users must either paste their own free Groq API key (`gsk_...`) in Settings -> Audio, or download the offline Faster-Whisper model on their computer.
- **`Enabled`:** If a user does NOT have their own Groq key, the desktop agent automatically routes audio through NORVI's Netlify server using **your server-side Groq key**. The user gets zero-setup cloud transcription right out of the box!

### C. Hidden Fallback STT Limits (Daily, Weekly, Monthly, Trial)
- **What the number means:** The number of **voice transcription requests** sent to your server-side Groq key.
  - If you write `500` in **STT 1-Day Limit**, the user can transcribe 500 speech segments in 24 hours using your key.
  - If a user enters their own personal free Groq key in Settings, **they bypass this limit completely** (and it costs you \$0).
  - Setting `0` = Unlimited fallback.

---

## 6. Version & GitHub Release Management

At the top of each agent card, you manage software updates:

### A. Version String (e.g., `1.0.1`)
- Must follow standard semantic versioning (`major.minor.patch`, like `1.0.0` -> `1.0.1`).
- When you increment this number, the desktop agent detects that an update is available.

### B. Release Notes
- Text or Markdown explaining what's new (e.g. `Fixed audio latency, upgraded speech engine`).
- Displays to users in the app when an update is found.

### C. GitHub Asset URL
- Direct download link to the installer or zip file hosted on your GitHub Releases (e.g. `https://github.com/norvi/voro/releases/download/v1.0.1/Voro-Setup-1.0.1.exe`).

### D. Mandatory Update Toggle
- **Checked (Mandatory):** Older app versions are blocked from launching until the user clicks Update. Use this when you make breaking database or API changes.
- **Unchecked (Optional):** The app shows an *"Update Available"* banner, but allows the user to continue using their current version.

---

## 7. Recommended Presets for Each Agent

### Voro (Interview AI Copilot)
- **Default Model:** `google/gemma-4-26b-a4b-it` (or `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`)
- **Routing Priority:** `latency`
- **Max Input Characters:** `60000`
- **Default Max Output Tokens:** `1200`
- **ZDR Toggle:** `Enabled`
- **Allow Vision Toggle:** `Enabled`
- **Limits (Paid):** 1-Day: `300` | 1-Week: `1500` | 1-Month: `5000` | Trial: `30`
- **Task Slots:**
  - `voice_text`: `google/gemma-4-26b-a4b-it`, `latency`, `1200` tokens.
  - `coding`: `qwen/qwen-2.5-coder-32b-instruct`, `throughput`, `2500` tokens.
  - `vision`: `google/gemini-2.0-flash-001`, `latency`, `1500` tokens.
- **Groq STT Model:** `whisper-large-v3-turbo`
- **Fallback Groq Key:** `Enabled` (STT 1-Day Limit: `500`, Trial: `100`)

---

### Nexus (Meeting & Video Intelligence)
- **Default Model:** `meta-llama/llama-3.3-70b-instruct`
- **Routing Priority:** `throughput`
- **Max Input Characters:** `120000`
- **Default Max Output Tokens:** `2500`
- **ZDR Toggle:** `Enabled`
- **Allow Vision Toggle:** `Disabled`
- **Limits (Paid):** 1-Day: `100` | 1-Week: `500` | 1-Month: `2000` | Trial: `15`
- **Groq STT Model:** `whisper-large-v3-turbo`
- **Fallback Groq Key:** `Enabled` (STT 1-Day Limit: `100`, Trial: `20`)

---

### Rolvio (Job Application & Career Automation)
- **Default Model:** `deepseek/deepseek-chat` (or `meta-llama/llama-3.3-70b-instruct`)
- **Routing Priority:** `cost`
- **Max Input Characters:** `80000`
- **Default Max Output Tokens:** `2000`
- **ZDR Toggle:** `Enabled`
- **Allow Vision Toggle:** `Disabled`
- **Limits (Paid):** 1-Day: `200` | 1-Week: `1000` | 1-Month: `3000` | Trial: `25`
- **Groq STT Model:** `whisper-large-v3-turbo`
- **Fallback Groq Key:** `Disabled` *(Rolvio does not use speech input)*

---

## 8. Summary Checklist Before Releasing

Before clicking **Save AI & STT Policy** or releasing a new agent:

1. [ ] **Verify Default Model:** Is the model ID typed accurately (e.g. `provider/model`)?
2. [ ] **Verify Routing Priority:** Is it set to `latency` for voice/interview agents, or `throughput`/`cost` for batch processing?
3. [ ] **Check Limits:** Did you enter reasonable numbers for Daily/Weekly/Monthly/Trial? *(Remember: 1 = 1 question/answer. Enter `0` only if you want truly unlimited).*
4. [ ] **Verify Fallback STT:** If you enabled Fallback Groq STT, ensure you added your `GROQ_API_KEY` in Netlify Environment Variables.
5. [ ] **Click Save:** Click **Save AI & STT Policy** at the bottom of the agent card. Your live users immediately receive the updated behavior within 5 minutes without needing an app update!
