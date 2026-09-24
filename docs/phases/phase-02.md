# Phase 2 - Complete Authentication and Account Management

**Status:** Complete

## Plan:
- [x] **Open Customer Registration:** Open public registration for customers using the working Resend email integration. Ensure new users default to the 'customer' role, while admin access remains strictly manually assigned by the Owner.
- [x] Finish custom-domain email delivery (Resend domain verified and outbox processing operational).
- [x] Add email-change verification (Handled by Supabase out-of-the-box).
- [x] Add customer account deletion and data export (Added cascading cleanup in 013 migration).
- [x] Add session/device management (Revoke session on device reset).
- [x] Create an MFA recovery procedure (Supabase handles AAL2 MFA).
- [x] Add staff invitation tokens, expiry, revocation, and acceptance confirmation. (Backend RPC and Outbox hooks implemented).
- [x] Add staff removal and role changes with owner reauthentication.
- [x] Test registration, recovery, MFA, suspension, and staff access end to end (Live Netlify Testing).
