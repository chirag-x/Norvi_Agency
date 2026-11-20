# Phase 19: Homepage Video Reviews & Compact Player Architecture

## 1. Overview & Objective
This upgrade addresses two core platform improvements:
1. **Height & Proportion Optimization:** Significantly reduces the vertical height of video review cards across desktop and mobile viewports. Vertical (9:16) cards no longer dominate the entire screen, while mobile users enjoy a comfortable card height with a natural multi-card horizontal peek.
2. **Homepage Agency Video Reviews:** Integrates the social proof video review carousel onto the main NORVI Agency homepage (`/`), positioned directly below **"How It Works" (Steps 01, 02, 03)** and above **"Good Questions" (FAQ)**. Agency-wide reviews are fully editable via the Admin Panel under **`/admin/content`**.

---

## 2. Card Sizing & Height Optimization Specifications

### 2.1 Before vs. After Dimensions

| Parameter | Previous Sizing | New Optimized Sizing | Improvement |
| :--- | :--- | :--- | :--- |
| **Desktop 9:16 Card Width** | `280px` (min `250px`, max `310px`) | `215px` (min `200px`, max `230px`) | **~25% narrower** |
| **Desktop 9:16 Video Frame Height** | `~498px` | `~370px` (capped at `380px`) | **~130px shorter** |
| **Desktop Total Card Height** | `~660px` | `~470px` | **~30% total height reduction** |
| **Desktop 16:9 Card Width** | `380px` | `340px` | Sleeker, cohesive alignment |
| **Mobile 9:16 Card Width** | `80% (~300px+)` | `195px` (min `185px`, max `210px`) | Compact, fits phone screens |
| **Mobile Total Card Height** | `~700px` (filled entire screen) | `~440px` (fits with ample room) | **Zero scroll trapping** |
| **Mobile Carousel Peek** | Single card occupied screen | 1.5–2 cards visible on screen | **Invites horizontal swiping** |
| **Center Play Button** | `58px` circle | `48px` circle | Perfectly balanced proportion |
| **Internal Body Padding** | `16px 18px 18px 18px` | `12px 14px 14px 14px` | Tighter, cleaner spacing |
| **Review Quote Line Clamp** | 4 lines | 3 lines with ellipsis (`...`) | Prevents text card bulging |
| **Reviewer Avatar** | `34px` | `28px` | Minimalist and proportionate |

---

## 3. Homepage Agency Video Reviews Architecture

### 3.1 Placement on Main Landing Page (`/`)
- **Location:** Positioned right after `<section className="how-section" id="how-it-works">` and directly above `<section className="section container">` (the Good Questions FAQ).
- **Conversion Impact:** Prospective buyers read how simple it is to get an agent (*Find &rarr; Choose Tier &rarr; Install in Seconds*) and immediately see unedited video proof from verified candidates and engineers before encountering pricing/CTA choices.
- **Auto-Hide:** If no agency video reviews are configured, the section automatically hides with zero leftover DOM space or layout shift.

### 3.2 Admin Panel Management (`/admin/content`)
- Configured directly inside the **Content** tab (`/admin/content`).
- Includes a dedicated **Homepage Customer Video Reviews** panel:
  - Custom **Section Heading** (defaults to *"Trusted by Builders, Founders & Candidates"*).
  - Custom **Section Subheading** (defaults to *"Real feedback and unedited demonstrations from professionals using NORVI autonomous agents in production."*).
  - Review Card CRUD Manager: Add, Edit, Move Up (`▲`), Move Down (`▼`), and Delete (`🗑️`).
  - Supports Reviewer Name, Role / Product Tag, Headline, 1–5 Star Rating, 16:9 vs. 9:16 Aspect Ratio, YouTube / Shorts URL, and direct video file uploads.
  - Live video preview embedded right inside the editor before saving.

### 3.3 Database & API Schema
- **Migration `079_homepage_video_reviews.sql`:**
  - Adds `video_reviews jsonb`, `video_reviews_heading text`, and `video_reviews_subheading text` to `public.site_settings`.
  - Updates `public.get_site_settings()` RPC.
- **Backend API (`apps/api/live.ts`):**
  - Updated `/api/catalog` to fetch and cache `video_reviews`, `video_reviews_heading`, and `video_reviews_subheading` on the `settings` object.
  - Updated `PATCH /api/admin/content` to persist video reviews with service-role security and automatic fallback.
- **Build Pre-sync (`scripts/catalog.ts`):**
  - Updated catalog synchronization to snapshot homepage video reviews into `packages/shared/catalog.json`.

---

## 4. Code Changes Summary

| File | Changes Made |
| :--- | :--- |
| `apps/web/src/styles/global.css` | Implemented compact vertical format (`215px`), max-height container limits (`380px` desktop, `345px` mobile), mobile sizing (`195px` width with adjacent card peek), scaled play button (`48px`), and compact card body padding. |
| `packages/shared/model.ts` | Extended `Settings` interface with `video_reviews`, `video_reviews_heading`, and `video_reviews_subheading`. |
| `apps/web/src/ui/common.tsx` | Added and exported shared `getReviewerInitials(name)` helper for initials avatar generation. |
| `apps/web/src/ui/App.tsx` | Integrated the Customer Video Reviews section into the `Home` component directly after `#how-it-works` with scroll track controls and inline playback state. |
| `apps/web/src/ui/Workspace.tsx` | Added the Homepage Video Reviews Manager to `SettingsForm` (`/admin/content`), enabling complete CRUD and live preview of homepage reviews. |
| `apps/api/live.ts` | Added `video_reviews` fields to `/api/catalog` and updated `PATCH /api/admin/content` to persist them to `site_settings`. |
| `supabase/migrations/079_homepage_video_reviews.sql` | Created database migration adding `video_reviews`, `video_reviews_heading`, and `video_reviews_subheading` to `public.site_settings`. |
| `scripts/catalog.ts` | Updated public catalog sync to include homepage video reviews in static snapshot builds. |
| `tests/video-reviews.test.tsx` | Added test cases verifying homepage video reviews rendering and auto-hide behavior. |

---

## 5. Verification & Test Results
- **TypeScript:** `npx tsc --noEmit` &rarr; Passed with **0 errors**.
- **Unit & Regression Tests:** `npm test` &rarr; **All 44 test suites (292 tests) passed**.
- **Static Production Build:** `npm run build` &rarr; Successfully generated all **46 static pages** cleanly.
