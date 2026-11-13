# NORVI AI Support Agent — Complete Master Knowledge Base Training Pack

**Document Version:** 2.0.0 (Master Library: 26 Complete Articles)  
**Target:** Admin Panel -> AI Support Agent -> Knowledge Base (`/admin/ai-agent`)  
**Usage:** For each article below:
1. Copy the **Title / Topic** into the top field.
2. Copy the **Content** into the large text area.
3. Click **Add Article**. The platform will automatically vectorize each article using `gemini-embedding-2`.

---

## Master System Prompt (Configuration Tab)

> **Where to put this:** Admin Panel -> AI Support Agent -> Configuration tab -> **System Prompt (Agent Persona)**

```text
You are the official, highly professional, friendly, and concise AI Support Assistant for NORVI Agency (https://nor-vi.in). 
You help prospective customers and current users with our autonomous desktop AI agents (Voro, Rolvio, Nexus), licensing, offline rules, hardware machine management, payments, and downloads.

CORE OPERATIONAL RULES:
1. ALWAYS base your answers strictly on the provided company knowledge base. Never hallucinate or promise unverified features.
2. OFFLINE OPERATION: Strictly state that agents operate offline for up to 24 hours (1 day) before performing a brief background validation check. NEVER state 7 days.
3. MACHINE ALLOWANCE: Each license allows simultaneous activation on up to 3 of the customer's personal computers. Customers can rotate or release machines anytime with 1 click in their dashboard under "/account/licenses" (Keys & devices) by clicking "Disconnect Computer".
4. PRIVACY: NORVI agents run 100% locally on the customer's PC (Windows 10/11 64-bit and macOS). We do not record screens, audio, or store user workflow data in the cloud. There are zero token surcharges.
5. FULFILLMENT: License keys (NORVI-XXXX-XXXX) are delivered instantly on screen and via email immediately after successful Razorpay checkout.
6. SUPPORT ESCALATION PROTOCOL:
   - If a customer asks a question you do NOT know, or if an issue requires human intervention (such as payment disputes, refund requests, custom enterprise inquiries, or account lockout):
     * For registered customers: Direct them to open a Support Ticket in their account dashboard at "/account/support" or message our engineering team on WhatsApp.
     * For prospective or guest visitors: Direct them to submit the Contact Form at "/contact" or message our engineering team on WhatsApp.
     * Always provide the official WhatsApp support link: https://wa.me/919893534314 (+91-9893534314) and note support hours: Mon–Sat, 10:00 AM – 8:00 PM IST.
7. Keep responses concise, polite, well-structured, and helpful. Use bullet points when explaining multiple steps.
```

---

## PART 1: Core Licensing, Offline & Hardware Management (Articles 1–8)

### Article 1: Agent Activation, License Keys & Machine Verification
* **Title / Topic:** `Agent Activation, License Keys & Machine Verification`
* **Content:**
```text
License Key Format & Delivery:
- Every NORVI license key follows the format: NORVI-XXXX-XXXX (16-character alphanumeric string).
- Upon completing checkout via Razorpay, your activation key is displayed immediately on your order confirmation screen, dispatched to your registered email address, and saved under your account dashboard at "/account/licenses" (Keys & devices).

Activating an Agent on Your Computer:
1. Download and run the native desktop installer from your dashboard under "My agents" (/account/agents).
2. Launch the agent on your Windows 10/11 or macOS computer.
3. When prompted, paste your NORVI-XXXX-XXXX license key and click "Verify & Activate".
4. Your computer requires an active internet connection only during initial key activation to register your machine securely with our verification server. Once verified, your license is bound to your machine.

Troubleshooting Activation Errors:
- "Product Mismatch": Ensure you are entering the key for the matching agent product (e.g., a Voro key cannot activate Rolvio or Nexus).
- "Machine Limit Reached": If you have already activated 3 computers, log into "/account/licenses" on the web, click "Disconnect Computer" next to any inactive machine, and retry.
- "Initial Connection Timeout": Check your firewall or proxy to ensure the desktop app can briefly reach https://nor-vi.in for validation.
```

---

### Article 2: Multi-Device Allowance & Hardware Slot Management
* **Title / Topic:** `Multi-Device Allowance & Hardware Slot Management`
* **Content:**
```text
Simultaneous Machine Allowance:
- Every purchased license allows simultaneous activation on up to 3 of your personal computers (for example, your primary desktop PC, office laptop, and backup Mac).
- You do not need to purchase multiple licenses to use your agent across your own devices.

Self-Serve Hardware Slot Rotation:
- If you buy a new computer, upgrade your operating system, or want to move your license to another machine:
  1. Log into your NORVI account at https://nor-vi.in/account/licenses.
  2. Locate the agent license under "Keys & devices".
  3. Under "Connected Computers", find the machine you want to remove and click "Disconnect Computer".
  4. The hardware slot is freed immediately with zero waiting time.
  5. Open the agent on your new computer, enter your key, and activate.
- You do not need to contact customer support to rotate your computers; this feature is 100% self-serve in your dashboard.
```

---

### Article 3: 1-Day Offline Support & Local Privacy Architecture
* **Title / Topic:** `1-Day Offline Support & Local Privacy Architecture`
* **Content:**
```text
1-Day (24-Hour) Offline Operation:
- NORVI desktop agents are engineered for offline reliability.
- Once activated online, your agent can run completely offline without an active internet connection for up to 24 hours (1 full day).
- When 24 hours elapse, the agent will perform a brief background license validation check the next time your machine connects to the internet.
- You can work without interruption while traveling, during internet outages, or in offline environments. Note: The offline validity window is strictly 1 day (24 hours).

Privacy & Security Architecture:
- 100% Local PC Execution: All vision analysis, screen context, and workflow automations process directly on your local hardware.
- Zero Cloud Surveillance: NORVI does not record your screen, upload private meeting audio, or store sensitive customer work files in the cloud.
- Zero Token Surcharges: Unlimited local agent operations are included with zero recurring token markups or hidden fees.
```

---

### Article 4: Agent Catalog & Product Breakdown (Voro, Rolvio, Nexus)
* **Title / Topic:** `Agent Catalog & Product Breakdown (Voro, Rolvio, Nexus)`
* **Content:**
```text
1. Voro (Real-time AI Interview Assistant & Coding Copilot):
- Category: Desktop Agent (Interview Assistant).
- Purpose: Real-time, screen-aware copilot designed for live coding, technical interviews, and LeetCode problem solving.
- Key Capabilities: Completely invisible on Zoom, Google Meet, and screen shares; instant coding assistance and algorithmic hints; real-time low-latency audio transcription; customizable stealth hotkeys.
- Platforms: Windows 10/11 64-bit and macOS.

2. Rolvio (Autonomous Career & Job Search Agent):
- Category: Desktop Agent (Autonomous Career Agent).
- Purpose: Fully autonomous AI job hunter that searches, matches, and applies to jobs on LinkedIn and Indeed.
- Key Capabilities: Auto-applies to matching job postings; dynamically tailors your resume and answers application questionnaires; tracks submission status and recruiter emails automatically in real time.
- Platforms: Windows 10/11 64-bit and macOS.

3. Nexus (Viral Content Studio & Short-Form Automation):
- Category: Desktop Agent (Social Media & Content Studio).
- Purpose: Turns long-form videos and podcasts into viral vertical shorts, reels, and TikToks in seconds.
- Key Capabilities: Automatic scene-cut snapping and speaker centering; 4 designer subtitle presets; instant batch video processing; auto-publishing direct to YouTube Shorts, TikTok, and Instagram Reels.
- Platforms: Windows 10/11 64-bit and macOS.
```

---

### Article 5: Pricing, Billing, Payment Methods & Instant Delivery
* **Title / Topic:** `Pricing, Billing, Payment Methods & Instant Delivery`
* **Content:**
```text
License Tiers & Pricing:
- Flexible Duration Options: We offer 1-Month, 3-Month, and Lifetime license tiers.
- Rolvio Pricing: 1 Month: ₹479 | 3 Months: ₹1,199 | Lifetime: ₹4,499.
- Voro Pricing: 1 Month: ₹599 | 3 Months: ₹1,499 | Lifetime: ₹4,999.
- Nexus Pricing: 1 Month: ₹599 | 3 Months: ₹1,499 | Lifetime: ₹4,999.
- Transparent Billing: Zero recurring auto-debit surprises. You only pay for the duration you select.
- Lifetime Upgrade: Customers who purchase 1-Month or 3-Month access can upgrade to Lifetime access at any time from their account billing dashboard, unlocking permanent updates and priority technical support.

Accepted Payment Methods:
- All payments are processed securely through Razorpay, India's leading payment gateway.
- Accepted methods:
  * UPI (Google Pay, PhonePe, Paytm, BHIM, Cred UPI)
  * Credit Cards & Debit Cards (Visa, MasterCard, RuPay, American Express)
  * Netbanking across all major Indian banks
- Invoices: Verified digital tax invoices with complete payment references are generated instantly in your "/account/billing" tab.
```

---

### Article 6: Refund, Cancellation & 7-Day Technical Warranty
* **Title / Topic:** `Refund, Cancellation & 7-Day Technical Warranty`
* **Content:**
```text
Digital Product Sales Policy:
- Because NORVI sells digital downloadable AI software and unique cryptographic activation keys that unlock immediate access upon checkout, all sales are final once the key is generated and dispatched to your dashboard.
- Orders cannot be canceled or refunded once payment is processed and digital fulfillment is complete.

7-Day Technical Support Warranty:
- If you encounter a verified technical defect, installation incompatibility, or system failure preventing you from accessing or running the software on a supported operating system (Windows 10/11 64-bit or macOS), our engineering team will provide hands-on live troubleshooting.
- Customers must reach out within 7 days of purchase via WhatsApp (+91-9893534314) or email (norviagency@gmail.com). If our engineering team cannot resolve the technical defect within 7 days, appropriate remedial action will be taken.
```

---

### Article 7: Support Channels, Hours & Human Escalation Rules
* **Title / Topic:** `Support Channels, Hours & Human Escalation Rules`
* **Content:**
```text
Official NORVI Support Channels:
1. Direct WhatsApp Engineering Support (Fastest):
   - Phone: +91-9893534314
   - Direct Link: https://wa.me/919893534314?text=Hi%20NORVI%20Support%2C%20I%20need%20assistance.
   - Operating Hours: Monday to Saturday, 10:00 AM – 8:00 PM IST.
   - Typical Response Time: Under 30 minutes.

2. Customer Dashboard Support Tickets (For Registered Customers):
   - Location: https://nor-vi.in/account/support
   - Use: Technical inquiries, hardware unlinking requests, license transfers.
   - Direct alert to the engineering team with email status notifications.

3. Public Contact Form (For Prospective Customers & General Queries):
   - Location: https://nor-vi.in/contact
   - Direct notifications to team Discord channel.

4. Email:
   - norviagency@gmail.com
```

---

### Article 8: AI Agent Fallback, Out-of-Scope & Triage Protocols
* **Title / Topic:** `AI Agent Fallback, Out-of-Scope & Triage Protocols`
* **Content:**
```text
When to Escalate to Human Engineers:
- The AI Agent must NEVER fabricate answers or guess technical troubleshooting steps beyond this knowledge base.
- If a customer or visitor asks about:
  * A payment dispute, refund request, or failed Razorpay transaction.
  * Inability to access their dashboard to disconnect a computer.
  * Custom enterprise contracts, bulk volume pricing, or partnership terms.
  * Reporting a software bug or requesting a custom feature.
  * Any topic not covered in the official NORVI knowledge base.

Standard Fallback Response Script:
"I don't have enough verified information to resolve this specific issue directly, but our engineering team can help you immediately!
- If you have an active account: Please submit an official Support Ticket from your dashboard at https://nor-vi.in/account/support so our technical team can review your account.
- For immediate live help: Chat with our engineering support directly on WhatsApp at +91-9893534314 (https://wa.me/919893534314). We are online Mon–Sat, 10 AM – 8 PM IST with typical replies under 30 minutes.
- If you are a prospective visitor: You can also leave a message using our Contact Form at https://nor-vi.in/contact."
```

---

## PART 2: Deep-Dive Products, OS Setup & Advanced Troubleshooting (Articles 9–26)

### Article 9: Founder Story, Engineering Philosophy & Company Background
* **Title / Topic:** `Founder Story, Engineering Philosophy & Company Background`
* **Content:**
```text
About NORVI Agency & Founder Chirag Sharma:
- Founder & Lead AI Architect: Chirag Sharma (Portfolio: https://chirag-portfolio-v3.netlify.app/).
- Headquartered in Gwalior, Madhya Pradesh, India (NORVI AI Agency, Kunj Vihar, Gole Ka Mandir, Gwalior 474005).
- Core Mission: Building truly autonomous, native desktop AI software that eliminates repetitive busywork and returns focus to high-value human creativity.
- Engineering Philosophy:
  * Privacy First: Local computer execution rather than surveillance-heavy cloud recording.
  * Low Latency: Sub-second audio transcription, computer vision, and local DSP algorithms running directly on your PC.
  * Accessible Pricing: Fair Indian pricing starting at ₹479 without recurring auto-debit locks or hidden token markups.
```

---

### Article 10: Windows Installation & SmartScreen "Run Anyway" Walkthrough
* **Title / Topic:** `Windows Installation & SmartScreen "Run Anyway" Walkthrough`
* **Content:**
```text
Windows Installation Guide:
- Supported Versions: Windows 10 (64-bit) and Windows 11 (64-bit).
- Step-by-Step Installation:
  1. Download the setup file (.exe) from your dashboard under "/account/agents".
  2. Double-click the downloaded installer to begin.
  
Understanding the Windows SmartScreen Popup:
- Because NORVI agents are frequently updated with new AI engine features, Microsoft Defender SmartScreen may display a blue warning screen stating: "Windows protected your PC - Microsoft Defender SmartScreen prevented an unrecognized app from starting."
- This is a standard Windows warning for newly published software executables.
- How to proceed:
  1. Click the underlined text that says "More info".
  2. A new button will appear at the bottom right labeled "Run anyway".
  3. Click "Run anyway" to proceed with normal installation.
- All NORVI application installers are clean, malware-free, and digitally packaged for secure local execution.
```

---

### Article 11: macOS Installation, Gatekeeper & Permissions Guide
* **Title / Topic:** `macOS Installation, Gatekeeper & Permissions Guide`
* **Content:**
```text
macOS Installation Guide:
- Supported Versions: macOS 12 (Monterey), macOS 13 (Ventura), macOS 14 (Sonoma), and newer.
- Architecture: Fully compatible with Apple Silicon (M1, M2, M3, M4) and Intel-based Macs.

Installation Steps:
1. Download the macOS package (.dmg) from your account dashboard.
2. Open the DMG file and drag the agent icon into your Applications folder.

Bypassing Apple Gatekeeper ("Unidentified Developer"):
- If macOS alerts: "App cannot be opened because it is from an unidentified developer":
  1. Open System Settings (or System Preferences).
  2. Navigate to "Privacy & Security".
  3. Scroll down to the "Security" section. You will see a notice: "[Agent Name] was blocked from use because it is not from an identified developer."
  4. Click the "Open Anyway" button and enter your Mac password.

Required macOS Permissions (For Voro & Screen Tools):
- Accessibility Permission: Required to register stealth keyboard hotkeys. (System Settings -> Privacy & Security -> Accessibility -> Toggle ON).
- Screen Recording Permission: Required for real-time vision reading of code editors or meeting windows. (System Settings -> Privacy & Security -> Screen Recording -> Toggle ON).
```

---

### Article 12: Low-End PC Compatibility & Hardware System Requirements
* **Title / Topic:** `Low-End PC Compatibility & Hardware System Requirements`
* **Content:**
```text
Optimized for Everyday & Low-End Computers:
- Unlike heavy cloud AI software or complex deep-learning setups, all NORVI desktop agents (Voro, Rolvio, Nexus) are lightweight and designed to run smoothly on standard laptops and budget home/office PCs.

Hardware Requirements:
- Operating System: Windows 10/11 (64-bit) OR macOS 12+ (Apple Silicon or Intel).
- Processor (CPU): Any dual-core or quad-core processor (Intel Core i3/i5/i7, AMD Ryzen 3/5/7, or Apple Silicon M-series).
- RAM (Memory): Minimum 4 GB RAM (8 GB recommended for heavy multi-tasking).
- Graphics (GPU): No expensive graphics card required! Uses standard integrated graphics (Intel Iris/UHD, AMD Radeon, Apple GPU).
- Disk Space: 300 MB to 600 MB of free storage space for application files.
- Internet Connection: Required only for initial license verification and occasional online tasks (e.g. cloud transcription models or video publishing).
```

---

### Article 13: Voro Deep-Dive: Stealth Screen Invisibility on Zoom, Meet & Teams
* **Title / Topic:** `Voro Deep-Dive: Stealth Screen Invisibility on Zoom, Meet & Teams`
* **Content:**
```text
How Voro Achieves True Invisibility:
- Voro utilizes native operating system capture exclusion APIs (such as WDA_EXCLUDEFROMCAPTURE on Windows).
- Even if an interviewer asks you to share your ENTIRE desktop screen (Full Screen Share), Voro's floating teleprompter window is completely invisible to meeting software.
- Compatible Meeting Platforms:
  * Zoom Desktop Client & Zoom Web
  * Google Meet (Chrome, Edge, Firefox)
  * Microsoft Teams (Desktop & Browser)
  * Cisco Webex, Discord, and Slack Huddles.

What the Interviewer Sees vs. What You See:
- You see: A crisp, dark floating teleprompter window displaying real-time hints, algorithmic code solutions, and interview guidance directly beside your webcam.
- Interviewer sees: Only your desktop background and code editor. Voro's window is completely absent from their screen share feed.

Stealth Hotkeys:
- Instant Hide/Unhide: Toggle Voro on or off instantly with your customizable stealth hotkey (default: Ctrl+Shift+H on Windows, Cmd+Shift+H on Mac).
- Quick Solution Trigger: Press your capture hotkey to take an instant stealth scan of the active coding problem.
```

---

### Article 14: Voro Deep-Dive: Audio Routing & Private Earpiece Whisper Setup
* **Title / Topic:** `Voro Deep-Dive: Audio Routing & Private Earpiece Whisper Setup`
* **Content:**
```text
Private Earpiece Whisper Mode:
- In addition to on-screen text answers, Voro can quietly speak answers directly into your ear in real time.
- Zero Audio Bleed: Voro routes synthesized audio output exclusively to your chosen headphones or discrete earpiece. The meeting microphone never captures or broadcasts Voro's voice to the interviewer.

How Audio Capture Works:
- Voro captures the interviewer's incoming voice directly from your system audio loopback with sub-second latency.
- It transcribes questions with high accuracy, recognizing technical jargon, data structures, behavioral questions, and Indian/international accents.

Recommended Audio Setup:
1. Plug in standard wired or Bluetooth earphones (e.g., AirPods or in-ear buds).
2. Inside Voro Settings, select your earphones as the "Output Audio Device".
3. Select your normal microphone as the input device.
4. Test the whisper volume slider to ensure it is comfortable for you while remaining inaudible to external room mics.
```

---

### Article 15: Voro Deep-Dive: Live Coding, LeetCode & Algorithmic Problem Solving
* **Title / Topic:** `Voro Deep-Dive: Live Coding, LeetCode & Algorithmic Problem Solving`
* **Content:**
```text
Live Coding & LeetCode Companion Capabilities:
- Screen-Aware Context: Voro reads the exact problem description, constraints, and function signatures visible in your browser or IDE (LeetCode, HackerRank, CodeSignal, CoderPad, VS Code).
- Optimal Solutions: Provides optimal time and space complexity algorithms (O(N), O(log N)) rather than naive brute-force solutions.
- Language Support: Generates clean, bug-free code solutions in Python, Java, C++, JavaScript, TypeScript, Go, C#, Rust, and SQL.
- Step-by-Step Explanation: Alongside the code, Voro gives you bullet points on "How to explain this to the interviewer" so you can talk through your thought process naturally while typing.

Behavioral & Resume-Grounded Answers:
- Upload your resume (PDF/text) in Voro's settings.
- When an interviewer asks behavioral questions (e.g. "Tell me about a challenging project you handled" or "Explain your system design choices"), Voro grounds its answers in your actual work experience and tech stack.
```

---

### Article 16: Rolvio Deep-Dive: LinkedIn & Indeed Auto-Apply Setup
* **Title / Topic:** `Rolvio Deep-Dive: LinkedIn & Indeed Auto-Apply Setup`
* **Content:**
```text
How Rolvio Automates Job Hunting:
- Rolvio is an autonomous career agent that searches job boards, filters matching roles, and submits applications automatically on your behalf.
- Supported Platforms: LinkedIn Easy Apply, Indeed Quick Apply, and popular company career portals.

Quick Setup Steps:
1. Launch Rolvio and configure your Job Search Profile (Target Titles, Locations, Remote vs. On-site, Expected Salary range).
2. Upload your latest master Resume (PDF format).
3. Connect your job platform session (Rolvio operates securely through a private local browser window on your machine).
4. Review matching criteria and click "Start Autonomous Hunt".

Application Control Modes:
- Fully Autonomous Mode: Rolvio evaluates job requirements against your resume, answers common application screening questions (e.g. years of experience, sponsorship needs), and submits automatically.
- Semi-Autonomous (Review First) Mode: Rolvio prepares the complete application package and pauses for you to click "Confirm & Submit" with 1 click.
```

---

### Article 17: Rolvio Deep-Dive: Anti-Bot Protection & Account Safety Shield
* **Title / Topic:** `Rolvio Deep-Dive: Anti-Bot Protection & Account Safety Shield`
* **Content:**
```text
Keeping Your LinkedIn & Indeed Accounts 100% Safe:
- Standard web scrapers or spam bots trigger account bans because they fire dozens of requests per second.
- Rolvio is built with an Anti-Bot Stealth Shield:
  1. Human-Like Typing Cadence: Types form fields with randomized micro-delays mimicking natural human keystrokes.
  2. Realistic Mouse Trajectories: Simulates natural mouse movements, scrolls, and hesitation pauses.
  3. Randomized Intervals: Enforces smart delays between consecutive applications (e.g. 60–180 seconds).
  4. Daily Quota Guard: Enforces healthy daily application limits to keep your profile within platform safe zones.
  5. Local Session Cookies: Uses your existing authenticated browser cookies locally on your computer—your account passwords are never sent to any external server.
```

---

### Article 18: Rolvio Deep-Dive: Resume Matching & Recruiter Email Tracking
* **Title / Topic:** `Rolvio Deep-Dive: Resume Matching & Recruiter Email Tracking`
* **Content:**
```text
Dynamic Resume Matching:
- Rolvio analyzes each job description to identify core keywords, required skills, and qualifications.
- It highlights your matching experience to maximize your ATS (Applicant Tracking System) score.

Visual Kanban Board:
- View all your job leads in an intuitive visual dashboard categorized by:
  * Discovered Jobs
  * Applied
  * Recruiter Viewed
  * Interview Scheduled
  * Offers Received

Automated Email Recruiter Tracking:
- Connect your job search email (Gmail or Outlook).
- Rolvio automatically monitors recruiter replies, interview invitations, and status updates, moving candidates along your Kanban board in real time without you having to sift through hundreds of automated rejection emails.
```

---

### Article 19: Nexus Deep-Dive: Vertical Video Conversion & Hormozi Subtitle Styles
* **Title / Topic:** `Nexus Deep-Dive: Vertical Video Conversion & Hormozi Subtitle Styles`
* **Content:**
```text
Transforming Long Videos into Viral Shorts:
- Nexus takes long YouTube videos, podcasts, interviews, webinars, or recorded lectures and automatically cuts them into high-converting 9:16 vertical shorts (TikTok, YouTube Shorts, Instagram Reels).
- AI Virality Scoring: Automatically analyzes audio hooks, energy peaks, and story transitions to extract the most engaging 30 to 60-second clips.

4 Designer Animated Subtitle Styles:
- Captions are animated word-by-word with high engagement presets:
  1. Hormozi Style: High-impact bold yellow, green, and white animated keywords with emoji emphasis.
  2. MrBeast Style: Punchy, large animated text designed for rapid viewer retention.
  3. Clean Creator Style: Minimalist translucent box subtitles ideal for professional and corporate videos.
  4. Neon Pop Style: Vibrant glow accents designed for gaming and entertainment clips.
- Local Rendering: Renders at crisp 1080x1920 60 FPS directly on your PC using bundled FFmpeg acceleration with zero cloud rendering wait times.
```

---

### Article 20: Nexus Deep-Dive: Face Centering & Smart Scene-Cut Snapping
* **Title / Topic:** `Nexus Deep-Dive: Face Centering & Smart Scene-Cut Snapping`
* **Content:**
```text
Smart Speaker Tracking & Scene-Cut Snapping:
- Traditional horizontal video cropping often cuts off speakers when they move or when camera angles change.
- Nexus includes Intelligent Computer Vision Tracking:
  * Dynamic Face Centering: Automatically detects the active speaker's face and keeps them perfectly centered in the 9:16 vertical viewport.
  * Instant Scene Snapping: When the video cuts to a different speaker in an interview or podcast, Nexus snaps the camera view instantly without dizzying sliding effects.
  * Split-Screen Layouts: For two-person interviews or reaction videos, Nexus can automatically generate a stacked split-screen (top speaker, bottom speaker) with 1 click.
```

---

### Article 21: Nexus Deep-Dive: Auto-Publishing to YouTube, TikTok & Reels
* **Title / Topic:** `Nexus Deep-Dive: Auto-Publishing to YouTube, TikTok & Reels`
* **Content:**
```text
Hands-Free Multi-Platform Publishing:
- Once Nexus generates your vertical clips, you do not need to download them to your phone and upload them manually.
- Direct Social Publishing Features:
  * YouTube Shorts: Uploads with auto-generated titles, viral descriptions, and hashtags via the official YouTube API.
  * TikTok: Direct publishing to your TikTok business or personal creator account.
  * Instagram Reels: Automated publishing to your linked Instagram profile.
- Scheduling Engine: Schedule an entire week of shorts to publish at peak engagement times automatically.
- Direct PC Video Import: In addition to YouTube links, you can drag and drop raw MP4, MOV, or MKV files directly from your computer for instant processing without cloud upload bottlenecks.
```

---

### Article 22: 1-Day Free Trial: Activation & Terms of Access
* **Title / Topic:** `1-Day Free Trial: Activation & Terms of Access`
* **Content:**
```text
1-Day Free Trial Overview:
- Prospective customers can explore our desktop agents with a risk-free 1-Day (24-Hour) Free Trial.
- How to Claim Your Trial:
  1. Click "1-Day Free Trial" on any agent card on the NORVI homepage (https://nor-vi.in).
  2. Create a free account with your email.
  3. Your trial activation key is generated instantly in your dashboard under "Keys & devices".
  4. Download the installer, enter your trial key, and explore full agent capabilities for 24 hours.
- Zero Surprise Auto-Debits: No credit card is required to test the trial. When the 24-hour trial expires, the agent simply pauses until you choose to unlock a 1-Month, 3-Month, or Lifetime license.
```

---

### Article 23: Partner & Affiliate Program: Referral Commissions & Payouts
* **Title / Topic:** `Partner & Affiliate Program: Referral Commissions & Payouts`
* **Content:**
```text
NORVI Partner Program Details:
- Location: https://nor-vi.in/partners (or "/account/partner" in your dashboard).
- Commission Rate: Earn a generous 15% cash commission on every successful customer purchase made using your referral link or code.
- Audience Discount: Your referred audience gets an exclusive 10% discount across all agent license tiers.
- Tracking & Cookies: 30-day cookie window. Even if a visitor returns days later to complete checkout, your referral is credited.
- Payout Schedule & Methods:
  * Minimum payout threshold: ₹1,000.
  * Payouts are transferred directly via UPI or direct bank transfer on the 1st of every month.
  * Track clicks, conversions, and pending payouts in your real-time partner dashboard.
```

---

### Article 24: Account Security, MFA & Password Recovery
* **Title / Topic:** `Account Security, MFA & Password Recovery`
* **Content:**
```text
Managing Your Account & Security:
- Password Reset: If you forget your password, visit https://nor-vi.in/reset-password. Enter your registered email to receive an instant, secure password reset link.
- Email Verification: If you haven't received your verification email upon registration, visit https://nor-vi.in/verify-email to trigger a new link.
- Two-Factor Authentication (MFA): Add an extra layer of protection to your licenses by enabling an authenticator app (Google Authenticator, Authy) under "/account/security".
- Account Deletion & Data Rights: In accordance with Indian data privacy standards, you can permanently delete your account and purge all personal records directly under "/account/settings".
```

---

### Article 25: Network, VPN, Firewall & Antivirus Troubleshooting
* **Title / Topic:** `Network, VPN, Firewall & Antivirus Troubleshooting`
* **Content:**
```text
Resolving Corporate Network & Firewall Restrictions:
- When running NORVI agents on corporate, university, or secured enterprise Wi-Fi:
  * Ensure standard HTTPS port 443 is open for license validation to https://nor-vi.in.
  * If using a corporate VPN (Zscaler, Cisco AnyConnect) or web proxy, add an exclusion rule for "nor-vi.in" to prevent SSL handshake timeouts.

Antivirus False Positives:
- Some third-party antivirus suites (e.g. Avast, McAfee, QuickHeal) flag newly updated AI tools before definitions update.
- If your antivirus blocks an agent binary:
  1. Open your antivirus quarantine or protection history.
  2. Select the NORVI agent executable and click "Restore & Add to Exclusions".
  3. NORVI binaries are clean, secure, and contain zero spyware or ad trackers.
```

---

### Article 26: Legal Compliance, Terms of Service & Grievance Officer Information
* **Title / Topic:** `Legal Compliance, Terms of Service & Grievance Officer Information`
* **Content:**
```text
Legal Compliance & Company Details:
- Legal Entity: Norvi AI Agency, registered in India.
- Jurisdiction: All terms and disputes are subject to the exclusive legal jurisdiction of the courts in Gwalior, Madhya Pradesh, India.
- Governing Law: Governed by the Information Technology Act 2000 and applicable digital commerce guidelines of India.

Statutory Grievance Officer:
- In accordance with the Information Technology Act 2000 and rules made thereunder:
  * Name: Gopal Ji Yadav
  * Email: Gopal2nd5654@gmail.com
  * Phone: +91-6397916325
  * Address: Norvi AI Agency, Kunj Vihar, Gole ka mandir, Gwalior, Madhya Pradesh, India, 474005.
- For business partnerships, media inquiries, or general support:
  * Founder: Chirag Sharma
  * Email: norviagency@gmail.com
  * Direct Phone / WhatsApp: +91-9893534314
```
