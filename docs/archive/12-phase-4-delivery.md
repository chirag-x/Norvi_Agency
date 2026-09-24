# NORVI — Phase 4: Agent Delivery & Licensing

This document outlines Phase 4 of the NORVI build. With the payment architecture (Phase 3) built but paused for KYC compliance, Phase 4 focuses on securely delivering the actual software to the user's computer and verifying they have a valid license to run it.

## Overview of Phase 4
Phase 4 bridges the gap between the NORVI web dashboard and the actual desktop applications (Omnix, Voro, Rolvio). When a user buys an agent, they need to download it, install it on their Windows machine, and enter their Activation Key. The desktop app must then verify this key with our backend.

---

## 1. Developer Tasks (What we will code together)

### A. The Download Infrastructure
*   **Secure Storage:** We will set up a private storage bucket (e.g., Supabase Storage or Cloudflare R2) to host the actual `.exe` installer files for Omnix, Voro, and Rolvio.
*   **Dynamic Download Links:** We will write an API endpoint (`/api/licenses/:id/download`) that verifies if a user actually owns a license before giving them a secure, time-expiring download link to the software. 

### B. The Desktop Activation API
*   **The Activation Endpoint:** We will build `/api/agent/activate`. When a user launches Omnix on their Windows PC and pastes their license key, the desktop app sends this key to our backend.
*   **Cryptographic Hashing:** The backend will securely hash the key and check it against the `license_secrets` table in the database.

### C. Device Leases & Authorization
*   **Preventing Piracy:** To stop one user from buying a key and sharing it with 100 friends, we will implement "Device Leases".
*   **Fingerprinting:** The desktop app will generate a unique hardware ID (DeviceId) for the user's computer. 
*   Our API will log this `installation_id` in the `devices` table. If a user tries to activate the agent on too many computers, the backend will block it.

### D. License Revocation & Rotation
*   We will build the admin controls so you (the Owner) can manually revoke a stolen license, reset a device limit, or rotate a compromised key directly from the `/admin` dashboard.

---

## 2. Founder Tasks (What you must do manually)

### Step 1: Finalize the Desktop Apps
You must finish building the actual Python/C++ code for Omnix, Voro, and Rolvio and compile them into executable installers.

### Step 2: Integrate the License Check
Inside your desktop application's code, you must add logic to prompt the user for their License Key on first launch, and write an HTTP request to call `https://your-domain.com/api/agent/activate`.

### Step 3: Upload the Release Files
Once your agents are ready, you will manually upload the installer files to our secure storage bucket and link them to the product IDs in the database.

---

## Conclusion
Once Phase 4 is complete, your system is officially "Feature Complete". You will have a working frontend, a secure payment architecture, and a bulletproof piracy-prevention delivery system. At that point, you just need a real domain to turn Razorpay "Live", and you are ready for launch!
