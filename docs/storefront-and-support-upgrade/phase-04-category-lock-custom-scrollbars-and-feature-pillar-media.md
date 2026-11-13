# Phase 4 Upgrade Specification: Category Locking, Sleek Custom Scrollbars & Interactive Feature Pillar Media

**Document Version:** 1.0.0  
**Status:** Planned & Ready for Approval (No Code Modified)  
**Location:** `docs/storefront-and-support-upgrade/phase-04-category-lock-custom-scrollbars-and-feature-pillar-media.md`

---

## 1. Executive Summary & User Directives

This phase resolves three critical visual and administrative improvements across the NORVI Agency platform:

1. **Eliminate Ugly Browser/OS Scrollbars (Horizontal & Vertical):**
   * Replace the stark white and light-grey stock Windows/Chromium scrollbars (such as the horizontal scrollbar under the head-to-head comparison table and the main browser sidebar) with modern, ultra-sleek, dark-themed custom scrollbars.
2. **Lock Admin Category & Introduce Free-form "Sub-heading / Agent Role":**
   * Preserve the underlying database category architecture for future multi-platform expansion (Desktop, Mobile, Cloud, Web Extensions).
   * Lock the `Category` dropdown in the admin product editor (`/admin/products`).
   * Introduce a new editable **"Sub-heading / Agent Role"** text box right beside Category.
   * Render this custom sub-heading on the customer-facing side (Homepage agent cards, `/agents` catalog cards, and agent detail page pills) in place of the rigid category tag.
3. **Feature Pillars Media Support & Interactive Click-to-View Modal:**
   * Allow administrators to upload images/videos or paste YouTube/MP4 links for each specific feature pillar in the admin editor.
   * On the public agent page, keep the feature cards clean and uncluttered without auto-loading heavy media inline.
   * When a customer clicks on a feature pillar card, an interactive **Feature Deep-Dive Modal** opens, displaying the icon, tag, title, full description, and high-fidelity video/image player.

---

## 2. Detailed Technical Breakdown

### Sub-Phase 4.1: Sleek Custom Scrollbars (Global CSS)
* **Problem:** On Windows (Chrome/Edge/Brave), scrollable containers (like `.table-wrap` on the comparison matrix) and the main window display stark white/grey scrollbar tracks with legacy OS stepper buttons, clashing with NORVI’s dark obsidian aesthetic.
* **Solution in `apps/web/src/styles/global.css`:**
  * Implement modern CSS scrollbar standards (`scrollbar-width: thin; scrollbar-color: ...`).
  * Implement WebKit scrollbar pseudo-elements for Chromium and WebKit browsers:
    * `::-webkit-scrollbar`: 6px–8px width and height.
    * `::-webkit-scrollbar-track`: completely transparent (or subtle `rgba(255, 255, 255, 0.03)`).
    * `::-webkit-scrollbar-thumb`: translucent pill `rgba(255, 255, 255, 0.16)` with rounded borders (`border-radius: 9999px`).
    * `::-webkit-scrollbar-thumb:hover`: vibrant accent lime `rgba(200, 255, 100, 0.45)`.
    * `::-webkit-scrollbar-corner`: transparent.
  * Explicitly apply tailored styling to `.table-wrap`, `.catalog-toolbar`, modal bodies, and media carousels.

---

### Sub-Phase 4.2: Admin Category Lock & Custom Sub-headings
* **Architecture Rationale:**
  * All current agents are Desktop apps. Future roadmap will introduce Mobile and Cloud agents. The `Category` relation is reserved for that future platform taxonomy.
  * In the interim, marketing roles (e.g. *"Interview Assistant"*, *"Autonomous Career Agent"*, *"Viral Content Studio"*) belong in an open sub-heading.
* **Admin UI (`apps/web/src/ui/Workspace.tsx`):**
  * In `ProductForm` -> **Identity & Copy** overview tab:
    * **Category Dropdown:** Add `disabled`, reduced opacity, `cursor: not-allowed`, and a lock badge `🔒 Locked (Platform type reserved for future multi-platform releases)`.
    * **New Sub-heading Field:** Add an input beside Category:
      * Label: `Sub-heading / Agent Role`
      * Placeholder: `e.g. Interview Assistant`
      * Hint: `Displayed as the top pill on customer agent cards and detail pages.`
* **Data Storage (`extended_content.subHeading`):**
  * Stored seamlessly inside Supabase's existing JSONB `extended_content` column as `subHeading`. Requires **zero database migrations**, avoiding schema lockups or downtime.
* **Customer Storefront (`App.tsx` & `PublicPages.tsx`):**
  * **ProductCard (Homepage & Catalog):**
    ```tsx
    <span className="category">
      {product.subHeading || product.extendedContent?.subHeading || product.category?.name || 'Desktop Agent'}
    </span>
    ```
  * **Agent Detail Page (`Detail`):**
    ```tsx
    <span className="category block">
      {product.subHeading || product.extendedContent?.subHeading || product.category?.name || 'Desktop Agent'} · {releaseStatusLabel}
    </span>
    ```
  * **Catalog Search:** Include `subHeading` in search filtering.

---

### Sub-Phase 4.3: Feature Pillar Media & Interactive Detail Modal
* **Admin UI (`apps/web/src/ui/Workspace.tsx`):**
  * In `ProductForm` -> **Feature Pillars** tab:
    * For each pillar card, add:
      1. **Media File Upload:** `<input type="file" accept="video/mp4,video/webm,image/*" />` tied to `handleFileUpload`.
      2. **Media URL Field:** Text input accepting YouTube URLs (`https://youtu.be/...`), MP4 video links, or image URLs.
      3. **Live Admin Preview:** Inline preview showing the attached media or thumbnail.
      4. **Remove Media Button:** Quick button to clear the media attachment.
* **Customer Storefront (`apps/web/src/ui/PublicPages.tsx`):**
  * **Clean Initial Display:**
    * The on-page feature cards do not render massive videos on initial load (preserving high page speed, mobile performance, and clean design).
    * Each card gets a subtle hover elevation and an interactive prompt (e.g. `<span className="pillar-cta">Click to explore capability <ArrowUpRight size={13} /></span>` or a play icon).
  * **Feature Deep-Dive Modal:**
    * State: `const [activePillar, setActivePillar] = useState<FeaturePillar | null>(null);`
    * Clicking any pillar card opens the full-screen backdrop modal:
      * **Header:** Icon + Category Tag + Pillar Title + Close button `[X]`.
      * **Media Player:** Uses `SmartVideoPlayer` for YouTube & MP4 videos, or high-res optimized display for images/GIFs.
      * **Detailed Description:** Formatted readable description of how the capability operates.
      * Closes via `[X]`, clicking backdrop, or pressing Escape.

---

## 3. Files Impacted & Change Summary

| File | Sub-Phase | Changes Planned |
| :--- | :--- | :--- |
| `apps/web/src/styles/global.css` | 4.1 | Global custom scrollbar CSS rules (`*`, `::-webkit-scrollbar`, `.table-wrap`) |
| `packages/shared/model.ts` | 4.2 & 4.3 | Add `subHeading?: string` to `Product` and `AgentExtendedContent` |
| `packages/shared/catalog.json` | 4.2 | Seed initial `subHeading` for Voro, Rolvio, Nexus, Omnix |
| `apps/web/src/ui/Workspace.tsx` | 4.2 & 4.3 | Lock Category dropdown, add Sub-heading input, add media file/URL upload in Pillars tab |
| `apps/web/src/ui/App.tsx` | 4.2 | Render `subHeading` on `ProductCard` |
| `apps/web/src/ui/PublicPages.tsx` | 4.2 & 4.3 | Render `subHeading` on Detail page; implement Feature Pillar interactive deep-dive modal |

---

## 4. Safety & Verification Plan

1. **Zero Database Risk:** Uses existing JSONB fields (`extended_content`) to prevent any database schema locks.
2. **Type Checking:** Run `npm run check` to ensure all TypeScript types align.
3. **Automated Testing:** Run `npm test` across all 31 test suites (232 tests).
4. **Static Route Build:** Run `npm run build` to verify all 45 Astro routes compile without errors.
