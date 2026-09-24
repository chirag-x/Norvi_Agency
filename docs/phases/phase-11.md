# Phase 11 - Over-The-Air (OTA) Auto-Updates

**Status:** Pending

## Plan:
- **Updater API:** Create a new /api/internal/check-updates endpoint.
- **Background Fetching:** When the desktop agent launches, it pings the server with its current version. If the server detects a newer version on GitHub Releases, it generates a signed download URL.
