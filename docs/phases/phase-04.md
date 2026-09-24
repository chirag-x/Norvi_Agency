# Phase 4 - Complete License and Agent Security

**Status:** Completed

## Completed Work:
- [x] Designed one consistent license-key format (`NORVI-XXXX-XXXX-XXXX-XXXX`).
- [x] Hashed keys consistently using `SHA-256` for fast lookups.
- [x] Encrypt recoverable keys with a dedicated server encryption key (`pgcrypto` via `pgp_sym_encrypt` and `pgp_sym_decrypt` using `CRON_SECRET` as the master key).
- [x] Made issue, rotate, revoke, and restore operations transactional via Secure Database RPCs (`process_payment_webhook`, `rotate_license_key`).
- [x] Built owner and customer key-reveal endpoints (`reveal_license_key`).
- [x] Return short-lived signed activation leases (JWTs) to agents via `/api/agent/activate`.
- [x] Include product, license, device, version, and expiry claims in the JWT lease.
- [x] Defined offline behavior and grace periods (Agents receive a 7-day offline JWT lease).
