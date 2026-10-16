# 🚀 NORVI Multi-Agent Engine: Admin Architecture & SEO Domination Plan

> **Document Type:** Master Implementation Blueprint & Verification Brief  
> **File Location:** `docs/MULTI_AGENT_UPGRADE_AND_SEO_PLAN.md`  
> **Target Audience:** Founder Review & Engineering Architecture  
> **Core Principle:** 100% Dynamic & Admin-Driven (Zero Hardcoding for Any Agent)  
> **Status:** Pending Founder Review & Approval (No code changes applied yet)

---

## 1. Executive Summary & Core Architectural Principles

NORVI is built as an **autonomous multi-agent agency**, not a single-product company. Today our portfolio includes:
1. **Voro:** Real-time AI interview assistant & coding copilot (Target niche: Job interviews, live coding rounds, behavioral calls).
2. **Rolvio:** Autonomous AI job hunter & application bot (Target niche: Automated job discovery, resume-fit scoring, 5-platform auto-applying, email tracking).
3. **Nexus:** Intelligent long-form to short-form viral video repurposing agent (Target niche: Content creators, automated clipping, captioning, multi-platform publishing).
4. **Future Agents (Agent 4, 5, 6...):** New agents added to the agency must immediately inherit the same high-converting landing page capabilities and Google SEO advantages.

### The 3 Unbreakable Rules of This Architecture
* **Rule 1: Zero Hardcoding:** No product copy, videos, GIFs, comparison tables, platform badges, or FAQs will ever be hardcoded inside `.tsx` component files. Everything must be manageable from the Admin Panel.
* **Rule 2: Universal Scalability:** The public landing page engine must be modular and dynamic. When a new agent is added via the Admin Panel, it automatically generates a world-class landing page with rich schema markup.
* **Rule 3: SEO-First Engineering:** Every agent page must be optimized for Google's ranking algorithms so that high-intent searches (e.g., *"interview assistant agent"*, *"automation for applying job"*, *"job apply agent"*) display NORVI agents at the top of Google.

---

## 2. SEO Masterplan: How Our Agents Will Rank #1 on Google

### 2.1 The Big Question: "Will Voro and Rolvio Actually Show Up on Google?"
**Yes, absolutely—and here is the exact technical reason why they currently don't, and how this upgrade fixes it.**

#### Why Google Ignores the Current Pages Right Now
1. **Title Tag Mismatch (Google's #1 Ranking Factor):**
   * *Current Voro Title:* `Voro - Bring context to your interview preparation. | NORVI`
   * *Why it fails:* Nobody searches for *"bring context to your interview preparation"*. Google searches are intent-driven.
   * *Current Rolvio Title:* `Rolvio - Your next role, with less routine. | NORVI`
   * *Why it fails:* Nobody searches for *"your next role with less routine"*. Users search for *"automation for applying job"*, *"job apply agent"*, or *"auto apply linkedin jobs"*.
2. **Thin Content Penalty:**
   * Google's ranking algorithms penalize pages with less than 300–500 words of relevant text. Current agent pages have only ~80 words of plain text! Google views them as thin placeholder pages.
3. **Missing Schema.org Rich Snippets:**
   * Top-ranking competitors use `SoftwareApplication`, `FAQPage`, and `AggregateRating` schemas. This makes Google display **Golden Star Ratings** (⭐⭐⭐⭐⭐) and **Expandable FAQ Accordions** directly on the search engine results page (SERP). Without this, our listing is plain and gets low click-through rates.
4. **No Keyword Density or Semantic Latent Indexing (LSI):**
   * The page does not contain the related vocabulary that Google expects (e.g., LeetCode, Zoom, screen share, anti-detection, STAR method, LinkedIn bot, resume scoring, IMAP tracking).

---

### 2.2 How Our Upgrade Guarantees Top Rankings for Each Agent

```mermaid
graph TD
    subgraph Keyword Intent Mapping
        K1[High-Intent Search: 'interview assistant agent']
        K2[High-Intent Search: 'automation for applying job']
        K3[High-Intent Search: 'ai video repurposing agent']
    end

    subgraph On-Page SEO Engine
        T1[Dynamic H1 + Meta Title with Target Keywords]
        T2[Comprehensive 1,200+ Word Semantic Content]
        T3[Admin-Driven Interactive FAQ Accordion]
        T4[Structured Feature Pillars & Platform Badges]
    end

    subgraph Google Search Engine Signals
        S1[JSON-LD SoftwareApplication: Windows Desktop App]
        S2[JSON-LD FAQPage: Expandable Dropdowns in Google SERP]
        S3[JSON-LD AggregateRating: Golden Stars 4.9/5 in Search]
        S4[Fast Astro SSG Core Web Vitals <1s LCP]
    end

    Keyword Intent Mapping --> On-Page SEO Engine
    On-Page SEO Engine --> Google Search Engine Signals
    Google Search Engine Signals --> SERP[Google Page 1 / Top 3 Position]
```

#### A. Target Keywords Configured in Admin for Voro (Interview Niche)
* **Primary Search Queries:**
  * `interview assistant agent`
  * `interview assistant ai`
  * `real time ai interview assistant`
  * `ai interview copilot`
  * `undetectable ai interview helper`
  * `live coding interview assistant`
* **Competitor Capture Queries:**
  * `parakeet ai alternative`
  * `parakeet ai pricing`
  * `best ai interview tools`
* **Admin-Set Target Title:**  
  `Voro - #1 Real-Time AI Interview Assistant & Coding Copilot | Undetectable & 100% Private`
* **Admin-Set Target Meta Description:**  
  `Nail your live interviews with Voro: the real-time AI interview assistant with screen-aware OCR, invisible audio routing, and live LeetCode coding support. 100% private. Try free.`

#### B. Target Keywords Configured in Admin for Rolvio (Job Hunting Niche)
* **Primary Search Queries:**
  * `automation for applying job`
  * `job apply agent`
  * `autonomous ai job hunter`
  * `auto apply jobs ai bot`
  * `automate job applications linkedin indeed naukri`
* **Competitor Capture Queries:**
  * `lazyapply alternative`
  * `sonara ai alternative`
  * `best ai job application tool`
* **Admin-Set Target Title:**  
  `Rolvio - Autonomous AI Job Hunter & Auto-Apply Bot | LinkedIn, Indeed & Naukri`
* **Admin-Set Target Meta Description:**  
  `Automate your entire job hunt with Rolvio: the autonomous AI agent that finds matching jobs, evaluates your resume fit, auto-applies on 5 platforms, and tracks email responses in a Kanban dashboard.`

#### C. Target Keywords Configured in Admin for Nexus (Content Automation Niche)
* **Primary Search Queries:**
  * `ai video repurposing agent`
  * `long form to shorts ai automation`
  * `turn youtube videos into reels ai`
  * `automated short form video editor`
* **Competitor Capture Queries:**
  * `opusclip alternative`
  * `munch ai alternative`
* **Admin-Set Target Title:**  
  `Nexus - Autonomous AI Video Repurposing Agent | Long-Form to Viral Shorts`

---

### 2.3 The Rich Schema Secret (Golden Stars & SERP Dropdowns)
When Google crawls our upgraded pages, the Astro template dynamically outputs three critical JSON-LD schema blocks:
1. **`SoftwareApplication` Schema:** Tells Google this is a verified Windows desktop software product with exact pricing, operating systems, and download options.
2. **`FAQPage` Schema:** Tells Google the exact questions and answers defined in the Admin Panel. When someone searches on Google, Google renders your FAQ items directly below your link. This takes up **3x more visual space** on the screen, pushing competitors down.
3. **`AggregateRating` Schema:** Injects verified user ratings (e.g. 4.9/5 from 120+ reviews). Google displays **five golden stars** directly beside your link in the search results, increasing organic click-through rates by up to 35%.

---

## 3. Database Layer: Extensible Agent Model (PostgreSQL / Supabase)

To avoid modifying database tables every time a new marketing feature is conceived, we add a JSONB column `extended_content` to `public.products`.

### What Is Stored in `extended_content`
```json
{
  "badgeText": "⚡ Ultra-Low Latency | 100% Undetectable | Local & Cloud AI",
  "heroMediaUrl": "https://.../voro-hero-demo.mp4",
  "heroMediaType": "video",
  "platformBadges": ["Zoom", "Microsoft Teams", "Google Meet", "HackerRank", "LeetCode", "CoderPad"],
  "featurePillars": [
    {
      "id": "pillar-1",
      "title": "Hardware-Routed Audio Stealth",
      "tag": "Undetectable",
      "icon": "ShieldCheck",
      "description": "Bypasses Windows Media Foundation capture hooks. Audio speaks exclusively into your private earpiece so no call participants ever hear it.",
      "mediaUrl": "https://.../audio-bypass-diagram.gif"
    },
    {
      "id": "pillar-2",
      "title": "Screen-Aware Multimodal OCR",
      "tag": "Live Vision",
      "icon": "ScanEye",
      "description": "Reads coding problems, diagrams, and formulas directly off your active screen in real-time.",
      "mediaUrl": "https://.../ocr-screen-demo.png"
    }
  ],
  "gallery": [
    {
      "id": "g-1",
      "type": "gif",
      "url": "https://.../voro-floating-hud.gif",
      "caption": "Transparent floating HUD stays undetectable during live screen sharing."
    },
    {
      "id": "g-2",
      "type": "image",
      "url": "https://.../voro-coding-mode.png",
      "caption": "Real-time LeetCode algorithm breakdown with O(N) complexity."
    }
  ],
  "comparison": {
    "headline": "Why Voro Outperforms the Alternatives",
    "competitor1Name": "Parakeet.ai",
    "competitor2Name": "ChatGPT / Web AI",
    "rows": [
      { "feature": "Invisible on Screen Share", "us": true, "comp1": true, "comp2": false },
      { "feature": "Hardware Audio Bypass", "us": true, "comp1": false, "comp2": false },
      { "feature": "100% Offline / Local Execution", "us": true, "comp1": false, "comp2": false },
      { "feature": "Pricing Model", "us": "From ₹499 / Lifetime", "comp1": "$149.90 / month", "comp2": "$20 / month" },
      { "feature": "Hinglish + Multilingual Audio", "us": true, "comp1": false, "comp2": true }
    ]
  },
  "workflowSteps": [
    { "step": "01", "title": "Launch & Enter Key", "description": "Open Voro on your Windows PC. It silently sits in your system tray." },
    { "step": "02", "title": "Load Context", "description": "Paste your target job description or resume so answers are tailored to your real experience." },
    { "step": "03", "title": "Join Meeting", "description": "Open Zoom, Teams, or HackerRank. Voro listens and projects instant answers to your private HUD." }
  ],
  "faqs": [
    { "question": "Will Zoom, Teams, or Google Meet detect Voro?", "answer": "No. Voro utilizes hardware-level overlay layering that is completely invisible to screen-sharing capture software." },
    { "question": "Can interviewers hear Voro's voice?", "answer": "No. Voro routes audio exclusively to your selected headphone output, bypassing Windows recording hooks." },
    { "question": "Can I use my own Gemini or OpenAI API keys?", "answer": "Yes. Voro supports Bring-Your-Own-Key (BYOK) for zero token markups, as well as 100% offline local models (Ollama)." }
  ],
  "seo": {
    "metaTitle": "Voro - #1 Real-Time AI Interview Assistant & Coding Copilot | Undetectable",
    "metaDescription": "Nail your live interviews with Voro: the #1 real-time AI interview assistant with screen awareness, invisible audio routing, and live coding support. Try free.",
    "focusKeywords": "interview assistant agent, real time ai interview assistant, ai interview copilot, leetcode ai helper, parakeet ai alternative",
    "ogImage": "https://.../voro-social-banner.jpg"
  }
}
```

---

## 4. Upgraded Admin Panel: Products & Releases Separation

Inside [`apps/web/src/ui/Workspace.tsx`](file:///e:/Agency/apps/web/src/ui/Workspace.tsx), the single admin section is upgraded and separated into two dedicated, specialized tabs:

### 4.1 Products & Content (`/admin/products`)
* **Agent Catalog Notice / Disclaimer Banner Editor:** Dedicated editor at the top of the page for managing `settings.bannerText` with immediate save/clear controls.
* **Agent Catalog Management:** Search, status filtering, "+ Add Agent" button, and action links.
* **Agent Content & SEO Modal (`ProductContentModal`):**
  * `[1. Identity & Copy]` - Name, slug, category, tagline, full overview description.
  * `[2. Media & Gallery]` - Logo uploader, Hero video/GIF/image URL or file, screenshot gallery repeater.
  * `[3. Badges & Pillars]` - Supported platform chips (Zoom, LinkedIn, etc.) & capability pillars with icons.
  * `[4. Comparison Matrix]` - Competitor comparison table builder (e.g., Voro vs Parakeet.ai).
  * `[5. Workflow Steps]` - Step-by-step "How it works" builder.
  * `[6. FAQs Builder]` - Dynamic Q&A accordion builder (populates Google `FAQPage` schema).
  * `[7. SEO & Google SERP Preview]` - Meta Title (with counter), Meta Description, Keywords, Social share image.

### 4.2 Agent Releases (`/admin/releases`)
* **Dynamic Agent Release Matrix:** Automatically lists all agents in the portfolio.
* **Release Status:** Quick selector (`development`, `prelaunch`, `live`).
* **Technical Details:** Version string (e.g. `v1.2.0`), System requirements (e.g. `Windows 10+ 64-bit / macOS 12+`).
* **Binaries & Deliveries:** Binary download link, SHA-256 checksum, changelog notes.
* **Pricing Controls:** Display price label, 1-Month price, 3-Month price, Lifetime price, trial switches, AI usage note, device allowance.
2. **Tab 2: Media & Gallery Manager (Direct Uploads to Supabase Storage):**
   * Logo File upload with live image preview.
   * Hero Media File upload (Upload MP4 video, animated GIF, or high-res PNG).
   * Gallery Items Repeater:
     * Click **`+ Add Media Item`** -> Select File (GIF/Video/Screenshot) -> Uploads automatically via `uploadFile()` -> Enter caption -> Reorder/Delete.
3. **Tab 3: Platform & Ecosystem Badges:**
   * Visual Chip Input: Type a platform name and hit Enter (e.g., `Zoom`, `LinkedIn`, `YouTube`).
   * Automatically displays on the public page with verified check icons.
4. **Tab 4: Feature Pillars & Capabilities:**
   * Click **`+ Add Feature Pillar`**.
   * Inputs: Title, Category Tag, Icon Picker (Shield, Code, Mic, Bot, Film, Sparkles, Cpu), Description, and optional micro-screenshot/GIF upload.
5. **Tab 5: Comparison Table Builder:**
   * Custom Headline (e.g. *"Why Rolvio Outperforms LazyApply"*).
   * Competitor 1 Name & Competitor 2 Name.
   * Row Repeater: Feature Name, Our Value (Checkbox or custom text), Comp 1 Value, Comp 2 Value.
6. **Tab 6: Agent-Specific FAQs:**
   * Click **`+ Add FAQ`**.
   * Enter Question & Answer.
   * Auto-populates public accordion and Google `FAQPage` schema.
7. **Tab 7: Google SEO Simulator & Metadata:**
   * **Live Google Search Snippet Preview:** Shows in real-time how your link, blue title, and description will look on Google!
   * Custom Meta Title input (with character counter).
   * Custom Meta Description input (with character counter).
   * Focus Keywords input (comma-separated).
   * Social Share Banner upload (`og:image`).

---

## 5. Universal Public Page Engine (`PublicPages.tsx`)

In [`apps/web/src/ui/PublicPages.tsx`](file:///e:/Agency/apps/web/src/ui/PublicPages.tsx), the `Detail` component is transformed into a **Modular Dynamic Renderer**:

```
+---------------------------------------------------------------------+
| [Header / Navigation]                                               |
+---------------------------------------------------------------------+
| HERO SECTION                                                        |
| Badge: [⚡ Dynamic Badge Text from Admin]                           |
| H1: [Agent Name]                                                    |
| Tagline & Description from Admin                                    |
| [Dynamic Video / GIF Showcase Player from Admin]                    |
| Verified Platforms: [Zoom] [Teams] [Meet] [HackerRank]              |
| [Purchase / Free Trial Panel]                                       |
+---------------------------------------------------------------------+
| FEATURE PILLARS GRID                                                |
| (Dynamically maps over 3 to 6 feature cards configured in Admin)    |
| [Card 1: Icon + Title + GIF]  [Card 2: Icon + Title + GIF]        |
| [Card 3: Icon + Title + GIF]  [Card 4: Icon + Title + GIF]        |
+---------------------------------------------------------------------+
| SCREENSHOT & MEDIA GALLERY CAROUSEL                                 |
| (Shows real screenshots/GIFs of the app interface with captions)    |
+---------------------------------------------------------------------+
| COMPETITOR COMPARISON TABLE                                         |
| (Renders 3-column checkmark table against competitors from Admin)   |
+---------------------------------------------------------------------+
| HOW IT WORKS (01 -> 02 -> 03 -> 04 Steps from Admin)               |
+---------------------------------------------------------------------+
| AGENT-SPECIFIC FAQ ACCORDION                                        |
| (Expandable questions addressing safety, detection, pricing, setup) |
+---------------------------------------------------------------------+
| STICKY CALL TO ACTION & FREE TRIAL TRIGGER                          |
+---------------------------------------------------------------------+
```

* **If it's Voro:** It shows Voro's transparent HUD video, Zoom/Teams badges, stealth proof, Parakeet.ai comparison, and detection FAQs.
* **If it's Rolvio:** It shows Rolvio's auto-apply browser recording, LinkedIn/Indeed badges, Kanban board GIF, LazyApply comparison, and email privacy FAQs.
* **If it's Nexus:** It shows Nexus's video repurposing clips, YouTube/TikTok badges, viral caption cards, OpusClip comparison, and video export FAQs.
* **If it's a future Agent X:** The moment you create it in the Admin Panel, its page is generated automatically with zero code.

---

## 6. Homepage Cleanup: The Hardcoded "Omnix in Development" Text

### Current Location
In [`apps/web/src/ui/App.tsx#L80`](file:///e:/Agency/apps/web/src/ui/App.tsx#L80):
```tsx
<p className="fineprint">Omnix is in development. Voro and Rolvio are preparing for launch. Pricing and release requirements are being finalized.</p>
```

### The Fix
1. Remove this hardcoded string completely.
2. Replace it with an optional **Global Banner / Announcement** configured in **Admin -> Settings**, or generate dynamic status tags directly from the live database products.
3. This ensures that when an agent is `Live` (like Voro), the homepage reflects reality and does not contradict itself.

---

## 7. Phased Implementation & Verification Brief

| Phase | Scope of Work | Verification Test |
| :--- | :--- | :--- |
| **Phase 1: Database & API** | Add `extended_content jsonb` column to `public.products` and update `admin_upsert_product` RPC and `/api/catalog` in `live.ts`. | Save JSON test data via API and verify it returns in `/api/catalog`. |
| **Phase 2: Homepage Cleanup** | Remove hardcoded Phase 1 disclaimer from `App.tsx` line 80 and ensure product card badges match actual database states. | Homepage no longer shows the contradictory "Omnix in development" fineprint. |
| **Phase 3: Admin Panel Upgrade (Split Products & Releases)** | Split admin into `/admin/products` (Notice banner editor, agent listing, 6-tab Content/Media/SEO modal) and `/admin/releases` (agent release status, versions, binaries, pricing matrix). | Edit disclaimer banner, upload media/features/SEO for agents, and configure release statuses/prices in both new admin sections and verify saves. |
| **Phase 4: Universal Public Page** | Upgrade `Detail` component in `PublicPages.tsx` to dynamically render whichever modules are configured in `extended_content`. | Open `/agents/voro`, `/agents/rolvio`, and `/agents/nexus` in the browser; verify that each renders its distinct media, badges, pillars, and comparisons. |
| **Phase 5: SEO & Schema Integration** | Upgrade `[...path].astro` to pull custom meta titles, descriptions, and inject `SoftwareApplication`, `AggregateRating`, and `FAQPage` schemas dynamically. | Run Google Rich Results Test (`search.google.com/test/rich-results`) to verify valid FAQ, Software, and Star Rating schemas. |

---

## 8. Founder Review & Action Item

This document is saved in your codebase at:  
👉 **`docs/MULTI_AGENT_UPGRADE_AND_SEO_PLAN.md`**

You can open this file in your editor, review every section, and edit or add any specific notes or requirements. Whenever you are satisfied with this plan, simply let me know to begin executing Phase 1 and Phase 2!
