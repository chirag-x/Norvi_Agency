# Phase 10 - Two-Step Account-Tied Licensing (Anti-Piracy)

**Status:** Pending

## Plan:
- **Two-Step Desktop Login:** When a user opens the desktop agent, they must first log in using their NORVI Email and Password (Step 1). On the second screen, they must enter their specific Activation Key (Step 2).
- **Strict Database Validation:** The backend API will strictly verify that the provided Activation Key actually belongs to the authenticated Email Address.
- **Session Limits:** Enforce a "1 Active Session" rule.
- **Bulletproof Revocation:** If abuse is detected, the admin can click "Rotate Key" in the dashboard. The desktop agent will instantly lock the user out until the new key is provided.
