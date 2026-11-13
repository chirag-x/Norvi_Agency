# Admin Licenses & Device Management Upgrade

This directory tracks the plan and implementation phases for the **Admin Licenses & Device Management Upgrade** across NORVI Agency.

---

## Scope of Work

1. **Hardware ID (HWID) Device Management:**
   - View all hardware IDs linked to each license.
   - Individual device unlinking (frees the slot cleanly without banning).
   - Time-based & lifetime device banning (`24 Hours`, `7 Days`, `1 Month`, `Lifetime`).
   - 1-click instant unban.
2. **Customer Email Visibility:**
   - Display customer email alongside their name and activation key.
   - 1-click copy and search by email.
3. **Live Per-User AI & Speech Quota Tracker:**
   - Live requests used today vs daily limit & remaining count.
   - Weekly/monthly requests, total tokens, and real dollar cost spent.
   - Groq fallback speech transcriptions used & remaining.
   - Recent prompt turns drawer (last 10 requests).
4. **Gift 1-Day Trial License Option:**
   - Add **`1 Day (Trial Key)`** to the existing `1 Month`, `3 Months`, and `Lifetime` gift options.
5. **Customer Device Self-Release Bug Fix:**
   - Fix the bug where customers releasing a device in `/account/licenses` accidentally bans the device.

---

## 3 Concise Execution Phases

| Phase | Title | File | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Database Schema, RPCs & Security Fixes | [phase-01-database-and-rpcs.md](./phase-01-database-and-rpcs.md) | ✅ Completed |
| **Phase 2** | Backend API Endpoints & Business Logic | [phase-02-api-endpoints.md](./phase-02-api-endpoints.md) | ✅ Completed |
| **Phase 3** | Admin UI Polish & Automated Verification | [phase-03-admin-ui-and-verification.md](./phase-03-admin-ui-and-verification.md) | ✅ Completed |
