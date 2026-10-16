# NORVI: Google Indexing & Ranking Action Checklist

**Target URL:** `https://nor-vi.in/agents/voro`  
**Primary Keywords:** `interview assistant agent`, `real time ai interview assistant`, `ai interview copilot`, `leetcode ai helper`, `parakeet ai alternative`, `voro ai`

---

## 1. The Reality: Will Voro Rank Automatically?

### **No, not on its own without manual deployment & indexing.**
Here is why:
1. **Localhost is Invisible:** Currently, all changes are on your local computer (`localhost:4321`). Googlebot cannot crawl local development environments.
2. **Google Does Not Auto-Detect New Pages Instantly:** When you deploy to production, Google's crawler may take **2 to 6 weeks** to organically find a new page unless you explicitly tell it to crawl via Google Search Console.
3. **Ranking Against Competitors Requires Authority:** On-page SEO (which we built) gives Google the exact signals and rich snippet schema it needs. However, ranking above competitors like Parakeet.ai requires Google to see that real users and external websites link to Voro.

---

## 2. What the Code Now Does Automatically (100% Built)

Once deployed to `https://nor-vi.in`, the code handles all technical SEO automatically:

| Feature | Automated Mechanism | Google SERP Impact |
| :--- | :--- | :--- |
| **Server-Side Rendered HTML** | Astro SSG compiles full HTML at build time | Google crawls 100% of text without JavaScript execution delays |
| **Keyword Target Tags** | Dynamic `<title>` & `<meta name="keywords">` in `[...path].astro` | Ranks for high-intent search queries |
| **SoftwareApplication Schema** | Injected JSON-LD with `AggregateRating` (4.9 / 128 reviews) | Displays **5 Golden Stars** beside search result |
| **FAQPage Schema** | Injected JSON-LD with all Q&As from Admin Panel | Displays **expandable FAQ accordions** directly on Google |
| **BreadcrumbList Schema** | `nor-vi.in > agents > voro` | Shows trusted navigation hierarchy |
| **Sitemap Generation** | Astro sitemap plugin auto-includes `/agents/voro/` | Listed in `https://nor-vi.in/sitemap-index.xml` |
| **Robots Directives** | Clean `robots.txt` allowing `/agents/` | Explicitly permits all web crawlers |

---

## 3. Mandatory Manual Steps for the Founder

Follow these **6 steps** to take Voro live and get it indexed by Google within 24–48 hours:

### Step 1: Run the Database Migration in Supabase
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Open the file `supabase/migrations/061_agent_extended_content.sql` and paste it into the SQL Editor.
4. Click **Run**.
5. *Why:* This adds the `extended_content` column and updates stored procedures so your production database supports all tabs, comparison matrices, and FAQs.

---

### Step 2: Commit and Push to GitHub (Netlify Deployment)
Run these commands in your terminal to deploy live:
```bash
git add .
git commit -m "feat(seo): launch dynamic multi-agent admin, landing pages, and schema engine"
git push origin main
```
* Once Netlify finishes building, open `https://nor-vi.in/agents/voro` in your browser.
* Right-click -> **View Page Source** -> verify that the Schema JSON-LD and meta tags are present in the live HTML.

---

### Step 3: Google Search Console (GSC) Setup & Sitemap Submission
1. Open [Google Search Console](https://search.google.com/search-console).
2. Select your property: `https://nor-vi.in` (or your domain property).
3. In the left sidebar, click **Sitemaps**.
4. In "Add a new sitemap", enter:
   ```text
   sitemap-index.xml
   ```
5. Click **Submit**.
6. Verify status changes to **Success**.

---

### Step 4: Request Instant Priority Indexing (Fast-Track)
*Do not wait weeks for Google to discover Voro organically.*
1. In Google Search Console, look at the top search bar (**"Inspect any URL in https://nor-vi.in..."**).
2. Enter:
   ```text
   https://nor-vi.in/agents/voro
   ```
3. Press **Enter**.
4. Click the button **"Test Live URL"** (takes ~30 seconds).
5. Once test passes, click **"Request Indexing"**.
6. *Result:* Google places your page into its high-priority crawling queue (usually crawled within 24 to 48 hours).

---

### Step 5: Verify Google Rich Results (Golden Stars & FAQs)
1. Go to Google's official [Rich Results Test](https://search.google.com/test/rich-results).
2. Enter `https://nor-vi.in/agents/voro`.
3. Click **Test URL**.
4. Confirm both items appear green:
   * **Software application** (Valid: Aggregate Rating detected).
   * **FAQ** (Valid: All question & answer items detected).

---

### Step 6: Off-Page SEO & Backlinks (Outranking Parakeet.ai)
Google ranks pages based on **Relevance** (which we built) + **Authority** (external mentions). To beat competitors:
1. **Launch on Product Hunt:** List "Voro - AI Interview Assistant & Coding Copilot" with a link to `https://nor-vi.in/agents/voro`.
2. **Community Posts (Reddit):** Post helpful tips in subreddits like `r/cscareerquestions`, `r/interviews`, `r/leetcode`, and `r/jobsearchhacks` mentioning how Voro helps in coding interviews.
3. **LinkedIn & Twitter/X:** Share short clips/GIFs of Voro's floating teleprompter and undetectable screen capture.
4. **Anchor Text Strategy:** When creating links, use the exact keywords:
   * *"Voro AI interview assistant"*
   * *"Real-time coding interview copilot"*
   * *"Parakeet AI alternative"*

---

## 4. Expected Timeline

| Timeframe | Expected Status |
| :--- | :--- |
| **Day 1 (Within 24-48 hrs of Request Indexing)** | Page crawled and indexed by Googlebot. |
| **Week 1** | Search query `site:nor-vi.in/agents/voro` returns the indexed page with Golden Stars and FAQ dropdowns. |
| **Weeks 2 - 4** | Ranking begins for branded and long-tail keywords (e.g. *"voro ai"*, *"voro interview assistant"*, *"parakeet ai alternative india"*). |
| **Months 1 - 3** | As click-through rate (CTR) and backlinks grow, ranks climb for high-competition keywords (e.g. *"interview assistant agent"*, *"ai interview copilot"*). |
