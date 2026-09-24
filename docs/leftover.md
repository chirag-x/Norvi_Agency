# NORVI - Leftover Launch Checklist

This document tracks the final steps required to launch the project to the public. 

---

## ~~1. Buy Your Domain Name~~ (COMPLETED)
* The official domain `nor-vi.in` has been purchased and configured.

## ~~2. Host the Website 24/7 for Free (Netlify)~~ (COMPLETED)
* The codebase is successfully hosted globally on Netlify at `https://nor-vi.in`.
* The serverless backend (`live.ts`) is active and environment variables are connected.

## ~~3. Verify Emails (Resend)~~ (COMPLETED)
* The custom domain is verified in Resend. The platform is now capable of sending transactional emails (welcome emails, receipts, invites) to any customer in the world.

---

## 4. Unlock Razorpay Live API Keys (PENDING)
*(To be completed when the full website is finalized)*
Currently, we only have Razorpay "Test Keys".
1. Go to your Razorpay Dashboard.
2. Submit your live website URL (`https://nor-vi.in`) for business verification.
3. Make sure you have created standard legal pages (Terms of Service, Privacy Policy, Refund Policy) on your website, as Razorpay manually checks for these before approving you.
4. Once approved, generate your **Live API Key** and **Live Key Secret**.
5. Put these new live keys into your Netlify Environment Variables.

## 5. The Final Code: The Razorpay Webhook (Phase 3 Part 3) (PENDING)
Once you have your Razorpay Live Keys, you will bring the project back to the AI.
1. Tell the AI: *"I have my Razorpay Live Keys. Let's build the final Phase 3 Part 3 Razorpay Webhook."*
2. The AI will write the final script that listens for real money payments and automatically inserts the License Keys into your Supabase database.

---
**Status:** Domains, hosting, and emails are 100% complete! The platform is live at `https://nor-vi.in`. Waiting to finalize the website content before submitting for Razorpay Live API keys.
