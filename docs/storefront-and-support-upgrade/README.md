# NORVI Agency — Storefront, Help & Support Experience Upgrade

**Scope:** Homepage (`/`), Floating WhatsApp Support, Help Center (`/help`), Contact Us (`/contact`), and Footer Supporting Pages (`/agents`, `/partners`, `/about`, `/privacy`, `/terms`, `/license`).  
**Created:** November 13, 2026  
**Status:** Planned (Ready for Phase 1 Execution Upon Confirmation)  

---

## 1. Executive Summary

This upgrade modernizes outdated copy, addresses core customer conversion questions, and introduces direct WhatsApp support alongside the existing AI chat assistant.

Key problems being solved:
1. **Outdated Homepage FAQ:** The existing 4 questions date back to early development. They are generic and miss what actual buyers care about (local desktop execution, 3-device allowance, instant key generation, zero token markups, and offline leases).
2. **Under-informative 3-Step Section:** "Less setup. More momentum" currently contains 1-sentence lines that fail to communicate the simple 3-step path to finding, purchasing, and activating an agent.
3. **Missing Direct WhatsApp Channel:** Customers want immediate real-time human support. We are adding an official WhatsApp floating support button (`+91 9893534314`) directly above the floating AI agent button.
4. **Outdated/Weak Footer Pages:** The Help Center, Contact page, Partner Program, and Legal policies need practical guidance (e.g. Windows SmartScreen tips, offline leases, local privacy guarantees, and clear response times).

---

## 2. Phase Breakdown (3 Structured Phases)

| Phase | Specification File | Focus Areas | Key Deliverables | Status |
|---|---|---|---|---|
| **Phase 1** | [`phase-01-homepage-clarity-and-whatsapp-support.md`](./phase-01-homepage-clarity-and-whatsapp-support.md) | Homepage FAQs, 3-Step Journey & Floating WhatsApp Button | • 6 modernized, high-converting homepage FAQs<br>• Informative 3-step journey cards<br>• Floating WhatsApp support button (`bottom: 96px`, `#25D366`) | ✅ **Completed** |
| **Phase 2** | [`phase-02-help-center-and-contact-experience.md`](./phase-02-help-center-and-contact-experience.md) | Help Center (`/help`) & Contact Page (`/contact`) | • 8 detailed Help Center guide cards<br>• Windows SmartScreen "Run Anyway" advice<br>• Direct WhatsApp quick-help card on `/contact` & `/help`<br>• Response time SLA guarantees | ✅ **Completed** |
| **Phase 3** | [`phase-03-footer-pages-and-legal-trust.md`](./phase-03-footer-pages-and-legal-trust.md) | Explore & Legal Pages (`/agents`, `/partners`, `/about`, `/privacy`, `/license`) | • Category filter pills & OS badges on `/agents`<br>• Partner payout FAQ accordion on `/partners`<br>• Core Engineering Principles on `/about`<br>• Local-first zero-harvesting privacy clause on `/privacy` & `/license` | ⏳ *Planned* |

---

## 3. Strict Safety & Architecture Commitments

- **No Hardcoded Pricing:** All prices remain strictly dynamic, fetched in real-time from the database and admin catalog.
- **Non-Breaking Visual Flow:** The WhatsApp button sits cleanly above the AI chat bubble (`bottom: 96px, right: 26px`), never obstructing the chat widget or mobile navigation.
- **Zero Breaking Changes:** Checkout flows, Razorpay integration, database schemas, and agent hardware authentication remain 100% untouched.
- **Strict Verification:** Every phase is verified with TypeScript compiler (`npm run check`), full test suite (`npm test`), and production build (`npm run build`).
