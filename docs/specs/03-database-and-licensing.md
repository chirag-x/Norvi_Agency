# Database, Keys, and Access Control

## Owner control

You control the business accounts, database project, domain, repository, and deployment accounts. The admin interface provides routine customer/license management. Direct database access remains available to you for exceptional maintenance, but normal revocation uses a transactional admin operation with an audit trail.

Revoke by changing status, not deleting the row. Keeping the record preserves purchase history, payment reconciliation, support evidence, and the ability to explain why a key stopped working. Permanent data erasure is a separate retention workflow.

## Proposed data model

All timestamps use UTC; money uses integer minor units plus an explicit currency. Foreign keys, unique constraints, and checks enforce relationships. Do not store passwords yourself.

| Table / area | Important fields and role |
|---|---|
| Managed `auth.users` | Authentication identity; Supabase owns password/MFA handling |
| `profiles` | `user_id`, name, optional business, country, onboarding state, account suspension; registration/last-sign-in metadata; canonical verified email comes from Auth |
| `admin_roles` | Staff membership: `user_id`, fixed role, active/suspended state, granted_by, permission version, timestamps; owner-managed only |
| `staff_invitations` | Verified-email target, fixed role, token hash, inviter, expiry, acceptance/revocation; no plaintext token |
| `site_content`, `content_revisions` | Allowlisted editable content and draft/published snapshots |
| `product_revisions`, `publication_jobs` | Product snapshots, authenticated build references, deployment state and errors |
| `products` | ID, immutable product code, slug, name, description, publication status |
| `prices` | Product, billing type, amount, currency, interval, provider plan ID, active flag |
| `orders` | Customer, status, currency, total, provider order ID, checkout idempotency key, timestamps |
| `order_items` | Order, product, price snapshot, quantity; initially quantity one |
| `payments` | Order, unique provider payment ID, capture/refund status, amount, currency |
| `refunds` | Payment, unique provider refund ID, amount, requested/processed/failed state |
| `subscriptions` | Customer/product, provider subscription ID, provider state, paid-through date, cancel timing, last reconciled time |
| `licenses` | Customer/product/order item, optional subscription, entitlement expiry, owner override, max devices, current key version |
| Private `license_secrets` | License ID, globally unique key hash, encrypted key, nonce, encryption key version, suffix, replaced/revoked state |
| `devices` | License ID, random installation ID, optional public key, name, activated/deactivated/last-seen timestamps |
| `device_sessions` | Device, hashed refresh credential, expiry, revocation, credential generation/version |
| `agent_releases` | Product/version/OS, private storage path, checksum, publication state, release notes |
| `webhook_events` | Unique provider event ID, processing state, attempts, relevant normalized fields; restricted raw payload retention if needed |
| `outbox_jobs` | Type, record reference, idempotency key, due time, lock expiry, attempts, failure state; no plaintext keys |
| `email_deliveries` | Order/license reference, template, recipient, provider message ID, status, retry info; no full email body with key |
| `admin_audit_log` | Actor, target, action, reason, safe before/after values, time, request ID; no keys |
| `support_requests` | Owner, subject, content, status, timestamps |

Separate protected secret tables from normal customer views. Ownership relationships must agree: a license cannot reference an order belonging to someone else. Add unique fulfillment constraints per order item and per subscription entitlement, and unique device installation IDs per license. One active entitlement per user/product is the initial policy; buying again should offer renewal or explain existing ownership.

## Key format and generation

- Generate 32 cryptographically random bytes server-side, providing 256 bits of randomness. Encode as URL-safe text or grouped Base32; product prefix and key version are optional usability labels.
- Example structural form only: `AG1_<random-secret>`. Product authorization is checked in the database, never inferred only from the prefix.
- Database uniqueness constraints reject accidental duplicate hashes; generation retries on collision. Never derive keys from email, phone, timestamp, or an incrementing ID.
- There is no practical product-specific cap on key combinations; database/storage quotas still limit the number of stored licenses.
- Use one secure generation algorithm for all products. Lifetime, subscription, trial, and manual-grant licenses are entitlement policies, not weaker or stronger key formats. Version one enables paid licenses only unless trials are later requested.

## Recoverable storage to meet your requirement

Store both a SHA-256 lookup hash of the high-entropy key and an AES-GCM-encrypted copy. The hash supports activation lookup; the ciphertext supports showing the original key again. Use a fresh nonce per encryption and bind license/product identifiers as authenticated metadata.

Keep the encryption key in backend secret storage, separate from the database. Version it for rotation and back it up separately with restricted access. A database dump alone should not reveal the full license strings. A compromise of both database and application secrets can still expose them.

The profile lists masked keys. Revealing a full key requires ownership and recent authentication; staff reveal is owner-only and additionally requires MFA and an audit event. Avoid unrestricted exports of full keys. Rotation creates a new secret and immediately invalidates the previous secret and device sessions; keep the replacement history.

## Purchase and activation lifecycle

1. Verified captured payment creates the product-specific license and encrypted key in a database transaction.
2. The customer sees the license in their dashboard and receives the first purchase email with the activation key.
3. The downloaded agent asks for a key and submits it over HTTPS in a request body with its product ID, version, and installation identity. Never put secrets in query strings.
4. Backend checks the key hash, actual product binding, account standing, payment entitlement, owner override, expiry, and device allowance.
5. A transactional lock on the license prevents two concurrent activations exceeding the device limit. Retrying the same installation is idempotent.
6. Backend returns a short-lived signed lease and a rotating device refresh credential. The agent stores credentials in the operating system's credential store when available.
7. Lease claims bind license, product, device, issue/expiry times, and policy version. The client verifies signature, issuer, audience, expiry, and product. Only public verification keys are shipped with the agent.
8. Agent checks online at startup and refreshes every five minutes while active. Default lease lifetime is ten minutes with no extra offline grace. Refresh credentials alone never grant access without a live database check.
9. Server-hosted agent operations check current license/account status on each protected request, even when the lease signature is valid.

Device identity is a practical sharing deterrent, not an unforgeable hardware identity. A key shared before activation can still be misused; rate limiting, device limits, email alerts, customer device reset, and optional account confirmation reduce that risk.

## What happens when you revoke a key

The admin action requires a reason and recent MFA. In one transaction it sets an owner override to revoked, invalidates device sessions, increments the entitlement version, and writes an audit record. Signed URL downloads already in progress may complete; previously downloaded files cannot be recalled.

| Situation | Expected result |
|---|---|
| New activation | Denied after the revocation transaction commits |
| Next protected server operation | Denied through a current-state check |
| Already-running unmodified local agent | Stops at refresh, or when its current lease expires; at most ten minutes under this policy |
| Customer offline or licensing service unavailable | Existing lease lasts until expiry; no new authorization; show a clear connection message |
| Modified/patched local software | Cannot guarantee shutdown of entirely local functionality |
| Payment renewal arrives after revocation | Records payment but does not clear the owner override |

Do not promise instantaneous remote control over offline copies. Strong enforcement requires valuable functionality to remain behind an authorized server API. In-progress remote jobs must recheck before costly steps or external side effects where cancellation is safe; completed actions cannot be undone by revoking a license.

## Entitlement and billing policy

Use separate fields for provider billing state, `paid_through`, and manual access override. Effective access requires a usable account, active key, no owner suspension/revocation, and an unexpired paid entitlement (or a valid lifetime grant).

- Renewal extends the existing license; it does not issue another key each month.
- Cancel at period end stops future renewal and preserves paid access until expiry.
- Immediate access revocation blocks usage; billing cancellation must also be requested separately if intended.
- Refunds and chargebacks update entitlement under the published policy; partial refunds need explicit treatment.
- Restoring a license removes the manual override only. It does not manufacture a paid period or resurrect a replaced secret.
- Missing database records fail closed. No background import or late webhook may silently recreate a deleted/revoked entitlement.

## Upgrade Two: staff and non-buyers

Provision profiles at registration, including supported social sign-in, before any purchase. Customer directory queries start from identities/profiles and retain accounts without orders. Reconcile missing profiles; display unknown sign-in data honestly. Staff membership and customer entitlements remain separate.

Owner manages staff membership; Administrator manages permitted business operations; Product Manager edits catalog/content; Support sees limited customer/license metadata and can reset devices. Full customer key reveal and customer bulk export are owner-only. No staff member receives raw database credentials through the panel. All grant/revoke operations are audited, and permissions are rechecked on each request and within sensitive transactions.

See [Upgrade Two](./07-upgrade-two-admin-and-team.md) for the complete permission matrix, draft publishing model, invitation lifecycle, and last-owner protection.

## Access rules

Customers read only their own records and change only allowed profile fields. They cannot insert licenses, mutate prices/payment state, increase device limits, or set roles. Secret retrieval, license mutation, and signed download creation go through the backend. Audit records are append-only for application identities; retention and owner database access mean they are not claimed to be tamper-proof against the database owner.
