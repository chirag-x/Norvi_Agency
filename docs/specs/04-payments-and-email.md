# Payments, Subscriptions, and Transactional Email

## Payment provider proposal

Use Razorpay hosted Checkout as the initial integration, assuming an India-based eligible merchant. Request UPI, debit/credit cards, and international card acceptance. Available currencies and methods depend on the approved account and customer/payment context. International payments are a separate eligibility/onboarding concern, not a guaranteed switch enabled by our code. [Razorpay international payments](https://razorpay.com/docs/payments/international-payments/).

Use provider-hosted payment fields. Our app never asks for or stores card numbers, CVV, UPI PINs, or bank credentials. The checkout page displays only methods actually enabled for the merchant.

One-time UPI and recurring UPI mandates are different capabilities. Validate the exact recurring methods, international subscription support, customer cancellation behavior, and business eligibility with the provider before advertising automatic renewals. If unavailable, launch clearly labeled fixed-term purchases with manual renewal. Do not silently imply that they auto-renew.

## Reliable payment-to-license workflow

1. Require a verified account and completed minimal profile before purchase.
2. Backend loads an active price by ID and computes the amount/currency. Save a local pending order linked to the customer; use an idempotency key for retries.
3. Create the Razorpay order/agreement server-side and store the provider reference. If a timeout leaves the outcome unknown, reconcile before creating another chargeable object.
4. Open hosted Checkout with the provider reference and public key. Browser success is a display signal only.
5. Receive provider webhook over HTTPS. Verify the signature over the exact raw body with the webhook secret before trusting it.
6. Persist event identity durably and deduplicate it. Acknowledge only after persistence; retry failed processing asynchronously.
7. Confirm the relevant payment is captured/paid using verified event data and, when needed, a provider lookup. Check amount, currency, merchant/environment, order mapping, customer ownership, and product snapshot. Authorization alone does not unlock access.
8. A database transaction updates the order, records payment, creates or extends exactly one entitlement, and inserts an email outbox job. Constraints and locking prevent double fulfillment across duplicate or distinct events for the same payment.
9. The order-status page polls its own backend record with backoff until fulfilled, pending, or failed. An email delay does not block dashboard access.
10. A reconciliation job checks unresolved payments and cancellations against the provider; display mismatches for the owner.

Provider webhooks can be duplicated and delivered out of order. Event IDs help deduplication, but business-level constraints are also necessary. [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/).

## Lifecycle handling

| Event | Application behavior |
|---|---|
| Customer abandons checkout | Leave unpaid; expire pending order after a defined period; no license |
| Payment fails | Show retry; preserve reference; no entitlement |
| Payment succeeds after browser closes | Webhook fulfills and email is sent; dashboard shows purchase later |
| Duplicate capture webhook | Return prior processing result; no extra key or email job |
| Older pending event arrives after success | Do not downgrade a confirmed payment |
| Refund arrives before capture processing | Reconcile current provider state before granting access |
| Recurring payment succeeds | Extend existing paid-through period using provider period data |
| Recurring payment fails | Notify; apply published expiry/grace policy; do not extend unpaid time |
| Cancel at period end | Confirm provider cancellation; retain access until paid-through |
| Owner revokes and cancels now | Revoke locally; record provider cancellation request; show pending/failed until confirmed |
| Full refund or chargeback | Apply disclosed access policy, record reason, and reconcile provider state |

Default proposal: no unpaid renewal grace period. If a grace period is later offered, it must be explicit and separate from offline lease duration. Refund and suspension policies need business review before launch.

## Email behavior requested

Send the first purchase email to the customer's verified account address, not an arbitrary email submitted in checkout. Include:

- A thank-you message and your business/support identity.
- Product name, order reference, amount, currency, and purchase date.
- The customer's login email and the website login link.
- Their product-specific activation key, with a warning to keep it private.
- Dashboard/download link, installation steps, device limit, and access duration.
- Receipt access and support contact.

Never email their password. The emailed key is our product license credential, not your AI-provider API key. Each later purchase gets its own product key email. Renewals send confirmation using a masked key; do not repeatedly email full secrets.

Sample structure, with placeholders only:

> Thank you for purchasing {Agent Name}.
>
> Account: {verified email}. Sign in: {website login URL}.
>
> Activation key: {this purchase's key}.
>
> Download from your account, open the agent, and enter this key. Access: {term}; devices: {limit}.
>
> Order: {reference}. Need help? {support address}.

Sending the full key meets your request but leaves a copy in the customer's mailbox and the delivery infrastructure. A more protective future option is a sign-in link with a masked key. Key rotation invalidates old email copies.

## Email implementation

Use Resend API for purchase/license notices and custom SMTP for Supabase authentication messages. Supabase's built-in mail service is intended for limited testing; real customers require custom SMTP. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

Verify a domain you control and configure sender authentication, including SPF/DKIM and an appropriate DMARC policy. Use separate authentication, transactional, and optional marketing templates; purchase does not automatically subscribe someone to marketing.

Persist jobs by record ID, not by plaintext key. Decrypt the key only when rendering the first purchase message. Use a deterministic send idempotency key where the provider supports it; reconciliation handles uncertain sends. Do not promise exactly-once email delivery across every network failure. Record accepted/delivered/bounced states where available, retry transient failures, and expose exhausted retries to the owner.

Budget auth and transactional emails together if they share one provider account. Disable tracking that can rewrite authentication links. Verify email-provider webhook signatures as well.
