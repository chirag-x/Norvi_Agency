# Phase 4 - Complete License and Agent Security

**Status:** Pending

## Plan:
- Design one consistent license-key format.
- Hash keys consistently.
- Encrypt recoverable keys with a dedicated server encryption key.
- Make issue, rotate, revoke, and restore operations transactional.
- Build owner and customer key-reveal endpoints.
- Return short-lived signed activation leases to agents.
- Include product, license, device, version, and expiry claims in the lease.
- Define offline behavior and grace periods.
