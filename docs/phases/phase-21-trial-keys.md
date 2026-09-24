# Phase 21 - Trial Versions & Time-Limited Activation Keys

**Status:** Pending

## Plan:
- **Trial Activation Keys:** Introduce a new 'trial' license type that functions for exactly 24 hours.
- **Activation-Triggered Countdown:** The 24-hour timer does not start when the key is generated. It starts at the exact moment (`first_activated_at`) the user first logs into the agent with the trial key.
- **Agent Expiration Handling:** The desktop agent will check the license status upon opening and periodically while running. Once the 24 hours expire, the agent will lock the user out and display a pop-up stating the trial has expired, directing them to the NORVI website to purchase a permanent license.
- **Backend Enforcement:** The backend API will automatically reject any agent requests authenticated with a trial key if `now() > first_activated_at + 24 hours`.
