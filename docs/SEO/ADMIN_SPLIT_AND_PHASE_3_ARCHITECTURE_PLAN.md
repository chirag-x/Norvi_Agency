# 🏛️ NORVI Admin Architecture: Products & Releases Separation Plan

> **Document Type:** Architectural Blueprint & Phase 3 Specification  
> **File Location:** `docs/SEO/ADMIN_SPLIT_AND_PHASE_3_ARCHITECTURE_PLAN.md`  
> **Status:** Approved by Founder & In-Progress  
> **Core Principle:** Clean Separation of Concerns between Marketing/Content and Deployment/Releases (100% Dynamic, Zero Hardcoding, Zero Breaking Changes)

---

## 1. Context & Motivation

Previously, editing an agent put every field into a single, overloaded `ProductForm` modal:
- Marketing copy and descriptions
- Visual media (logos, hero videos, GIFs)
- Technical version numbers and system requirements
- Commercial pricing options (1-month, 3-month, lifetime)
- Release status (`development`, `prelaunch`, `live`)
- The catalog notice/disclaimer was hidden in global settings where it lacked intuitive visibility

### The Founder's Refinement
Separate the administration workflow into two distinct, specialized views:
1. **Products (`/admin/products`):** Dedicated to **Brand, Content, Media, Features & SEO**.
   - Contains a top-level **Agent Catalog Notice / Disclaimer Editor** (`bannerText`).
   - Manages agent marketing profiles, screenshots, demo videos, feature pillars, comparison matrix, FAQs, and Google SEO tags.
2. **Agent Releases (`/admin/releases`):** Dedicated to **Commercials, Licensing, Versioning & Deployment**.
   - Dynamically loads all agents from the database.
   - Manages version strings, system requirements, binary download URLs, checksums, release statuses (`development` / `prelaunch` / `live`), pricing tiers (1m / 3m / lifetime), trial toggles, and device seats.

---

## 2. Technical Blueprint

### Tab 1: Products (`/admin/products`)
```
+----------------------------------------------------------------------------------------------------+
| [NOTICE] Agent Catalog Notice / Disclaimer                                                         |
| [ Textarea: "Omnix is in development. Voro and Rolvio are preparing for launch..."               ] |
| [Save Notice] [Clear Notice]                                                                       |
+----------------------------------------------------------------------------------------------------+
| Search: [........................]  Filter: [All / Published / Draft / Archived]  [+ Add New Agent] |
+----------------------------------------------------------------------------------------------------+
| [Agent Card: Voro]     /voro    · AI Interview Assistant      [Edit Content & SEO] [Delete]        |
| [Agent Card: Rolvio]   /rolvio  · Autonomous Job Hunter       [Edit Content & SEO] [Delete]        |
| [Agent Card: Nexus]    /nexus   · Viral Video Repurposer      [Edit Content & SEO] [Delete]        |
+----------------------------------------------------------------------------------------------------+
```

#### Content & SEO Modal (`ProductContentModal`)
Organized into 6 focused marketing tabs:
1. **Identity & Copy:** Agent Name, URL Slug, Category, Tagline, Full Overview Description.
2. **Media & Gallery:** Agent Logo uploader, Hero Preview (video/GIF/image URL or upload), Screenshot gallery repeater.
3. **Features & Workflow:** Feature Pillars (bullet points with category tags and icons), "How It Works" step-by-step workflow builder.
4. **Platform Badges & Comparison:** Verified platform tags (Zoom, Teams, Meet, LinkedIn, etc.), Competitor Comparison matrix (e.g. Voro vs Parakeet.ai, Rolvio vs LazyApply).
5. **Interactive FAQs:** Add/edit/remove FAQ items (feeds into both UI accordion and Google `FAQPage` schema).
6. **Google SEO Engine:** Custom Meta Title (with SERP length indicator), Meta Description (with length indicator), Target Keywords, and OpenGraph Social Image.

---

### Tab 2: Agent Releases (`/admin/releases`)
```
+----------------------------------------------------------------------------------------------------+
| AGENT RELEASES & MONETIZATION                                                                      |
| Manage deployment versions, binary distribution links, release readiness, and multi-tier pricing.  |
+----------------------------------------------------------------------------------------------------+
| VORO RELEASES & PRICING                                                                            |
| Release Status: [ Live - Available for download v ]     Publication: [ Published v ]               |
| Current Version: [ v1.2.0 ]      Requirements: [ Windows 10+ 64-bit / macOS 12+ ]                  |
| Pricing Matrix:                                                                                    |
|   - Display Label: [ Starting at ₹499 ]                                                            |
|   - 1-Month: [ ₹499 ]   - 3-Months: [ ₹1,199 ]   - Lifetime: [ ₹2,499 ]                            |
| Binary Distribution:                                                                               |
|   - Download URL: [ https://storage.nor-vi.in/binaries/voro-setup-v1.2.0.exe ]                    |
|   - SHA-256 Checksum: [ e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 ]      |
| AI Usage Note: [ Unlimited local processing. BYO API keys. ]                                       |
| Device Allowance: [ 1 active device per license ]                                                  |
| [Save Release Settings]                                                                            |
+----------------------------------------------------------------------------------------------------+
| ROLVIO RELEASES & PRICING ...                                                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Compatibility & Non-Breaking Guarantees

1. **Unified Database Layer:**
   - Both tabs read and write to the same `public.products` table using the existing `admin_upsert_product` RPC.
   - No schema migrations required; Phase 1's `extended_content` jsonb accommodates all content and SEO data.
2. **Zero Commercial Breakage:**
   - Existing orders, customer licenses, download URLs, and checkout routes continue to query `products` exactly as before.
3. **Admin Routing & RBAC:**
   - Sidebar navigation updated with `/admin/products` ("Products & Content") and `/admin/releases` ("Agent Releases").
   - Added to permissions map for `administrator` and `product_manager`.
4. **Local Verification Only:**
   - Zero git commits pushed to remote repository. All changes verified locally via test suites and preview servers.
