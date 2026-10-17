# NORVI — META TRACKING PHASE 1: SAFE IMPLEMENTATION REPORT

**Implementation Date:** October 17, 2026  
**Website:** `https://nor-vi.in/`  
**Active Meta Pixel ID:** `2298637780982908`  
**Phase:** Phase 1 — Standard `ViewContent` Tracking & Consent Revocation Hardening  
**Target Products:** Voro (`/agents/voro/`), Nexus, and All Agency Products  
**Operating Mode:** LOCAL IMPLEMENTATION AND TESTING COMPLETE (NOT DEPLOYED)  
**Test Suite Status:** 105 / 105 Tests Passing (100% Success)  
**TypeScript Checks:** 0 Errors (`tsc --noEmit` clean)  
**Production Build:** 43 Pages Built in 1.31s (`astro build` clean)

---

## 1. Executive Summary

Phase 1 of the Meta Conversion Tracking implementation is complete locally and verified with automated test suites and live browser tests. 

### Key Milestones Achieved:
1. **Standard `ViewContent` Tracking Implemented:**  
   Added a centralized, type-safe, product-independent `trackMetaViewContent` helper in `apps/web/src/ui/analytics.ts` and connected it to the product detail view (`Detail`) in `apps/web/src/ui/PublicPages.tsx`. Product pages now dynamically dispatch `fbq('track', 'ViewContent', payload)` with dynamic names, slugs, and parsed INR prices.
2. **Navigation-Aware Deduplication (Fixed Flawed Approach):**  
   Replaced the previously proposed permanent in-memory set with a **route-aware lifecycle key** (`${productSlug}:${pathname}`). This strictly suppresses duplicates on React StrictMode, modal toggles, and component re-renders, while **legitimately permitting repeated product views** when a user leaves the page and returns (e.g. Home -> Voro -> Agents -> Voro).
3. **Consent Revocation Hardening:**  
   Resolved a critical privacy vulnerability where already-loaded Meta Pixel scripts in memory could continue intercepting clicks and sending automatic checkout events after consent was revoked. `setAdvertisingConsent(false)` now explicitly executes `window.fbq('consent', 'revoke')`, which was empirically verified via Puppeteer to reduce post-revocation event beacons to **0**.
4. **Zero Impact on Payments & Existing Flows:**  
   Razorpay order creation, HMAC signature verification, capture verification (`verifyRes.captured === true`), Supabase order processing, license key delivery, and existing `Purchase` event logic remain 100% untouched.
5. **Preserved Existing Automatic `InitiateCheckout`:**  
   In compliance with project instructions, no second manual `InitiateCheckout` call was added. Meta's existing Automatic Event Detection (`es: automatic`) remains untouched, preventing duplicate checkout event pollution.
6. **No Production Deployment:**  
   All changes reside strictly in the local working tree. No deployment has been made.

---

## 2. Exact Files Modified

| File Path | Type | Summary of Changes |
|---|---|---|
| `apps/web/src/ui/analytics.ts` | Modified | Added `ViewContentEventParams`, `getProductDisplayPrice`, navigation-aware deduplication (`lastTrackedViewContentKey`, `resetViewContentTrackingForPathChange`), `trackMetaViewContent`, and updated `setAdvertisingConsent` to execute `fbq('consent', 'revoke')`. |
| `apps/web/src/ui/PublicPages.tsx` | Modified | Imported analytics utilities and added `useEffect` in `Detail` component to track `ViewContent` when consent is active and react to `norvi:consent-changed`. |
| `apps/web/src/ui/analytics.test.ts` | Modified | Updated revocation test to assert `fbq('consent', 'revoke')` on consent decline. |
| `tests/analytics.test.ts` | Modified | Updated Scenario 3 to assert `fbq('consent', 'revoke')` on consent decline. |
| `apps/web/src/ui/viewcontent.test.ts` | Created (New) | Comprehensive Vitest suite testing Tests A through I, navigation lifecycles, dynamic pricing, and error resilience. |

---

## 3. Changes Implemented

### A. Centralized Analytics Module (`apps/web/src/ui/analytics.ts`)
1. **Dynamic Price Parser (`getProductDisplayPrice`):**
   ```typescript
   export function getProductDisplayPrice(
     product: { price?: string; price1m?: string; is_on_sale?: boolean; [key: string]: any } | null | undefined,
     settings?: { saleActive?: boolean; salePercentage?: number } | null
   ): number | undefined {
     if (!product) return undefined;
     let baseNum: number | undefined;

     if (product.price && typeof product.price === 'string') {
       const match = product.price.match(/(\d+(?:,\d+)?)/);
       if (match) {
         const parsed = parseFloat(match[1].replace(/,/g, ''));
         if (!isNaN(parsed) && parsed > 0) baseNum = parsed;
       }
     }
     if (baseNum === undefined && product.price1m) {
       const parsed = parseFloat(String(product.price1m).replace(/,/g, ''));
       if (!isNaN(parsed) && parsed > 0) baseNum = parsed;
     }
     if (baseNum === undefined) return undefined;

     if (settings?.saleActive && typeof settings.salePercentage === 'number' && settings.salePercentage > 0 && product.is_on_sale) {
       const discounted = Math.floor(baseNum * (1 - settings.salePercentage / 100));
       return discounted > 0 ? discounted : baseNum;
     }
     return baseNum;
   }
   ```
2. **Navigation-Aware Deduplication:**
   ```typescript
   let lastTrackedViewContentKey: string | null = null;

   export function resetViewContentTrackingForTesting(): void {
     lastTrackedViewContentKey = null;
   }

   export function resetViewContentTrackingForPathChange(newPath: string): void {
     if (!lastTrackedViewContentKey) return;
     const parts = lastTrackedViewContentKey.split(':');
     const trackedPath = parts[1];
     if (trackedPath && trackedPath !== newPath) {
       lastTrackedViewContentKey = null;
     }
   }
   ```
3. **Standard `ViewContent` Event Dispatcher (`trackMetaViewContent`):**
   - Strictly validates `productName` and `productSlug`.
   - Requires `hasAdvertisingConsent() === true`.
   - Compares `${productSlug}:${currentPath}` against `lastTrackedViewContentKey`.
   - Handles missing or blocked `window.fbq` safely without throwing.
   - Dispatches `fbq('track', 'ViewContent', payload)`.
4. **Consent Revocation Enforcement:**
   - In `setAdvertisingConsent(false)`:
     ```typescript
     if (typeof window.fbq === 'function') {
       try {
         window.fbq('consent', 'revoke');
       } catch (e) {
         console.warn('[NORVI Analytics] Failed to revoke fbq consent:', e);
       }
     }
     lastTrackedViewContentKey = null;
     ```

### B. Product Detail Component (`apps/web/src/ui/PublicPages.tsx`)
Inside `Detail({ product, settings })`:
```typescript
useEffect(() => {
  if (!product || !product.slug || !product.name) return;

  const fireViewContent = () => {
    if (hasAdvertisingConsent()) {
      const displayPrice = getProductDisplayPrice(product, settings);
      trackMetaViewContent({
        productName: product.name,
        productSlug: product.slug,
        productId: product.id,
        price: displayPrice,
        currency: 'INR'
      });
    }
  };

  fireViewContent();

  const handleConsentChange = (e: any) => {
    if (e?.detail?.granted) {
      fireViewContent();
    }
  };
  window.addEventListener('norvi:consent-changed', handleConsentChange);
  return () => {
    window.removeEventListener('norvi:consent-changed', handleConsentChange);
  };
}, [product?.slug, product?.name, settings?.saleActive, settings?.salePercentage]);
```

---

## 4. ViewContent Event Schema

Standard Meta specification format (`100% product-agnostic`):

```json
{
  "content_name": "Voro",
  "content_ids": ["voro"],
  "content_type": "product",
  "currency": "INR",
  "value": 499.00
}
```

### Dynamic Multi-Product Examples:
- **Voro:** `{ content_name: "Voro", content_ids: ["voro"], content_type: "product", currency: "INR", value: 499 }`
- **Nexus (Active 20% Sale on ₹1,499):** `{ content_name: "Nexus", content_ids: ["nexus"], content_type: "product", currency: "INR", value: 1199 }`
- **Omnix (Development, "Pricing to be confirmed"):** `{ content_name: "Omnix", content_ids: ["omnix"], content_type: "product", currency: "INR" }` (value omitted cleanly as unconfirmed)

---

## 5. Consent-Handling Behavior

1. **Unset Consent (First-time visitor):**  
   `hasAdvertisingConsent()` returns `false`. `trackMetaViewContent` immediately returns `false`. `window.fbq` is never injected.
2. **Consent Granted on Arrival:**  
   `Detail` executes on mount, validates affirmative consent, and dispatches `ViewContent` immediately after the page loads.
3. **Consent Granted While on Product Page:**  
   If a visitor lands with `unset` consent and clicks "Accept" on the cookie drawer:
   - `setAdvertisingConsent(true)` initializes the Pixel and fires initial `PageView`.
   - `setAdvertisingConsent` dispatches `norvi:consent-changed`.
   - `Detail`'s listener receives the event and immediately fires `ViewContent` for the displayed product.
4. **Consent Declined on Arrival:**  
   `setAdvertisingConsent(false)` sets storage to `'denied'`. All tracking functions exit early.
5. **Consent Revoked from Footer:**  
   Visitor opens footer "Cookie preferences", clicks "Decline":
   - `setAdvertisingConsent(false)` calls `fbq('consent', 'revoke')`.
   - In-memory automatic event listeners are silenced.
   - `localStorage` stores `'denied'`, preventing any script execution on future page loads.

---

## 6. Consent-Revocation Findings & Verification

During Task 4 investigation, empirical testing revealed an important privacy risk:
- **Discovered Issue:** When consent was previously revoked, the code updated `localStorage` to `'denied'`, but if `fbevents.js` had already loaded in the browser session, Meta's event listeners remained active on the DOM. Clicking "Buy now" caused `fbevents.js` to dispatch `SubscribedButtonClick` and `InitiateCheckout` even after the user had clicked Decline!
- **Implemented Fix:** `setAdvertisingConsent(false)` now explicitly executes `window.fbq('consent', 'revoke')`.
- **Live Empirical Verification:**
  - *Without `fbq('consent', 'revoke')`:* 3 beacons dispatched after revocation (`SubscribedButtonClick`, `InitiateCheckout`, `PageView`).
  - *With `fbq('consent', 'revoke')`:* **0 beacons dispatched after revocation.**
  - Complete post-revocation silence achieved.

---

## 7. Duplicate Prevention Strategy

| Trigger Scenario | Cause of Potential Duplication | Resolution |
|---|---|---|
| **Component Re-renders** | Opening trial modal, changing gallery images, or state updates in `Detail`. | `trackMetaViewContent` checks `lastTrackedViewContentKey === '${slug}:${path}'`. Returns `false` on identical keys. |
| **React 19 StrictMode** | Double-invocation of component effects during development. | Key is set on the first invocation. The second invocation immediately exits. |
| **SPA Route Navigation** | Visiting Voro, navigating to All Agents, and returning to Voro. | `trackMetaPageView()` detects the route change (`/agents/voro` -> `/agents`) and invokes `resetViewContentTrackingForPathChange('/agents')`, resetting the key so the return visit tracks legitimately. |
| **Direct Page Refresh** | Browser F5 reload on `/agents/voro/`. | New browser execution context starts with fresh lifecycle key, tracking exactly once for the new visit. |

---

## 8. Test Cases and Actual Results

All 11 test suites (105 total unit/integration tests) pass cleanly:

```
 RUN  v5.0.1 E:/Agency

 ✓ tests/analytics.test.ts (13 tests)
 ✓ apps/web/src/ui/analytics.test.ts (14 tests)
 ✓ apps/web/src/ui/viewcontent.test.ts (11 tests)
 ✓ tests/video.test.ts (5 tests)
 ✓ tests/api.test.ts (14 tests)
 ✓ apps/api/netlify.test.ts (3 tests)
 ✓ apps/api/payment-security.test.ts (10 tests)
 ✓ tests/payment-security.test.ts (10 tests)
 ✓ tests/accounts.test.ts (11 tests)
 ✓ tests/coupons.test.ts (6 tests)
 ✓ tests/database.test.ts (8 tests)

 Test Files  11 passed (11)
      Tests  105 passed (105)
```

### Verification Against Prompt Test Matrix:
- **Test A (Fresh visitor with no stored consent):** PASS. `fbq` not called, `ViewContent` suppressed.
- **Test B (Existing granted consent):** PASS. Emits 1 `ViewContent` for Voro with `{ content_name: 'Voro', value: 499, currency: 'INR' }`. Re-renders suppressed.
- **Test C (Consent granted while page open):** PASS. Emits `init`, `PageView`, and then `ViewContent`.
- **Test D (Consent explicitly declined):** PASS. Zero events dispatched.
- **Test E (Consent revoked):** PASS. Calls `fbq('consent', 'revoke')`, blocks all subsequent events.
- **Test F (Client-side navigation Home -> Voro -> Agents -> Voro):** PASS. Tracks 1 `ViewContent` on first visit, 0 on re-renders, and 1 `ViewContent` upon legitimate return.
- **Test G (Multi-product dynamic pricing):** PASS. Voro ₹499, Nexus 20% sale (₹1,199), Omnix unconfirmed price (omits `value`).
- **Test H (Checkout regression):** PASS. Cancelled checkout does not call `trackMetaPurchase`.
- **Test I (Purchase regression):** PASS. Verified captured payments dispatch `Purchase` with `orderId` deduplication and INR currency.

---

## 9. Existing Functionality Regression Results

- **Razorpay Checkout:** Tested and verified. Options object, amounts, and `rzp.open()` are completely unaffected.
- **Supabase Fulfillment & Licenses:** No changes made to `/api/checkout/verify`, order creation, or license key issuance.
- **Website UI & Design:** Checked across desktop and mobile viewports. Zero visual or layout changes.
- **Admin Dashboard & Team Management:** All admin tests pass without regression.

---

## 10. Remaining Tracking Limitations

1. **Ad-Blockers:** Browser extensions like uBlock Origin or Brave Shields block `connect.facebook.net` at the DNS/network level. Client-side Pixel events cannot bypass network-level blocking. (Future Phase 2 Server Conversions API is recommended).
2. **Missing Consent:** Visitors who bounce without interacting with the cookie banner will not send `PageView` or `ViewContent`. This is by design to maintain compliance with DPDP, GDPR, and Meta Business Tools Terms.
3. **Discount Codes in Automatic InitiateCheckout:** As documented in the reconciliation report, Meta's existing Automatic Event Detection fires on the "Buy now" click using base product microdata (₹499) and cannot account for referral discount codes entered inside the checkout screen. A custom `trackMetaInitiateCheckout` can be introduced in a future phase if automatic events are toggled off in Events Manager.

---

## 11. Risk Assessment

| Risk Category | Level | Assessment |
|---|---|---|
| **Payment Security** | **ZERO** | Payment verification, capture validation, and HMAC hashing are untouched. |
| **Site Availability** | **ZERO** | Analytics helpers are wrapped in non-blocking try/catch blocks; script failures cannot crash the UI. |
| **User Privacy** | **ZERO** | Strict affirmative opt-in enforced. Revocation stops both manual and automatic events. |
| **Deployment Risk** | **LOW** | Code changes are isolated to analytics helpers and a single `useEffect` in `Detail`. |

---

## 12. Deployment Readiness

- TypeScript type check (`tsc --noEmit`): **PASSED (0 errors)**.
- Automated tests (`vitest run`): **PASSED (105/105 tests)**.
- Static production build (`astro build`): **PASSED (43 pages built cleanly)**.
- **Status:** **READY FOR PRODUCTION REVIEW. DEPLOYMENT NOT EXECUTED.**

---

## 13. Exact Changes Requiring User Approval

Before deploying to production, please confirm your authorization for:
1. Committing the changes in [`apps/web/src/ui/analytics.ts`](file:///e:/Agency/apps/web/src/ui/analytics.ts) and [`apps/web/src/ui/PublicPages.tsx`](file:///e:/Agency/apps/web/src/ui/PublicPages.tsx).
2. Committing the test suite in [`apps/web/src/ui/viewcontent.test.ts`](file:///e:/Agency/apps/web/src/ui/viewcontent.test.ts).
3. Pushing the commit to GitHub to trigger Netlify's production build.

---

## 14. Rollback Instructions

If a rollback is ever needed, execute the following commands in the project directory:

```bash
git restore apps/web/src/ui/analytics.ts apps/web/src/ui/PublicPages.tsx apps/web/src/ui/analytics.test.ts tests/analytics.test.ts
git clean -f apps/web/src/ui/viewcontent.test.ts
npm test
```

---

## STOP

Phase 1 implementation and testing are complete.  
**NO CODE HAS BEEN DEPLOYED.**  
Awaiting explicit user authorization before proceeding with deployment.
