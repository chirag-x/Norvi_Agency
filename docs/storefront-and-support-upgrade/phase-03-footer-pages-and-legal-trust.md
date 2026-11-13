# Phase 3 — Footer Supporting Pages & Legal Trust Upgrades

**Target File:** `apps/web/src/ui/PublicPages.tsx`  
**Status:** Planned  

---

## 1. Objectives

1. **Storefront Catalog Polish (`/agents`):** Add category filter tabs (`All Agents`, `Career Automation`, `Engineering & Dev`, `Content & Media`) and OS compatibility badges (`Windows 10/11` & `macOS 12+`) on agent cards.
2. **Partner Program Details (`/partners`):** Add a clean 3-item Partner FAQ accordion answering common questions regarding payouts (UPI / Bank transfer), minimum payout threshold (₹1,000), and 30-day referral attribution.
3. **Core Principles in `/about`:** Reinforce agency trust by highlighting the 3 founding engineering pillars below the Founder card: Local-First Privacy, Zero Token Markups, and Multi-Device Freedom.
4. **Local-First Privacy Guarantee in `/privacy` & `/license`:** Explicitly document that all audio feeds, screen OCR, code analysis, and job credentials run strictly inside the user's local PC memory and are never harvested, uploaded to external databases, or used for model training.

---

## 2. Component 1: Catalog Category Filters (`/agents`)

- Add filter pills:
  - `All Agents`
  - `Career Automation` (Rolvio)
  - `Engineering & Dev` (Voro)
  - `Content & Media` (Nexus)
- Enhance card metadata to display supported operating systems:
  - `Windows 10/11 (64-bit)` & `macOS 12+`

---

## 3. Component 2: Partner Program FAQ (`/partners`)

Add an accordion section beneath the criteria cards:

```typescript
const partnerFaqs = [
  [
    'How and when do I receive commission payouts?',
    'Commissions are paid directly to your registered UPI ID or Indian bank account upon request. You can request a payout anytime once your balance reaches the ₹1,000 minimum threshold.'
  ],
  [
    'How does referral tracking work?',
    'When a customer applies your unique referral code during checkout, the sale is instantly attributed to your partner account, granting them a 10% discount and crediting you a 15% commission.'
  ],
  [
    'Are there any fees or subscriber minimums to join?',
    'No. The NORVI Partner Program is 100% free to join for developers, creators, agencies, and tech enthusiasts. There are no minimum audience requirements.'
  ]
];
```

---

## 4. Component 3: Core Principles in `/about`

Directly below the "Meet the Founder" card for Chirag Sharma, add 3 visual principle cards:

1. **100% Local-First Privacy:**
   - Your audio, code, screen captures, and job applications are processed entirely in your computer's memory. We do not store or inspect your private workflow data.
2. **Zero Token Markup / Hidden Fees:**
   - No surprise recurring API token fees. Our transparent license models (1-Month, 3-Month, Lifetime) give you predictable access without bill shock.
3. **Multi-Device Flexibility:**
   - We believe tools should follow your workflow. Every license includes up to 3 simultaneous personal devices with self-serve release tools in your dashboard.

---

## 5. Component 4: Privacy & License Policy Upgrade (`/privacy` & `/license`)

In the `legal` dictionary in `apps/web/src/ui/PublicPages.tsx`:

- **Privacy Policy (`/privacy`):**
  - Add section: **"Local Processing & Confidentiality"**
  - Text: *"NORVI desktop software executes locally on your hardware. Audio streams, screen visual feeds, clipboard contents, and applicant profile data processed by the agent remain on your device and are never recorded, transmitted to our servers, or used for AI model training."*
- **License Agreement (`/license`):**
  - Clearly state the **3-device allowance per license** and the **7-day offline verification lease duration**.

---

## 6. Verification Checklist

1. Filter pills on `/agents` filter the products correctly without breaking search.
2. Partner FAQs expand and collapse properly on `/partners`.
3. Core principles render cleanly with responsive styling on `/about`.
4. Legal policies display the local privacy clauses clearly.
5. Run full test and build suite: `npm run check`, `npm test`, `npm run build`.
