# Phase 2: Customer Dashboard Overhaul (`/account`)

**Target Files:**
- `apps/web/src/ui/Workspace.tsx`
- `apps/api/live.ts`
- `apps/api/app.ts`
- Unit & UI tests in `tests/`

---

## 1. Overview Tab (`/account`) Overhaul

### Dynamic 3-Step Quick Setup Stepper
For any customer with an active license, display an interactive onboarding hub at the top:
1. **Step 1: Download Software** — Direct download CTA for the latest agent installer (`.exe` / `.zip`).
2. **Step 2: Copy Activation Key** — One-click key copy button with masked snippet (`NORVI-••••-VOR1`) and clipboard confirmation.
3. **Step 3: Connect Hardware** — Hardware status indicator displaying active slot usage (e.g. `1 of 3 devices active`).

### Account Identity & Trust Header
- Customer Avatar with initials.
- Account Tier Badge: `Verified Customer` (or `Partner` if enrolled).
- Security Status Pill: `2FA Protected` or `Email Verified`.
- Registered Date: Formatted cleanly (`Member since [Date]`).

---

## 2. Keys & Devices Tab (`/account/licenses`) Overhaul

### One-Click Key Copying
- Eliminate the friction of forcing customers to open a modal just to copy a key.
- Provide a direct **Copy Key** button right next to the masked key line (`NORVI-XXXX-XXXX-XXXX-VOR1`) with instant feedback (`Copied to clipboard!`).
- The "Reveal Key" option remains available for customers who want to visually inspect the unmasked key.

### Device Slot Counter & Friendly Telemetry
- **Slot Capacity Indicator:** Displays a clear badge such as `Device 1 of 3 active` or `Device slots full (3/3)`.
- **Friendly Telemetry:** Instead of only showing a raw hardware UUID (`9f8e-1234-5678`), show:
  - Device Status: Green active indicator (`Linked & Authorized`).
  - Last Seen Time: `Active 2 hours ago` or `Linked today`.
  - Machine Alias / Hardware ID snippet.

### Safe Device Release Confirmation Modal
- Replace instant unconfirmed unlinking with a safety confirmation modal:
  *“Release hardware slot for this machine? This frees the slot cleanly so you can activate another PC or laptop immediately.”*

---

## 3. My Agents Tab (`/account/agents`) Overhaul

### Rich Agent Cards
Upgrade each purchased agent card with comprehensive operational metadata:
- **Official Version:** Badge showing current build (e.g. `v1.3.8`).
- **OS & Environment:** `Windows 10 / 11 (64-bit)` · `Low-end PC Ready`.
- **License Duration Badge:** `Lifetime Access` (brand lime green) or `Valid until [Date]`.
- **License Key Snippet:** `NORVI-••••-[suffix]` with a quick copy button.
- **Dual CTAs:**
  - `Download Installer` (with direct download URL and size info).
  - `Open Setup Guide` (opens the embedded `AgentGuideModal`).

---

## 4. Billing & Orders Tab (`/account/billing`) Overhaul

### Verified Commercial Purchase Receipts Table
Replace the basic order table with a professional receipt journal:
- **Order ID:** `#30000000` with copy button.
- **Agent Name & Icon:** Direct link to product walkthrough.
- **Plan Duration:** `1 Month`, `3 Months`, or `Lifetime Access`.
- **Amount Paid:** `₹499.00` (or `₹0` for free trials / 100% coupons).
- **Payment Reference:** Razorpay transaction ID (`pay_...`).
- **Status Badge:** `Paid` (good), `Free Trial` (blue), or `Gifted` (purple).
- **Actions:** `View Invoice / Receipt` button.

### Printable Tax Invoice / Receipt Modal
Clicking "View Invoice" opens a clean, printable receipt modal:
- Company Branding: Norvi AI Agency, Gwalior, Madhya Pradesh, India.
- Customer Details: Name & Email.
- Transaction Details: Order Date, Order ID, Razorpay Payment ID.
- Itemized Breakdown: Product Name, License Tier, Subtotal, Discount, Total Paid in ₹ INR.
- License Issuance Stamp: Stamped with key suffix and activation instructions.
- Print / Download button (`window.print()`).

---

## 5. Support Tab (`/account/support`) Overhaul

### Interactive Ticket Conversation Modal
- Currently, tickets in `/account/support` only show subject, date, and status.
- Add an interactive modal: Clicking any ticket row opens the full conversation:
  - Customer's initial inquiry and timestamp.
  - Support team's official response (fetched from support requests/replies).
  - Status badge: `Open`, `In Progress`, or `Resolved`.

### Priority Contact Channels
- Direct contact cards for `norviagency@gmail.com` and Discord/Telegram.
- Support operating hours: `Mon–Sat, 10am–6pm IST`.

---

## 6. Partner Program Tab (`/account/partner`) Overhaul

- Remove all `Local preview data` glitches.
- Clean stat cards: `Total Sales`, `Pending Balance (₹ INR)`, `Lifetime Payouts (₹ INR)`.
- Ready-to-share promotional marketing templates:
  - Twitter/X tweet generator with embedded referral code.
  - LinkedIn post copy.
  - WhatsApp broadcast snippet.
- Downloadable promotional video & image assets.

---

## 7. Verification Steps for Phase 2 (COMPLETED)

1. [x] Run TypeScript check: `npm run check` - **PASSED (0 errors)**.
2. [x] Run vitest suite: `npm test` - **PASSED (All 30 test files, 230 tests passing)**.
3. [x] Dynamic 3-step Quick Setup Stepper & Customer Identity Bar implemented in `/account`.
4. [x] One-click key copying with clipboard feedback & safety device release modal in `/account/licenses`.
5. [x] Rich agent cards with version pills, OS requirements, and setup guide in `/account/agents`.
6. [x] Verified order table with Razorpay payment references & printable tax invoice modal in `/account/billing`.
7. [x] Interactive ticket inquiry modal & priority contact channels in `/account/support`.
8. [x] Ready-to-share social copy snippets in `/account/partner`.
9. [x] Production static build: `npm run build` - **PASSED (All 44 pages built in 1.14s)**.
