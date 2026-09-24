# GitHub Release Storage Guide

Norvi uses GitHub Private Releases as a highly secure, free file hosting solution for your AI agents. 

When a customer attempts to download an agent, the Norvi API communicates with GitHub to locate the correct file. GitHub then responds with an Amazon S3 direct download link that is signed and set to expire in exactly 5 minutes, preventing piracy.

## Prerequisites
You must have the following Environment Variables configured in your Netlify Dashboard:
* `GITHUB_PAT` (A GitHub Personal Access Token with read access to the repo)
* `GITHUB_REPO_OWNER` (Your GitHub username or organization name, e.g., `chirag-x`)
* `GITHUB_REPO_NAME` (The name of the private repository, e.g., `Norvi-Agents-Releases`)

## How to Upload an Agent Update
1. Go to your private GitHub repository containing your agent files.
2. Click **Releases** on the right side of the repository page.
3. Click **Draft a new release**.
4. Choose a tag version (e.g., `v1.0.0`).
5. In the **Attach binaries by dropping them here or selecting them** box, upload your `.exe` or `.zip` files.
6. Click **Publish release**.

## Important: How to Name Your Files
The Norvi API finds the correct file by looking at the **Product Slug** in your database. 

If your product is named "Voro Agent" and its slug in the database is `voro-agent`, the file uploaded to GitHub **must contain `voro-agent` in the file name** and must end in `.exe` or `.zip`.

**✅ Valid File Names (for Voro):**
* `voro-setup.exe`
* `voro-v1.0.zip`
* `voro_mac.zip`

**✅ Valid File Names (for Omnix):**
* `omnix-setup.exe`
* `omnix-v2.0.zip`

**✅ Valid File Names (for Rolvio):**
* `rolvio-setup.exe`
* `rolvio-v1.5.zip`

**❌ Invalid File Names (for Voro):**
* `setup.exe` (Missing the exact slug `voro`)
* `voro-agent.dmg` (Currently the API only looks for `.exe` and `.zip`. If you need `.dmg`, we can add it to the code).

## How it works behind the scenes
1. Customer clicks "Download" in their Norvi Dashboard.
2. Norvi API verifies the customer's license is `active`.
3. Norvi API asks GitHub for the latest release in your repo.
4. Norvi API searches the release assets for a file matching the product's slug.
5. GitHub provides an S3 URL.
6. Norvi redirects the customer's browser to the S3 URL.
7. The S3 URL permanently expires 5 minutes later.
