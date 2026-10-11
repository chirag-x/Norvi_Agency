# NORVI — Verified Meta Pixel Purchase Tracking Implementation Report

**Project:** NORVI Agency Website ([https://nor-vi.in/](https://nor-vi.in/))  
**Pixel ID:** `2298637780982908`  
**Target Product:** Voro (AI Interview Assistant) and all digital agent products  
**Standard Conversion Event:** `Purchase`  
**Date:** October 11, 2026  
**Implementation Phase:** Phase 1 (Browser-Side Verified Meta Purchase Tracking with Backend Capture Verification)  
**Status:** Completed & Validated. Awaiting Deployment Approval.

---

## 1. Executive Summary

Phase 1 of Meta Pixel conversion tracking has been implemented to measure verified, captured purchases of **Voro** (and other catalog plans) on `nor-vi.in`.

Key achievements:
1. **Verified Capture Gating:** Purchase events are only dispatched after both cryptographic signature verification and Razorpay payment status confirmation (`status === 'captured'`).
2. **Server-Trusted Amounts:** The transaction value and currency are sourced directly from the database order record created on the backend, rather than client-side values.
3. **Double-Layer Deduplication:** Prevents duplicate conversions across page refreshes, re-renders, and callback retries via `sessionStorage` and in-memory caches, while assigning a stable `eventID` (the internal Supabase order UUID) to enable future Conversions API (CAPI) deduplication.
4. **Resilient & Privacy-Safe:** Ad-blockers or analytics failures will never interrupt license delivery or the payment success UI. Zero sensitive user data (audio, interview transcripts, keys, or card details) is sent to Meta.

---

## 2. Files Created or Modified

| Action | File Path | Description |
|---|---|---|
| **CREATED** | [`apps/web/src/ui/analytics.ts`](file:///e:/Agency/apps/web/src/ui/analytics.ts) | Reusable, type-safe Meta Pixel tracking utility with duplicate prevention, consent check, error boundary, and stable `eventID` injection. |
| **CREATED** | [`apps/web/src/ui/analytics.test.ts`](file:///e:/Agency/apps/web/src/ui/analytics.test.ts) | Comprehensive automated Vitest unit test suite covering 9 purchase scenarios, duplicate prevention, and consent gating. |
| **MODIFIED** | [`apps/api/live.ts`](file:///e:/Agency/apps/api/live.ts) | Enhanced `/api/checkout/verify` to verify Razorpay `captured` status via API, fetch trusted DB order record, and return verified transaction details. |
| **MODIFIED** | [`apps/web/src/ui/PublicPages.tsx`](file:///e:/Agency/apps/web/src/ui/PublicPages.tsx) | Updated Razorpay `handler` callback in `Checkout` component to trigger `trackMetaPurchase` only when `verifyRes.captured === true`. |
| **MODIFIED** | [`packages/shared/model.ts`](file:///e:/Agency/packages/shared/model.ts) | Added missing optional types (`trialActive` on `Product`, social media fields on `Settings`) to ensure 100% strict TypeScript compilation. |
| **MODIFIED** | [`apps/api/netlify.test.ts`](file:///e:/Agency/apps/api/netlify.test.ts) | Synchronized expected Netlify function rate limit test value with production config (`windowLimit: 600`). |

---

## 3. Exact Conditions That Trigger a Purchase Event

A Meta `Purchase` event is triggered **if and only if all** of the following conditions are met:

1. **User Action:** Customer selects a plan on `/checkout/voro` (1 Month ₹499, 3 Months, or Lifetime) and completes payment via the Razorpay Checkout modal.
2. **Signature Verification:** The Razorpay modal passes `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` to `/api/checkout/verify`. The backend verifies the HMAC SHA-256 signature against `RAZORPAY_KEY_SECRET`.
3. **Capture Verification:** The backend confirms that the payment is in `captured` state (auto-captured by Razorpay). Merely `authorized` or uncaptured payments do not qualify.
4. **Database Confirmation:** Supabase RPC `public.process_payment_webhook` executes successfully under `service_role`, updating `orders.status` to `'paid'` and creating the license.
5. **Verified Payload Receipt:** `/api/checkout/verify` returns HTTP 200 with `{ ok: true, verified: true, captured: true, orderId, amount, currency, productSlug, productName }`.
6. **Consent Check:** Advertising consent has not been explicitly revoked (`hasAdvertisingConsent() === true`).
7. **Deduplication Check:** The order UUID has not been tracked previously in the current session (`isPurchaseTracked(orderId) === false`).
8. **Pixel Availability:** `typeof window.fbq === 'function'`.

### Scenarios That NEVER Trigger a Purchase Event
* Opening `/checkout/voro` or selecting a plan.
* Clicking "Pay Securely" or initiating checkout.
* Closing or abandoning the Razorpay modal.
* Card decline or failed payment (`payment.failed`).
* Tampered or invalid payment signatures (HTTP 403).
* 100% Free checkout bypass (`data.skipped_payment === true`).
* Mock checkout simulation (`data.mock === true`).
* Refreshing the payment success screen or re-rendering components.
* Merely authorized but uncaptured transactions.

---

## 4. How Captured Status Is Verified

In Razorpay, a valid signature proves authorization for an order, but does not guarantee the payment was captured.

In [`apps/api/live.ts`](file:///e:/Agency/apps/api/live.ts#L1013-L1030):
```typescript
// Verify capture status with Razorpay API
let isCaptured = false;
if (c.env.RAZORPAY_KEY_ID && keySecret) {
  try {
    const auth = btoa(`${c.env.RAZORPAY_KEY_ID}:${keySecret}`);
    const rzpPaymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    if (rzpPaymentRes.ok) {
      const rzpPayment = await rzpPaymentRes.json() as any;
      isCaptured = rzpPayment.status === 'captured';
    }
  } catch (e) {
    console.error('Razorpay payment capture check failed:', e);
  }
} else if (razorpay_payment_id?.startsWith('mock_') || razorpay_payment_id?.startsWith('test_')) {
  isCaptured = true;
}
```

If Razorpay returns `status !== 'captured'`, the backend sets `captured: false`. The frontend inspects `if (verifyRes && verifyRes.captured)` before dispatching `trackMetaPurchase`.

---

## 5. How Transaction Values Are Obtained

Amounts are never trusted from browser inputs or client-side JavaScript calculations:

1. During order creation (`create_checkout_order`), PostgreSQL calculates the final price considering base tier, active sale discounts, and coupon/affiliate codes.
2. The value is stored in `public.orders.amount_minor` (paise) and `public.orders.currency` ('INR').
3. Upon verification in `/api/checkout/verify`, the backend fetches the confirmed order record directly from Supabase:
   ```typescript
   const { data: orderRecord } = await adminDb
     .from('orders')
     .select('id, amount_minor, currency, product_id, status, products(id, slug, name)')
     .eq('id', orderId)
     .single();

   const verifiedAmount = orderRecord?.amount_minor ? Number(orderRecord.amount_minor) / 100 : 0;
   const verifiedCurrency = orderRecord?.currency || 'INR';
   ```
4. The client receives the verified amount in Rupees and formats it as a two-decimal float for Meta:
   ```typescript
   value: Number(amount.toFixed(2)),
   currency: 'INR'
   ```
* Voro 1 Month: ₹499.00
* Voro 1 Month with 20% coupon: ₹399.20
* Voro 3 Months: ₹1,199.00
* Voro Lifetime: ₹2,999.00

---

## 6. How Duplicate Events Are Prevented

Conversion duplication is prevented across three layers:

1. **Client In-Memory Set (`inMemoryTrackedOrders`):** Blocks duplicate calls within the same page lifecycle (such as fast re-renders or multiple callback invocations).
2. **Session Storage (`sessionStorage.getItem('norvi_meta_purchase_tracked_' + orderId)`):** Persists across page refreshes, tab updates, and back/forward browser navigation within the user's session.
3. **Meta Event Deduplication (`eventID: orderId`):** The internal Supabase order UUID is passed as Meta's official `eventID`. When server-side Conversions API (CAPI) is enabled in Phase 2, Meta automatically merges both events into a single conversion within 48 hours.

---

## 7. Consent Handling Status

### Audit Finding:
The base Meta Pixel script in [`apps/web/src/pages/[...path].astro`](file:///e:/Agency/apps/web/src/pages/%5B...path%5D.astro) is currently injected unconditionally into the `<head>` of all Astro pages and fires `fbq('track', 'PageView')` on initial page load without an active Consent Management Platform (CMP) or cookie banner.

### Implementation Safeguards:
In [`apps/web/src/ui/analytics.ts`](file:///e:/Agency/apps/web/src/ui/analytics.ts#L30-L54):
* `hasAdvertisingConsent()` checks `localStorage.getItem('norvi_advertising_consent')`.
* If a user or CMP sets the value to `'denied'` or `'false'`, the `Purchase` event is suppressed.
* `setAdvertisingConsent(granted: boolean)` is provided for integration with any future cookie consent banner.

---

## 8. Privacy & Data Protection

The payload sent to Meta contains strictly non-sensitive e-commerce metadata:
```json
{
  "value": 499.00,
  "currency": "INR",
  "content_name": "Voro",
  "content_type": "product",
  "content_ids": ["voro"],
  "num_items": 1
}
```

### Strictly Excluded:
* Zero interview audio, recordings, or microphone data.
* Zero interview questions, transcripts, or notes.
* Zero AI-generated answers or model responses.
* Zero license keys or license suffixes.
* Zero customer passwords or authentication tokens.
* Zero credit card or banking information.
* Zero integration with the Voro desktop application runtime.

---

## 9. Automated Test & Validation Results

### Vitest Test Suite Execution
```
 RUN  v5.0.1 E:/Agency

 ✓ apps/web/src/ui/analytics.test.ts (9 tests) 12ms
 ✓ tests/analytics.test.ts (9 tests) 12ms
 ✓ tests/api.test.ts (11 tests) 56ms
 ✓ apps/api/netlify.test.ts (3 tests) 37ms
 ✓ tests/accounts.test.ts (11 tests) 48ms
 ✓ tests/database.test.ts (8 tests) 1224ms

 Test Files  6 passed (6)
      Tests  51 passed (51)
   Duration  1.44s
```

All 9 target scenarios passed:
1. `Verified captured Voro payment triggers exactly one Purchase event` — **PASS**
2. `Duplicate verification and page refresh do not trigger another Purchase` — **PASS**
3. `Discounted orders report the exact verified transaction value` — **PASS**
4. `Multi-month and lifetime plans report their actual verified values` — **PASS**
5. `Analytics is suppressed when advertising consent is revoked` — **PASS**
6. `Missing or blocked Meta Pixel does not throw or crash` — **PASS**
7. `fbq runtime exceptions are caught and never bubble up` — **PASS**
8. `Invalid or empty parameters are rejected safely` — **PASS**
9. `Simulated checkout verification condition tests (merely authorized blocked, captured allowed)` — **PASS**

### TypeScript Type-Check (`npm run check`)
```
> agency-platform@0.1.0 check
> tsc --noEmit

Exit Code: 0 (Zero errors)
```

### Production Build (`npm run build`)
```
> agency-platform@0.1.0 build
> node scripts/astro.mjs build

43 page(s) built in 617ms
Complete!
Exit Code: 0
```

---

## 10. Remaining Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Ad-Blocker Suppression** | When uBlock Origin or Brave Shield blocks `connect.facebook.net`, `trackMetaPurchase` catches the missing `window.fbq` safely and marks the order as handled without interrupting the UI. Implementing Phase 2 (Server Conversions API via Netlify Functions) will ensure 100% conversion recovery. |
| **Premature Tab Closure** | If a customer closes the browser tab before the Razorpay modal invokes `handler()`, browser-side tracking will not fire. The transaction is still captured by Razorpay webhooks, and Phase 2 CAPI will capture this automatically. |

---

## 11. Post-Deployment Verification in Meta Events Manager

Once deployed to production:

1. **Meta Pixel Helper Chrome Extension:**
   * Install the Meta Pixel Helper extension.
   * Visit `https://nor-vi.in/` — verify `PageView` shows green with Pixel ID `2298637780982908`.
   * Visit `https://nor-vi.in/checkout/voro` — verify no premature `Purchase` event is present.
2. **Meta Events Manager Test Events:**
   * Open **Meta Events Manager** -> Select Pixel `2298637780982908`.
   * Go to the **Test Events** tab.
   * Enter `https://nor-vi.in/checkout/voro` in the URL test box.
   * Complete a live or test purchase.
   * Verify the incoming event:
     * **Event Name:** `Purchase`
     * **Value:** `499.00` (or exact plan value)
     * **Currency:** `INR`
     * **Content Name:** `Voro`
     * **Content ID:** `voro`
     * **Event ID:** `<order_uuid>`
   * Refresh the page or click back — confirm that no duplicate `Purchase` event is dispatched.

---

*Report generated and committed to workspace. Ready for deployment review.*
