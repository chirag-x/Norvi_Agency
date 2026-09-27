# Voro Auto-Updater (Phase 11) - Administrator Guide

This guide explains how to properly package and upload updates for the Voro agent so that your customers' agents can automatically discover and download them via the secure Agency Backend.

## 1. Prepare the Update
1. Make your code changes inside the Voro directory.
2. Update the version number in Voro/app/core/version.py (e.g., __version__ = "1.3.1").
3. Ensure the app works correctly by testing locally.

## 2. Build the Executable
You must build a standalone executable that the updater can replace the old one with.
Run PyInstaller inside the Voro directory:
\\\ash
cd Voro
pyinstaller --name "Voro" --onefile --windowed main.py
\\\
*(This will generate a Voro.exe inside the Voro/dist folder).*

## 3. Create a GitHub Release
Since your GitHub repository is **Private**, you can safely host your files there. The Agency Backend uses a hidden Personal Access Token to securely fetch these files for active customers.

1. Go to your GitHub Repository: https://github.com/chirag-x/Norvi-Agents
2. Go to **Releases** (on the right sidebar) -> **Draft a new release**.
3. **Choose a tag:** Type oro-v1.3.1 (Replace 1.3.1 with your actual version. It **MUST** start with oro-v so the backend knows this release is for Voro and not Rolvio).
4. **Release title:** e.g., "Voro Update 1.3.1".
5. **Attach binaries:** Drag and drop the Voro.exe (from your dist folder) into the "Attach binaries by dropping them here" box.
6. Click **Publish release**.

## 4. That's it!
Your users' Voro desktop agents will automatically ping your website's /api/agent-auth/check-updates endpoint. 
1. The website verifies their license is active.
2. The website connects to GitHub, finds the latest release tagged with oro-v..., and grabs the secure download link.
3. The Voro agent downloads the new .exe, replaces itself, and restarts!
