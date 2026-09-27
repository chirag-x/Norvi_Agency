# Phase 10 - Two-Step Account-Tied Licensing (Anti-Piracy)

**Status:** Completed

## Implementation Summary:
- **Backend Gatekeeper API:** Implemented highly-secure /api/agent-auth/login and /api/agent-auth/activate endpoints in live.ts (Migration 032).
- **Strict User Verification:** The backend strictly verifies that the provided Activation Key belongs to the exact Supabase User ID (email) that just logged in.
- **Hardware Fingerprinting:** A standalone 
orvi_gatekeeper.py engine generates a unique hardware ID (MAC address + Node name) and registers it against the user's 3-device limit.
- **Agent Integrations (Zero-Code Modification):**
  - **Voro (PySide6):** Injected natively before the QApplication event loop, halting the app with a dark-mode login dialog.
  - **Rolvio (Streamlit):** Injected at the top of pp.py and across all pages/*.py to render a native Streamlit login form and completely hide the sidebar using custom CSS st.stop().
- **Cryptographic Leases:** Agents store a 7-day signed JWT locally. If the lease expires, or hardware changes, or trial ends, the app instantly locks down again.
