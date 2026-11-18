# Phase 16: Storefront Checkout Clarity, Plan Highlights & Free Trial Transparency

## Executive Summary
Phase 16 transforms the customer-facing commercial journey for all NORVI agents.
Building directly upon the dual-tier engine introduced in Phase 15, this phase gives administrators full dynamic control over what customers see on the pricing and checkout pages.

It solves three critical customer-experience needs:
1. **Commercial Value Transparency:** Customers purchasing an agent often wonder what their money buys compared to free alternatives. Phase 16 introduces an editable "Paid Tier Key Highlights" system rendered directly on the agent landing page and checkout order summary.
2. **Honest Free Trial Expectations:** When users claim a 1-day or promotional free trial, Phase 16 displays a transparent comparison explaining that trials use standard community models with daily caps, while paid licenses unlock ultra-fast, task-specialized models.
3. **Public 1-Week Plan Integration:** Integrates the new `1_week` paid license tier seamlessly into the public storefront, pricing toggles, and Razorpay checkout engine.

---

## 1. Core Architectural Pillars

### 1.1 Zero Hardcoded Copy (100% Admin Editable)
* All descriptions, key highlights, and trial notices are stored in the database on `public.products` (within `extended_content` JSONB) and managed via `/admin/releases`.
* Administrators can customize bullet points per agent without redeploying code.
* Includes a 1-click **"✨ Pre-fill High-Converting Highlights"** button in `/admin/releases` to immediately populate standard, high-converting bullet points for any agent.

### 1.2 Upfront Trust & Conversion Optimization
* **Why Free Trial Transparency Boosts Conversions:** When users know that free trial latency is due to a budget community model, they don't blame the agent software. Instead, they understand that upgrading to a Paid License immediately unlocks dedicated, sub-second AI models.
* **Strict Public Boundaries:** Only `1_week` (Paid), `1_month` (Paid), `3_months` (Paid), `lifetime` (Paid), and the `1_day` free trial (when enabled) are accessible on the public storefront. The promotional `1_week_trial` and `1_month_trial` durations only activate when an authorized coupon code is applied or gifted by an admin.
* **Frictionless Checkout Confirmation:** The checkout sidebar clearly enumerates license rights, multi-device allowance, and privacy guarantees right before payment.

---

## 2. Technical Deliverables

### 2.1 Admin Content Controls (`/admin/releases`)

In `apps/web/src/ui/Workspace.tsx` (`AgentReleaseCard`):

1. **Checkout & Pricing Subtitle:**
   * Text input: `Checkout Plan Description`
   * Stored in `product.extended_content.checkout_description`.
   * Default: *"Select your license duration. All paid tiers include high-speed specialized cloud AI models and multi-device access."*

2. **Paid Tier Key Highlights (Bullet Points):**
   * Multi-line or bullet editor: `Paid License Benefits (Displayed on Checkout & Storefront)`
   * Action button: `✨ Pre-fill Recommended Paid Highlights`
   * Default highlights for agents:
     * `⚡ Task-specialized high-speed AI models (e.g. Gemma 31B for coding & voice)`
     * `🚀 Lowest latency priority routing (sub-second voice completions)`
     * `🔓 High daily quota (300+ requests/day fair use)`
     * `🔒 Zero Data Retention (ZDR) — prompts are never used for AI training`
     * `💻 Multi-device activation on up to 3 personal machines simultaneously`

3. **Free Trial Key Highlights & Policy Note:**
   * Editable fields: `Free Trial Highlights` & `Free Trial Notice`
   * Action button: `✨ Pre-fill Recommended Trial Highlights`
   * Default highlights:
     * `🎁 Free trial activation on 1 PC — No credit card required`
     * `📄 Standard community AI model (Nemotron 30B)`
     * `⏱ Daily fair-use quota (50 requests/day)`
   * Default policy note:
     * *"Free trials run on shared community AI endpoints. Upgrade to any paid plan anytime to unlock ultra-fast, task-specialized AI models."*

---

### 2.2 Storefront & Checkout UI Enhancements (`PublicPages.tsx`)

1. **Public Agent Landing Page (`/products/:slug` or `/voro`):**
   * **1-Week Plan Radio Toggle:**
     * Rendered in the pricing cards alongside 1 Month, 3 Months, Lifetime.
     * Dynamic calculation of flash sale and affiliate/coupon discounts.
   * **Paid Tier Benefits Box:**
     * Rendered on the right-hand pricing sidebar below the plan selector.
     * Lists the agent's key highlights with custom checkmark icons (`✔`).

2. **"Start Free Trial" Modal (`/products/:slug`):**
   * Redesigned to present an honest, professional comparison card before activation:
     ```
     ┌────────────────────────────────────────────────────────┐
     │ 🎁 What's included in your 1-Day Free Trial:           │
     │ • Standard community AI model (Nemotron 30B)           │
     │ • 50 requests/day fair-use quota                       │
     │ • Instant 1-PC activation — No credit card required    │
     │                                                        │
     │ 💡 Note: Free trials run on shared community AI        │
     │ endpoints. Upgrade to a paid plan anytime for          │
     │ ultra-fast, task-specialized AI models.                │
     └────────────────────────────────────────────────────────┘
     ```
   * Action buttons: `[Activate Free Trial]` and `[View Paid Plans]`.

3. **Checkout Order Summary (`/checkout/:slug`):**
   * Displays the custom `checkout_description` directly under the product title.
   * Renders the **1-Week Paid Option** with full Razorpay support.
   * Displays the bulleted **Paid Tier Highlights** inside the order summary sidebar, assuring the customer of everything included in their purchase.

4. **Customer Account Dashboard (`/account/agents`):**
   * On the active license card, display an AI tier indicator:
     * Paid License: `👑 Paid Cloud AI Active`
     * Free Trial License: `🎁 Free Trial Tier (50 reqs/day)` with a clean link: *"Upgrade to Paid for Specialized AI Models ↗"*.

---

### 2.3 Promotional & Coupon Redemption Handling

* When a customer applies a 100% off coupon code configured for `1_week_trial` or `1_month_trial`:
  * Checkout total automatically drops to `₹0`.
  * The order summary switches its benefits display to reflect the **Free Trial Tier Highlights**.
  * Clicking "Claim Free Access" creates the license with `is_trial = true` without initiating a Razorpay transaction.

---

## 3. Verification & Safety Criteria

* **Visual & Responsiveness Testing:**
  * Verify pricing toggles on mobile, tablet, and desktop breakpoints.
  * Verify that the 1-Week option renders only when `price_1w` is set and greater than 0.
* **Coupon & Cart Calculation Testing:**
  * Verify that flash sales, referral codes, and duration-specific coupons calculate correctly for 1-Week licenses.
* **Admin Editability:**
  * Verify that changes to highlights in `/admin/releases` reflect immediately on public pages without caching delays.
* **Full Test Suite:**
  * All 39 test suites must pass (272/272 tests), with clean `npm run check` and `npm run build`.
