# NORVI Agency — Customer Dashboard & Storefront Upgrade

**Scope:** Customer Workspace (`/account`), Landing Page (`/`), Storefront Catalog (`/agents`), Pricing (`/pricing`), and Public Supporting Pages.  
**Created:** November 13, 2026  
**Status:** All 3 Phases Completed & Fully Verified  

---

## 1. Upgrade Objectives

1. **Eliminate All Developer Leaks & Technical Jargon:**
   - Remove all mentions of "phase", "simulations", "sales are not open yet", "synthetic preview keys", and "start local preview server".
   - Ensure paying customers only see professional, clear, and reassuring copy.

2. **Fix All Glitches & Broken Routing:**
   - Restore `/delivery` Shipping & Delivery Policy for Razorpay compliance.
   - Implement dedicated `/pricing` page handler (no more 404s).
   - Fix broken partner navigation link (`/account/affiliates` -> `/account/partner`).
   - Fix broken em-dashes (`— collection` -> `A collection`, `THE IDE—` -> `THE IDEA`).
   - Fix the database category name that currently contains an old announcement string.

3. **Complete Customer Dashboard Overhaul (`/account`):**
   - **Overview:** 3-step dynamic onboarding stepper (Download Installer -> Copy License Key -> Connect Machine), account status card, and quick action shortcuts.
   - **Keys & Devices:** One-click key copying with clipboard feedback, device slot counter (e.g. `1 of 3 active`), friendly device telemetry, and safe release confirmation modal.
   - **My Agents:** Rich agent cards with version badges, OS compatibility, download safety fallbacks, and embedded setup guide modals.
   - **Billing & Orders:** Verified commercial purchase receipts with Razorpay payment IDs, plan duration tags, and printable tax invoice modal.
   - **Support:** Interactive ticket thread modal allowing customers to read official support replies.
   - **Partner Program:** Remove preview hints, add clean commission stats and ready-to-share promotional copy templates.

4. **Landing Page & Storefront Trust Upgrades:**
   - Add transparent pricing on agent catalog cards (`Starting at ₹499` / `1-Day Free Trial Available`).
   - Create an interactive agent showcase on the homepage clearly explaining which agent does what work (Voro for interviews, Rolvio for job hunting, Nexus for video shorts).
   - Add trust indicators: 100% Undetectable on Screen Share, Hardware Audio Routing, 100% Local PC Execution, Zero Cloud Token Markups.
   - Complete Nexus feature checklist in catalog and database.

---

## 2. Phase Breakdown (Compact 3-Phase Plan)

| Phase | File | Focus Area | Status |
|---|---|---|---|
| **Phase 1** | [`phase-01-purging-leaks-and-fixing-routes.md`](./phase-01-purging-leaks-and-fixing-routes.md) | Purge all 15 developer leaks, fix `/delivery` & `/pricing` routes, fix broken partner link, fix catalog typos & category name. | ✅ **Completed** |
| **Phase 2** | [`phase-02-customer-dashboard-overhaul.md`](./phase-02-customer-dashboard-overhaul.md) | Customer dashboard overhaul: Onboarding stepper, one-click key copy, device slot counter & telemetry, verified billing receipts/invoices, interactive support replies. | ✅ **Completed** |
| **Phase 3** | [`phase-03-storefront-and-landing-page-trust.md`](./phase-03-storefront-and-landing-page-trust.md) | Storefront dynamic pricing, seamless `/pricing` redirect to `/agents`, homepage interactive agent showcase switcher, trust guarantees ribbon, Nexus catalog & DB completion. | ✅ **Completed** |

---

## 3. Safety & Non-Breaking Commitments

- **Zero Breaking Changes:** Never break active Razorpay checkout, license verification RPCs, or agent hardware authentication APIs.
- **No Feature Removals:** Every existing feature (impersonation, device resets, license reveals, support tickets, partner commissions) is preserved and enhanced.
- **Strict Verification:** Run full test suite (`npm test`, 224+ tests across 29 files) and build check (`npm run build`) after each phase.
