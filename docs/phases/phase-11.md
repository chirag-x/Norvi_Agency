# Phase 11 - Over-The-Air (OTA) Auto-Updates

**Status:** Completed (Backend) / Frontend Pending User Implementation

## Overview
Phase 11 shifts agent auto-updates from direct public GitHub requests to a highly secure, authenticated Agency Backend proxy. This ensures only users with active, paid licenses receive updates, protecting the intellectual property of the agents while providing a seamless user experience.

## The Agency Backend (Completed)
1. **Multi-Repo Configuration:** The products database table has been updated to store github_repo_owner and github_repo_name.
2. **Secure Proxy Endpoint:** A new endpoint (/api/agent-auth/check-updates) was built in live.ts.
3. **Authentication:** The endpoint requires the 7-day cryptographic JWT lease in the Authorization header and validates the lease to ensure the user is an active customer.
4. **Dynamic JSON Generation:** The server uses a hidden GITHUB_PAT to fetch the latest GitHub Release for the specific product (filtering by prefix, e.g. oro-v1.3.0). It intercepts the GitHub S3 download link and returns a JSON response matching Voro's expected format.

## Agent Modifications (To be done by user)
- **Voro:** Voro's existing updater (pp/core/updater.py and pp/core/version.py) needs to be pointed to https://your-domain.com/api/agent-auth/check-updates instead of GitHub directly, passing the JWT in the Authorization: Bearer header.
- **Rolvio:** A native Streamlit auto-updater needs to be built to check the same endpoint, download the update, and extract it natively.

*See docs/phases/phase-11-github-updater-instructions.md for the administrator guide on how to upload updates.*
