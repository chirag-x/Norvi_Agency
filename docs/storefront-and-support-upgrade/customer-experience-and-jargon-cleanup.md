# Customer Experience & Jargon Cleanup Plan
**Document Version:** 1.0.0  
**Status:** Approved & Implementation In Progress  
**Scope:** Storefront, Help Center, Customer Dashboard, Product Catalog, Legal & Security Pages

---

## 1. Executive Summary & Core Directives

The objective of this phase is to eliminate technical jargon, internal implementation leaks, awkward phrasing, and grammatical inaccuracies from all customer-facing surfaces across NORVI Agency. 

### Critical Operating Constraints:
1. **Zero Functionality Removal:** All authentication, payment flows, device management, and catalog rendering remain intact.
2. **Explicit Offline Support Duration:** All references to offline capability must strictly state **1-Day Offline Support** (up to 24 hours). The legacy "7-day" wording is obsolete and must not appear anywhere.
3. **No Hardcoded Values:** Dynamic pricing, licensing rules, and RPC integrations are preserved.
4. **Friendly, Customer-Centric Voice:** Clear, trustworthy, and non-intimidating language for everyday professionals and buyers.

---

## 2. Itemized Change Specification

### Area 1: Help Center (`apps/web/src/ui/PublicPages.tsx`)

| Card Index & Title | Current Text | Upgraded Customer-Centric Text |
| :--- | :--- | :--- |
| **Card 5: Offline Operation** | *7-Day offline validation lease*<br>Our agents are built for local PC reliability. Once activated, your agent holds a 7-day offline lease cache, meaning you can continue using it smoothly even without an active internet connection. | **1-Day Offline Support**<br>Our agents are built for local PC reliability. Once activated, your agent can run offline for up to 24 hours before performing a quick license check, so you can work comfortably on the go. |
| **Card 6: Payment Security** | *Payment methods & Razorpay security*<br>We support instant checkout via UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards, and Netbanking powered by 256-bit Razorpay encryption. | **Payment Methods & Razorpay Security**<br>We support instant checkout via UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards, and Netbanking powered by Razorpay. Verified invoices are available in your Billing tab. |

---

### Area 2: Customer Dashboard (`apps/web/src/ui/Workspace.tsx`)

| Element | Location | Current Text | Upgraded Customer-Centric Text |
| :--- | :--- | :--- | :--- |
| **Disconnect Modal Title** | Line 153 | `Release Hardware Slot` | `Disconnect Computer` |
| **Disconnect Modal Question** | Line 155 | `Are you sure you want to release the hardware authorization for this machine?` | `Are you sure you want to disconnect this computer from your license?` |
| **Disconnect Modal Label** | Line 158 | `Hardware Installation ID` | `Device Identifier` |
| **Disconnect Modal Warning** | Line 162 | `⚠️ Releasing this hardware slot deactivates the agent on this specific computer and immediately frees the slot cleanly so you can activate another PC or laptop.` | `⚠️ Disconnecting this computer deactivates the agent on this machine and immediately frees up your device allowance so you can connect a new PC or laptop.` |
| **Disconnect Modal Button** | Line 178 | `Release Device Slot` (Busy: `Releasing...`) | `Disconnect Computer` (Busy: `Disconnecting...`) |
| **Slot Count Indicator** | Line 453 & Line 552 | `{activeCount} of {maxCount} slots linked` | `{activeCount} of {maxCount} computers connected` |
| **Onboarding Stepper** | Line 345 | `Native Windows 10/11 64-bit installer` | `Native installer for Windows 10/11 or macOS 12+` |
| **Customer Navigation Leak** | Line 45 | `Open staff preview` (`/admin/login`) | `Return to my account` (`/account`) |
| **Partner Payout Threshold** | Line 1258 | `pendingBalance < 200000` (₹2,000) | `pendingBalance < 100000` (₹1,000 threshold matching storefront promise) |

---

### Area 3: Homepage Trust & FAQ (`apps/web/src/ui/App.tsx`)

| Element | Location | Current Text | Upgraded Customer-Centric Text |
| :--- | :--- | :--- | :--- |
| **FAQ 5: Offline Use** | Line 458 | `Yes. Once activated, our desktop agents maintain a 1-day offline lease cache. You can continue using your tools on your machine even if you lose internet connectivity or are working on the go.` | `Yes. Once activated, your agent can operate completely offline for up to 24 hours (1 day) before performing a brief background check. You can continue using your tools on your machine even if you are traveling or lose internet connectivity.` |
| **Step 1 Journey** | Line 458 | `Review transparent hardware specs, live demos, and capabilities.` | *Clear and balanced.* |
| **Cookie Banner Policy** | Line 288 | `We never share customer audio, interview transcripts, or AI tokens.` | `We never share customer audio, interview transcripts, or private application data.` |

---

### Area 4: Legal & Compliance Documents (`apps/web/src/ui/PublicPages.tsx`)

| Document & Section | Current Text | Upgraded Professional Text |
| :--- | :--- | :--- |
| **License Agreement: Connection Requirements** | `The agent requires periodic online validation. An offline authorization lease lasts for 7 days.` | `The agent requires periodic online validation. Once activated, your agent can operate offline for up to 24 hours (1 day) before performing a brief background license check.` |
| **Privacy Policy: Service Providers** | `We use secure providers like Supabase for accounts, Razorpay for payments, and Resend for email.` | `We use trusted enterprise infrastructure for account security, Razorpay for encrypted payment processing, and verified services for transactional email delivery.` |

---

### Area 5: Auth & Security (`apps/web/src/ui/Accounts.tsx`)

| Element | Location | Current Text | Upgraded Text |
| :--- | :--- | :--- | :--- |
| **Login Subtitle** | Line 49 | `Individual accounts. Administrator MFA.` | `Verified customer accounts. Encrypted login security.` |
| **Offline Maintenance Notice** | Line 51 | `Real registration is disabled until Supabase is connected.` | `Account registration is currently undergoing quick maintenance. Please check back shortly.` |
| **MFA Recovery Text** | Line 80 | `contact the owner for identity-verified recovery` | `contact NORVI support for identity-verified recovery.` |

---

### Area 6: Product Catalog & Agent Descriptions (`packages/shared/catalog.json`)

| Agent & Field | Current Text | Corrected Professional Text |
| :--- | :--- | :--- |
| **Rolvio (`workflowDescription`)** | `Rolvio spins up background workers to scrape job boards. It compares strict requirements against your resume using an its Brain. If approved, it launches autonomous browser sub agents to apply, then tracks email responses natively in a Kanban dashboard.` | `Rolvio automatically searches matching job boards and compares strict requirements against your resume using its intelligent matching engine. When a match is found, it automatically fills out the application and tracks recruiter replies on your visual job tracker.` |
| **Nexus (`workflowDescription`)** | `...The Nexus background daemon will handle the rest, silently publishing your content at the exact right time while and works if you close Nexus app.` | `...The Nexus silent background engine handles the rest, automatically publishing your content at the scheduled time—even if you close the Nexus app window.` |
| **Nexus (`badgeText`)** | `⚡ 100% Local Execution \| Autonomous 24/7 Publishing Daemon \| Zero Cloud Subscriptions` | `⚡ 100% Local Execution \| Autonomous Background Publishing \| Zero Cloud Subscriptions` |
| **Nexus (`featurePillars[1].description`)** | `...Nexus features an autonomous background daemon that sits in your Windows system tray... With isolated platform task queues...` | `...Nexus features an autonomous background publishing engine that sits in your system tray... With isolated platform queues...` |

---

## 3. Verification & Safety Protocol

1. **Static Analysis & Type Checking:** Run `npm run check` across `@norvi/web` and `@norvi/api`.
2. **Automated Unit & Integration Tests:** Run `npm test` to ensure all 232 test cases pass without regressions.
3. **Static Route Pre-rendering:** Run `npm run build` to verify all 45 Astro routes render flawlessly.
