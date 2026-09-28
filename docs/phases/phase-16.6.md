# Phase 16.6: Customer-Facing Copy & Legal Updates

## Objective
To update all customer-facing help text, legal documents, and agent detail pages to align with the new flexible pricing structure (1-month, 3-month, lifetime) and promotional engine. This phase removes deprecated references to the old 1-day free trial and hardcoded 1-device limits.

## Changes Made
1. **Help Center (/help)**
   - Updated **Payments and pricing**: Removed the "1-day free trial" and "one-time payment" wording. Added details about flexible 1-month, 3-month, and lifetime plans, as well as the ability to apply promotional codes at checkout.
   - Updated **Device management**: Removed the hardcoded "1 device" limit constraint in the text to support flexible device authorization limits across different licenses.

2. **Legal & Policies (/terms, /refunds, /license)**
   - **Terms of Service (Service Scope)**: Updated the service scope to reflect flexible terms and explicitly defined checkout durations instead of assuming a 1-day free trial.
   - **Refunds (Eligibility)**: Clarified that sales are final once the digital key is generated. Removed references to trials acting as the only gateway.
   - **License Agreement**: Broadened device sharing rules to refer to "authorized devices based on the product" instead of a strict 1-device hardcap. Subscriptions and billing cycle expiry definitions were added.

3. **Agent Detail Page (/agents/[slug])**
   - Removed the obsolete "Start free trial" secondary button.
   - Stripped the startTrial backend connection logic, trial state variables, and modal overlay from the Detail component to prevent confusion and redirect customers securely through the new checkout and promo engine.

## Status
Completed. The customer experience now perfectly mirrors the backend commercial reality.
