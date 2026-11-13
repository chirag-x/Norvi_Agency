# Phase 1 — Homepage Clarity & Floating WhatsApp Support

**Target File:** `apps/web/src/ui/App.tsx`  
**Status:** ✅ Completed & Fully Verified  

---

## 1. Objectives

1. **Modernize Homepage FAQs:** Replace the outdated 4 generic questions with 6 reassuring, modern questions that directly address buyer concerns (desktop architecture, 3-device allowance, instant key delivery, zero token markups, 7-day offline leases, and tier upgrades).
2. **Elevate the 3-Step Journey Section:** Replace the single-line placeholders in *"Less setup. More momentum. A clear path to your next agent"* with 3 rich, informative value cards.
3. **Add Floating WhatsApp Support Button:** Add an official WhatsApp floating button positioned directly above the floating AI agent chat button on the bottom-right of the screen (`bottom: 96px, right: 26px`), opening a direct chat to `+91 9893534314`.

---

## 2. Component 1: Modern Homepage FAQs

In `apps/web/src/ui/App.tsx` within the `Home` component:

### Proposed 6 FAQs

```typescript
const homeFaqs = [
  [
    'What makes NORVI desktop AI agents different from web chatbots?',
    'Unlike web-based chatbots or browser extensions that require constant cloud uploads, NORVI agents are native desktop applications (Windows 10/11 64-bit and macOS). They run locally on your machine, process screen context and audio with low latency, and keep your sensitive work and private data on your device.'
  ],
  [
    'How do licenses and device activations work?',
    'Every purchased license allows simultaneous activation on up to 3 of your personal computers (e.g., your desktop and laptop). If you change machines, you can release or rotate your active devices anytime with 1 click directly from your Keys & Devices dashboard.'
  ],
  [
    'Where and how do I receive my activation key after purchase?',
    'Delivery is instant. The moment your checkout completes via Razorpay, your unique activation key (NORVI-••••-••••) is displayed on screen, added to your /account/licenses dashboard, and emailed to you. You can copy it with one click and activate your agent immediately.'
  ],
  [
    'Do I have to pay ongoing cloud token fees or hidden markups?',
    'No. All NORVI agents include unlimited local PC execution with zero token markups. For features using high-speed cloud intelligence (such as live transcription or speech models), generous quotas are included or direct transparent routing is provided—with no surprise bills.'
  ],
  [
    'Can I use my agent offline without an internet connection?',
    'Yes. Once activated, our desktop agents maintain a 7-day offline lease cache. You can continue using your tools on your machine even if you lose internet connectivity or are working on the go.'
  ],
  [
    'Can I upgrade my plan from 1-Month or 3-Month to Lifetime later?',
    'Yes. You can renew or upgrade your license tier at any time from your account dashboard. Upgrading to Lifetime access unlocks permanent software updates and priority technical support.'
  ]
];
```

---

## 3. Component 2: Informative 3-Step Journey Cards

In `apps/web/src/ui/App.tsx` within the `how-section`:

### Current vs Proposed Content

```typescript
const workflowSteps = [
  [
    '01',
    'Find your dedicated agent',
    'Browse purpose-built agents like Voro (real-time interview & coding copilot), Rolvio (job hunter & tracker), or Nexus (viral content studio). Review transparent hardware specs, live demos, and capabilities.'
  ],
  [
    '02',
    'Choose your license tier',
    'Select flexible 1-Month, 3-Month, or Lifetime access with zero recurring surprise billing. Pay securely via Razorpay (UPI, Cards, Netbanking) for instant digital fulfillment.'
  ],
  [
    '03',
    'Install & run locally',
    'Download the lightweight native installer for Windows or macOS directly from your dashboard. Paste your activation key once to unlock full local PC execution with multi-device support.'
  ]
];
```

---

## 4. Component 3: Floating WhatsApp Support Button

### Architecture & Positioning
- **Placement:** Bottom-right corner, stacked directly above the AI Chat Widget.
  - AI Chat Widget: `bottom: 24px, right: 24px` (size 60x60px).
  - WhatsApp Button: `bottom: 96px, right: 26px` (size 54x54px).
- **Target URL:**
  ```text
  https://wa.me/919893534314?text=Hi%20NORVI%20Agency%2C%20I%20have%20a%20question%20about%20your%20AI%20agents.
  ```
- **Visual Design:**
  - Background: `#25D366` (Official WhatsApp Green).
  - Hover: `#20ba59` with subtle glow `box-shadow: 0 4px 16px rgba(37, 211, 102, 0.45)`.
  - Icon: White WhatsApp chat SVG icon with phone silhouette.
  - Hover Tooltip: Floating pill with *"Chat on WhatsApp (+91 9893534314)"*.
  - Opens in new tab (`target="_blank" rel="noopener noreferrer"`).
  - Accessible on all public and customer pages.

---

## 5. Verification Checklist

1. Verify layout on desktop and mobile: ensure the WhatsApp button sits cleanly 18px above the AI chat bubble with zero overlap.
2. Click WhatsApp button: verify it redirects directly to `wa.me/919893534314` with the pre-filled message.
3. Verify all 6 FAQs expand and collapse smoothly with accordion icons.
4. Verify 3-step cards render clearly across responsive screen widths.
5. Run automated tests: `npm run check`, `npm test`, `npm run build`.
