# Phase 3 - Complete Commerce

**Status:** Pending

## Plan:
- Create real price records in the database.
- Load the amount and currency server-side.
- Create a pending database order before calling Razorpay.
- Verify checkout signatures server-side.
- Implement signed Razorpay webhooks.
- Store and deduplicate webhook events.
- Fulfill licenses only after a verified paid event.
- Handle failed, pending, refunded, and disputed payments.
- Add receipts, invoices, taxes, refund workflows, and reconciliation.
- Define whether products are one-time purchases, subscriptions, or both.
