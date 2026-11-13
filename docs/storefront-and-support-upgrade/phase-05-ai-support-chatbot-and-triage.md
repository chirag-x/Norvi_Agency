# Phase 5 Upgrade Specification: AI Support Chatbot & Smart Triage System

**Document Version:** 1.0.0  
**Status:** Planned & Ready for Approval (Zero Code Modified)  
**Location:** `docs/storefront-and-support-upgrade/phase-05-ai-support-chatbot-and-triage.md`

---

## 1. Executive Summary & Core Objectives

Currently, visitors and customers needing help must either send a manual contact form, open a support ticket, or message on WhatsApp. While a floating AI bot button exists at the bottom corner, it is not prominently integrated where customers actually look for help.

In this phase, we introduce a **dedicated, first-line AI Support Chatbot experience** integrated directly into the core support pages:
1. **The Public Help Center (`/help`):** An interactive self-serve AI chat box allowing visitors to get instant, accurate answers about agent capabilities, download links, payments, and setup before needing human help.
2. **The Contact Us Page (`/contact`):** An upfront AI resolution option so users can solve common questions immediately without waiting for an email response.
3. **The Customer Dashboard Support Hub (`/account/support`):** A direct AI troubleshooting assistant for logged-in customers to resolve activation errors, machine rotation questions, or usage issues on the spot.
4. **Smart Human Escalation & Triage:** When a user's question cannot be resolved by the AI (or requires account intervention like refunds, key adjustments, or custom agreements), the AI gracefully guides them to the correct channel:
   * **If Logged-in Customer:** Direct shortcut to submit an official Support Ticket in their dashboard or message on WhatsApp.
   * **If Guest / Public Visitor:** Direct shortcut to submit the Contact Form or message on WhatsApp (`+91-9893534314`).

---

## 2. User Experience & Architectural Design

### 2.1 Reusable `SupportChatBox` Component
Instead of writing separate chat components for each page, we create a unified, robust `<SupportChatBox />` component:
* **Embedded Mode:** Renders inline within the page layout (styled seamlessly with NORVI's dark obsidian glass design, `#1b201a` background, and lime accent borders).
* **Pre-loaded Quick Prompts:** Clickable suggestion chips for common questions:
  * *"How do I activate my license on a second computer?"*
  * *"Does the agent work completely offline?"*
  * *"How do I download the Windows / Mac installer?"*
  * *"What is the refund policy?"*
* **Real-time SSE Streaming:** Streams token-by-token responses from Gemini using the existing high-speed `/api/chat` streaming endpoint.
* **Smart Action Buttons in AI Responses:** When the AI suggests contacting a human or escalating, it renders interactive action buttons directly inside the chat message:
  * `[Chat on WhatsApp ↗]` (Opens WhatsApp with pre-filled inquiry text)
  * `[Open Support Ticket ↗]` (Scrolls to or focuses the ticket form on `/account/support`)
  * `[Send Contact Message ↗]` (Scrolls to or focuses the contact form on `/contact`)

---

### 2.2 Integration Across Key Pages

```
                       CUSTOMER NEEDS HELP
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
          Public /help   Public /contact   /account/support
         (Help Center)   (Inquiry Page)   (Customer Portal)
               │               │               │
               └───────────────┼───────────────┘
                               │
                               ▼
                   Interactive AI Support Box
                    (Instant First Response)
                               │
                 Can AI answer the question?
                               │
                ┌──────────────┴──────────────┐
               YES                            NO
                │                              │
         Instant Answer                Smart Escalation
      (Customer is satisfied,                  │
      zero manual workload)       ┌────────────┴────────────┐
                                  ▼                         ▼
                           Logged-in User            Public Guest
                                  │                         │
                        Pre-fill Support Ticket   Pre-fill Contact Form
                                  │                         │
                                  └────────────┬────────────┘
                                               ▼
                                      WhatsApp Option
                                     (+91-9893534314)
```

#### Page A: Public Help Center (`/help`)
* **Placement:** Positioned prominently right below the page heading and above the static FAQ list.
* **Heading:** *"Ask NORVI AI Assistant — Instant 24/7 Answers"*
* **Function:** Visitors can type any natural language question. The AI answers grounded in verified NORVI facts. If the query isn't answered, it offers the WhatsApp button or directs them to `/contact`.

#### Page B: Contact Us (`/contact`)
* **Placement:** Integrated alongside the contact form.
* **Layout:** A dual-action layout:
  * **Left Column:** Company contact details, WhatsApp quick-connect, and business address.
  * **Right Column:** Tabbed or stacked layout:
    * **Tab 1: "Instant AI Answer" (Recommended First Step):** Allows typing a question to get an immediate reply.
    * **Tab 2: "Send Us a Message" (Manual Form):** Traditional Name, Email, and Message form submitting to the database, Netlify, and Discord alerts.

#### Page C: Customer Dashboard Support Hub (`/account/support`)
* **Placement:** Integrated directly above the "Your requests" ticket history.
* **Function:** Helps paying customers troubleshoot runtime issues, license key binding, or device switches immediately.
* **Escalation:** If the issue requires manual resolution (e.g., custom billing inquiry), a *"Create Ticket with this Context"* button can pre-fill their support form so they don't have to retype their problem.

---

## 3. Knowledge Base Grounding & Escalation Rules

The AI system prompt and Knowledge Base articles (`ai_settings` and `kb_articles`) will be strictly configured to ensure 100% accurate, professional answers without hallucination.

### Key Knowledge Base Grounding Rules:
1. **1-Day (24-Hour) Offline Operation:**
   * Ground the AI that all agents operate locally on the customer's machine and can run offline for up to 24 hours before a background license validation is performed.
   * *Never* state 7 days.
2. **Device Allowance:**
   * Each license permits simultaneous activation on up to **3 personal machines**.
   * Customers can rotate or disconnect machines at any time in `/account/licenses` under "Keys & devices".
3. **Delivery & Fulfillment:**
   * Instant digital delivery upon Razorpay checkout. Keys are displayed on screen, saved to the dashboard, and sent via email.
4. **Local Privacy:**
   * Agents execute locally on Windows 10/11 and macOS with zero cloud telemetry or token surcharges.
5. **Refund Policy:**
   * Strict digital goods policy: All sales are final once digital license keys are generated and dispatched. For technical issues, support is provided within 7 days.
6. **Support Operating Hours:**
   * Engineering support is available Mon–Sat, 10:00 AM – 8:00 PM IST on WhatsApp (`+91-9893534314`) and email (`norviagency@gmail.com`).

### Escalation Trigger Criteria:
If the user's inquiry matches any of the following, the AI will explicitly state that human assistance is required and provide direct escalation links:
* Payment failures, duplicate charges, or invoice requests.
* Hardware unlinking issues where the customer cannot access their dashboard.
* Custom corporate/enterprise bulk licensing.
* Software bug reports or feature suggestions.
* Anything outside the verified documentation.

---

## 4. Phase 5 Implementation Breakdown

| Step | Scope | Description |
|---|---|---|
| **5.1** | Component Architecture | Build a clean, reusable `<SupportChatBox />` supporting streaming text, quick-prompt chips, and smart escalation CTA buttons. |
| **5.2** | `/help` Integration | Embed the AI Chatbot prominently into the Help Center with pre-filled common topic chips. |
| **5.3** | `/contact` Integration | Add the AI resolution assistant to the Contact page to filter out repetitive inquiries before submission. |
| **5.4** | `/account/support` Integration | Embed the AI troubleshooting assistant in the customer dashboard with 1-click ticket pre-filling. |
| **5.5** | KB & Prompt Sync | Verify and update the AI system prompt and knowledge base articles with 1-day offline rules, 3-device limits, and escalation rules. |
| **5.6** | Verification & Testing | Test streaming across all three pages, test fallback escalation, and run full test suite (`npm run check`, `npm test`, `npm run build`). |

---

## 5. Verification Checklist

- [x] Zero code changes executed during planning phase.
- [x] Reusable `<SupportChatBox />` built with real-time SSE streaming, prompt chips, and quick action triage buttons.
- [x] Embedded into `/help` (Help Center) above search and FAQs.
- [x] Embedded into `/contact` (Contact Us) alongside contact form with scroll-to-form escalation.
- [x] Embedded into `/account/support` (Customer Portal) with 1-click ticket escalation.
- [x] Global floating widget (`App.tsx`) upgraded with triage buttons.
- [x] No existing contact form or support ticket submission functionality broken or removed.
- [x] Preserves all Discord webhook alerts (`#norvi-contact` and `#norvi-support`) and Netlify form handlers.
- [x] Strictly enforces 1-day offline validity in all AI prompts and knowledge articles.
- [x] Clear distinction between logged-in customer escalation and guest visitor escalation.
- [x] Complete Knowledge Base Training Pack prepared and documented (`ai-agent-knowledge-base-training-pack.md`).
- [x] Full automated verification passed (`npm run check`, `npm test` 232/232 passed, `npm run build` 45 pages).
