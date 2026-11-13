# Phase 2 — Help Center & Contact Experience Upgrade

**Target File:** `apps/web/src/ui/PublicPages.tsx`  
**Status:** ✅ Completed & Fully Verified  

---

## 1. Objectives

1. **Expand Help Center (`/help`):** Expand from 6 short items to 8 comprehensive, practical guide cards covering installation troubleshooting (such as Windows SmartScreen), key management, multi-device rotation, offline leases, and payment security.
2. **Help Center WhatsApp Banner:** Add an inline quick-contact banner in `/help` pointing directly to the official WhatsApp channel (`+91 9893534314`).
3. **Contact Page (`/contact`) Elevation:** Add a prominent "Fastest Support: Chat on WhatsApp" card alongside the contact form, including operating hours (Mon–Sat, 10 AM – 8 PM IST) and expected response times (< 30 minutes for WhatsApp, < 12 hours for email).

---

## 2. Component 1: Help Center Guide Expansion (`/help`)

### Proposed 8 Comprehensive Help Cards

```typescript
const helpItems = [
  [
    'Getting started & account setup',
    'Create your verified account in 30 seconds. Explore our catalog of desktop agents, check the operating system requirements (Windows 10/11 64-bit or macOS 12+), and choose your preferred license tier.'
  ],
  [
    'Instant key delivery & retrieval',
    'Your unique license key (NORVI-••••-••••) is generated instantly upon payment. You can find it anytime in your dashboard under "Keys & devices", where you can reveal or copy it with a single click.'
  ],
  [
    'Installing on Windows & macOS',
    'Download the installer from "My agents". On Windows, because agent builds are regularly updated, SmartScreen may show an alert—click "More info" followed by "Run anyway". On macOS, open the DMG and move the app to Applications.'
  ],
  [
    'Multi-device management (up to 3 PCs)',
    'Each license includes activation on up to 3 personal machines simultaneously. If you upgrade your PC or need to switch machines, open your "Keys & devices" dashboard and click "Release device" with zero hassle.'
  ],
  [
    '7-Day offline validation lease',
    'Our agents are built for local PC reliability. Once activated, your agent holds a 7-day offline lease cache, meaning you can continue using it smoothly even without an active internet connection.'
  ],
  [
    'Payment methods & Razorpay security',
    'We support instant checkout via UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards, and Netbanking powered by 256-bit Razorpay encryption. Verified invoices are available in your Billing tab.'
  ],
  [
    'Partner program & referral earnings',
    'Earn 15% commission on every customer referral while giving your audience an exclusive 10% discount. Generate your unique referral code from the Partner tab in your account dashboard.'
  ],
  [
    'Trouble activating or running an agent?',
    'Ensure you are entering the key for the matching agent product and that your machine has an internet connection for initial verification. If you run into issues, message our WhatsApp support for live troubleshooting.'
  ]
];
```

### Direct WhatsApp Banner in `/help`
Below the search bar and cards, add an inline support callout:
- *"Need instant help? Connect with our engineering team on WhatsApp at +91 9893534314 (Typical reply within 30 minutes)."*

---

## 3. Component 2: Contact Page Upgrade (`/contact`)

### Enhancements
- **WhatsApp Support Spotlight Card:**
  - Placed prominently above or beside the contact form.
  - Heading: **"Fastest Support: Chat on WhatsApp"**
  - Subtitle: *"Get immediate answers regarding licenses, system compatibility, and downloads."*
  - Button: **"Start WhatsApp Chat"** (`https://wa.me/919893534314?text=...`)
  - Operating Hours: **Mon – Sat, 10:00 AM – 8:00 PM IST**
  - Expected Response: **< 30 minutes on WhatsApp**, **< 12 hours on email**
- **Existing Channels Retained:**
  - Public contact form (submitting to both Netlify Forms and Discord `# │ norvi-contact` webhook).
  - Registered customer support shortcut (`/account/support`).
  - Office address: *Kunj Vihar, Gole Ka Mandir, Gwalior, MP, India 474005*.

---

## 4. Verification Checklist

1. Search filter in `/help` works accurately across all 8 guide items.
2. WhatsApp button in `/help` and `/contact` links cleanly to `+91 9893534314`.
3. Contact form submissions still successfully dispatch to Netlify and Discord.
4. Run automated tests: `npm run check`, `npm test`, `npm run build`.
