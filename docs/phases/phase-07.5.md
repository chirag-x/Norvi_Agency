# Phase 07.5: Razorpay Compliance & Website Readiness

**Status:** Planned
**Goal:** Upgrade the public-facing website and legal pages to strictly meet Razorpay and RBI compliance guidelines. This is a mandatory business blocker required to get approval for Live API keys.

## Why this phase exists
Razorpay manually reviews the website before approving live payments. They reject applications if physical contact details are missing, legal pages are incomplete, or if there is no actively priced product available for purchase. 

To ensure zero downtime and avoid breaking the working frontend, this phase is broken into two safe parts:

### Part 1: Legal & Contact Expansion (Static Content)
*This part focuses strictly on updating static text strings and adding required compliance pages without altering any core logic.*

- [x] **Contact Page:** Add a registered physical business address and a customer support phone number to the Contact UI.
- [x] **Terms of Service:** Expand the placeholder text to include the full registered business name, registered address, and governing law (e.g., Jurisdiction in India).
- [x] **Privacy Policy:** Add mandatory Indian IT Act clauses, including the mention of a Grievance Officer / Data Protection contact.
- [x] **Refund & Cancellation Policy:** Rename the Refunds policy to include "Cancellation". Add an explicit clause stating that digital license orders cannot be cancelled once the payment is processed.
- [x] **Shipping & Delivery Policy:** Create a new legal section specifically for Shipping & Delivery, explaining that digital AI agents (license keys) are delivered instantly via email and dashboard. Add this link to the global Footer.

### Part 2: Product & Checkout Readiness (Storefront Data)
*This part focuses on ensuring the payment gateway reviewers see a functional store with real pricing.*

- [x] **Remove Placeholder Badges:** Remove the "Preparing for launch" and "In development" badges from at least one product (e.g., Voro) on the public `/agents` page.
- [x] **Set Live Pricing:** Update the product pricing from placeholders/TBD to a clear INR amount (e.g., ₹999) so reviewers can verify what is being sold.
- [x] **Footer Fineprint:** Remove or update the footer fineprint that says "Pricing and release requirements are being finalized."

## Target Files to Update
- `apps/web/src/ui/PublicPages.tsx` (Contains the hardcoded `legal` object, About, and Contact layouts)
- `apps/web/src/ui/App.tsx` or global Footer component (To add the Delivery policy link)
- Storefront/Agent UI components (To update product badges and pricing text)

---
*Note: Completing Phase 07.5 will allow us to submit the Razorpay KYC application. While we wait for their 3-5 day review, we will move on to integrating the activation and hardware tracking directly into the desktop agents.*


