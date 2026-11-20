# Phase 18: Customer Video Reviews & Testimonials Upgrade

## 1. Overview & Objective
This upgrade introduces a dedicated **Customer Video Reviews / Testimonials** section to all agent pages (`/agents/:slug`). It empowers NORVI to showcase unedited social proof, real user demonstrations, and verified candidate/customer testimonials directly on the product detail page, positioned **directly after the FAQ section** and **before the bottom CTA banner**.

The feature is fully editable for all current and future agents via the **Admin Product Editor** (`/admin/products`), supporting both widescreen **16:9** landscape videos and **9:16** vertical smartphone format (YouTube Shorts / Reels) with **inline in-card playback** (no pop-up modals).

---

## 2. Key Architecture & Behavior Specifications

### 2.1 Placement & Auto-Hide
- **Location:** Rendered immediately below the Frequently Asked Questions (FAQ) accordion section and directly above the bottom "Ready to deploy {product}?" CTA banner.
- **Conditional Auto-Hide:** If an agent has no video reviews configured in the admin panel, the section automatically hides completely with zero leftover DOM elements or whitespace.

### 2.2 Inline Playback Experience (No Modal / Lightbox)
- **Resting State:** Each review card displays the video poster/thumbnail (automatically retrieved from YouTube if applicable) with a prominent centered Play button (`▶`) featuring a yellow/gold hover glow and pulse effect.
- **Single-Click Inline Play:** Clicking the play button (or anywhere on the video preview area) immediately mounts the inline player directly inside the card.
- **Full Player Controls:** Customers have complete control over playback:
  - Play / Pause
  - Mute / Unmute & Volume slider
  - Seek timeline scrubber
  - Fullscreen expansion
  - "Watch on YouTube" external link (for YouTube videos)
- **Single Active Player State:** When a user starts playing a review video, any previously active review video is automatically paused and reset to resting state, preventing conflicting audio.

### 2.3 Aspect Ratio & Format Support
Each review card can be configured with its own aspect ratio:
- **`16:9` (Widescreen Landscape):** Ideal for horizontal desktop screen recordings, YouTube tutorials, and long-form reviews. Rendered in a ~380px wide card with 16:9 video frame.
- **`9:16` (Vertical Smartphone / Shorts / Reels):** Tailored for vertical mobile recordings and YouTube Shorts. Rendered in a ~280px wide card with 9:16 vertical smartphone frame.

### 2.4 Video Source Versatility
Supported video sources include:
- **YouTube Standard URLs:** `https://www.youtube.com/watch?v=...`
- **YouTube Short URLs:** `https://youtu.be/...`
- **YouTube Shorts:** `https://www.youtube.com/shorts/...`
- **Direct Video Uploads:** Direct `.mp4` and `.webm` file uploads using the built-in media uploader.

### 2.5 Review Card Metadata & Social Proof
Beneath each video, the card presents rich trust signals:
- **Star Rating:** 1 to 5 yellow star badges (`⭐⭐⭐⭐⭐`), with accessible aria labels.
- **Review Headline / Title:** Catchy summary headline (e.g., *"Cracked my L5 technical interview on the first try"*).
- **Written Testimonial Quote:** Customer's testimonial text formatted in readable typography.
- **Reviewer Profile:**
  - Initials avatar with gradient background (e.g., `AM` for Alex Mercer).
  - Reviewer's name (e.g., `Alex Mercer`).
  - Verified Customer badge with green checkmark icon.
  - Role / Credential tag (e.g., `Senior Software Engineer · FAANG Candidate`).

### 2.6 Horizontal Scrolling Track
- Configured in a smooth horizontal scrolling track with scroll-snap alignment and custom minimalist scrollbar.
- Header includes Left (`<`) and Right (`>`) scroll navigation arrow buttons when multiple reviews exist.
- Touch-friendly on mobile devices with smooth swipe navigation.

---

## 3. Admin Product Editor Workflow

Admins can manage video reviews for any agent at `/admin/products`:
1. Click **Edit Product** on any agent.
2. Open the **Video Reviews** tab (located between *FAQs Builder* and *Setup Guide*).
3. **Configure Section Headers:**
   - **Section Heading:** (Defaults to `"Customer Stories & Video Reviews"`).
   - **Section Subheading:** (Defaults to contextual explanation).
4. **Manage Review Cards:**
   - Click **"+ Add Video Review"** to create a new review entry.
   - Enter **Reviewer Name** (required) and optional **Reviewer Role / Credential**.
   - Enter **Review Headline / Title** and **Written Testimonial / Quote**.
   - Select **Star Rating** (3, 4, or 5 Stars).
   - Select **Video Format / Aspect Ratio** (`16:9 Widescreen` or `9:16 Vertical`).
   - Paste a **Video Link** (YouTube URL, Shorts URL, or direct link) OR upload a video file via the **Upload Direct Video File** picker.
   - Review the **Live Preview** directly inside the admin panel.
   - Reorder cards using the **Move Up** (`▲`) and **Move Down** (`▼`) buttons.
   - Remove any card using the **Delete** (`🗑️`) button.
5. Click **Save Product** at the bottom of the modal.

---

## 4. Code Changes Summary

| File | Changes Made |
| :--- | :--- |
| `packages/shared/model.ts` | Added `CustomerVideoReview` interface and extended `AgentExtendedContent` with `video_reviews`, `video_reviews_heading`, and `video_reviews_subheading`. |
| `apps/web/src/ui/common.tsx` | Enhanced `SmartVideoPlayer` to support customizable `aspectRatio` prop (`16/9` and `9/16`) for both YouTube iframes and native `<video>` elements. |
| `apps/web/src/ui/Workspace.tsx` | Added state, `handleSave` serialization, tab navigation, and full CRUD UI with live preview for Video Reviews in `ProductForm`. |
| `apps/web/src/ui/PublicPages.tsx` | Implemented the `<section className="video-reviews-section">` in `Detail` with inline single-active-player state, resting state poster with centered play button, horizontal scroll track, reviewer avatars, and star ratings. |
| `apps/web/src/styles/global.css` | Added styling for `.video-reviews-section`, `.video-reviews-track`, `.video-review-card` (landscape and vertical formats), `.video-review-play-btn`, `.video-review-body`, and responsive breakpoints. |
| `tests/video-reviews.test.tsx` | Created a comprehensive test suite verifying YouTube Shorts parsing, card rendering, format switching, star ratings, and auto-hide behavior. |

---

## 5. Verification & Test Results
- **TypeScript:** `npx tsc --noEmit` &rarr; Exited with code 0 (zero errors).
- **Test Suites:** `npm test` &rarr; 44 test files passed, 291 total tests passed (100% pass rate).
- **Production Build:** `npm run build` &rarr; Successfully generated all 46 static pages with zero build errors.
