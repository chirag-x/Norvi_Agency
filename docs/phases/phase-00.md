# Phase 0 - Emergency Security Repair

**Status:** Completed

## What was done:
1. **Global Default Privileges:** Changed PostgreSQL default behavior so future functions in public schema are NOT executable by public/anon by default.
2. **Explicit Null Identity Rejection:** Rewrote all 11 admin RPC functions to explicitly reject anonymous (NULL) roles using coalesce().
3. **MFA (AAL2) Enforcement:** Prepared the AAL2 MFA checks in the SQL script (currently commented out until Phase 2 is complete).
4. **Outbox Schema Repair:** Fixed admin_list_activity function to correctly read from private.outbox by using completed_at instead of the non-existent status column.
5. **Trigger Lockdown:** Revoked public execution rights from private background trigger functions.

The file `supabase/migrations/010_emergency_security_patch.sql` was created.
