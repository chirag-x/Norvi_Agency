# Norvi Agents Repository - Release Management Guide

Because you are using a **single master repository** (chirag-x/Norvi-Agents) to store the binaries (.exe and .zip files) for **multiple different AI agents** (Voro, Rolvio, etc.), you must follow a strict "Prefix Tagging" protocol when creating GitHub Releases.

If you don't follow this protocol, the Agency Auto-Updater will get confused and might try to download Rolvio when a user asks for Voro.

## The "Prefix Tagging" Rule

When you create a new release on GitHub, the **Tag Name** is the most important part. The Agency Backend searches the repository for the most recent tag that *starts with* the product's slug (the URL name of the product in your database).

### 1. How to Release Voro Updates
- **Go to:** chirag-x/Norvi-Agents -> Releases -> Draft a new release.
- **Tag Name (CRITICAL):** Voro-v1.3.0 (It MUST start with Voro-).
- **Release Title:** (Whatever you want, e.g., "Voro 1.3.0").
- **Description:** Type your changelog here. (The Agency API will extract this as the 
elease_notes for the updater popup).
- **Assets:** Drag and drop your Voro .exe file here. The filename **must** contain Voro (e.g., Voro-setup.exe or Voro-v1.3.0.exe).
H
### 2. How to Release Rolvio Updates
- **Go to:** chirag-x/Norvi-Agents -> Releases -> Draft a new release.
- **Tag Name (CRITICAL):** 
olvio-v1.0.5 (It MUST start with 
olvio-).
- **Release Title:** (Whatever you want, e.g., "Rolvio 1.0.5").
- **Description:** Type your changelog here.
- **Assets:** Drag and drop your Rolvio .zip or .exe file here. The filename **must** contain 
olvio.

---

## How the Agency Backend Processes This (Under the Hood)
1. Voro hits /api/agent-auth/check-updates?product=voro.
2. The Backend looks at the Norvi-Agents repository and fetches the 30 most recent releases.
3. It ignores any release tag that starts with 
olvio- or anything else.
4. It finds the absolute newest release where the tag starts with Voro-.
5. It extracts the version number (e.g., 1.3.0), reads your description notes, and grabs the secure AWS S3 download link for the .exe asset inside that release.
6. It sends this JSON exactly back to Voro's auto-updater.
