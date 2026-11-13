export type Role = 'owner' | 'administrator' | 'product_manager' | 'support' | 'customer';
export type Category = { id: string; slug: string; name: string; createdAt?: string };
export type FeaturePillar = { id: string; title: string; description: string; icon?: string; tag?: string; mediaUrl?: string | null; };
export type MediaGalleryItem = { id: string; type: 'image' | 'video' | 'gif'; url: string; caption?: string; };
export type ComparisonRow = { feature: string; us: boolean | string; comp1: boolean | string; comp2: boolean | string; };
export type CompetitorComparison = { headline?: string; competitor1Name: string; competitor2Name: string; rows: ComparisonRow[]; };
export type WorkflowStep = { step: string; title: string; description: string; };
export type AgentFaq = { question: string; answer: string; };
export type AgentSeo = { metaTitle?: string; metaDescription?: string; focusKeywords?: string; ogImage?: string | null; };
export type GuideSection = { id: string; heading: string; content: string; imageUrl?: string | null; };
export type AgentGuide = { videoUrl?: string | null; summary?: string | null; sections: GuideSection[]; };
export type AgentExtendedContent = {
  subHeading?: string;
  badgeText?: string;
  heroMediaUrl?: string | null;
  heroMediaType?: 'video' | 'gif' | 'image';
  platformBadges?: string[];
  featurePillars?: FeaturePillar[];
  gallery?: MediaGalleryItem[];
  comparison?: CompetitorComparison;
  workflowSteps?: WorkflowStep[];
  faqs?: AgentFaq[];
  seo?: AgentSeo;
  guide?: AgentGuide;
};
export type Product = { id: string; slug: string; name: string; categoryId: string; category?: Category | null; subHeading?: string; tagline: string; description: string; price: string; price1m?: string; price3m?: string; price_lifetime?: string; is_on_sale?: boolean; trialActive?: boolean; aiUsage?: string; deviceAllowance?: string; status: 'draft' | 'published' | 'archived'; releaseStatus: 'development' | 'prelaunch' | 'live'; logoUrl: string | null; icon?: string; color?: string; features: string[]; version: string; requirements: string; workflowHeading: string; workflowDescription: string; workflowMediaUrl: string | null; workflowNote: string; updatedAt?: string; extendedContent?: AgentExtendedContent; };
export type User = { id: string; name: string; email: string; role: Role; status: 'active' | 'suspended'; createdAt: string; lastLogin: string | null };
export type License = { id: string; userId: string; productId: string; status: 'active' | 'revoked'; keyHash: string; encryptedKey: string; suffix: string; createdAt: string; device: string | null; expiresAt: string | null };
export type Order = { id: string; userId: string; productId: string; status: 'simulated' | 'refunded' | 'pending' | 'paid' | 'failed'; amount: string; createdAt: string; licenseId: string };
export type Audit = { id: string; actor: string; action: string; target: string; createdAt: string };
export type Ticket = { id: string; userId: string; subject: string; message: string; status: 'open' | 'closed'; createdAt: string };
export type Invite = { id: string; email: string; role: Role; status: 'pending' | 'revoked'; createdAt: string };
export type Settings = { name: string; headline: string; description: string; email: string; company: string; domain: string; maintenanceMode: boolean; permissions: Record<string, string[]>; bannerText?: string; saleActive?: boolean; salePercentage?: number; socialInstagram?: string; socialYoutube?: string; socialFacebook?: string; socialTwitter?: string; };
export type Announcement = { id: string; authorId: string; audience: 'customer' | 'team'; message: string; createdAt: string };
export type Store = { categories: Category[]; products: Product[]; users: User[]; licenses: License[]; orders: Order[]; audit: Audit[]; tickets: Ticket[]; invitations: Invite[]; settings: Settings; emails: { id: string; userId: string; orderId: string; status: string; createdAt: string }[]; announcements: Announcement[] };
export const settings: Settings = { name: 'NORVI', headline: 'Less busywork.\nMore possibility.', description: 'Make room for the work that matters. Discover AI agents built to take everyday tasks off your hands.', email: 'chiragsharmawork95@gmail.com', company: 'name_Company', domain: 'domain_Website', maintenanceMode: false, permissions: { owner: ['*'], administrator: ['', '/products', '/releases', '/categories', '/customers', '/licenses', '/orders', '/subscriptions', '/announcements', '/content', '/activity'], product_manager: ['', '/products', '/releases', '/categories', '/announcements', '/content'], support: ['', '/customers', '/licenses', '/orders', '/announcements'] } };
export const categories: Category[] = [
  { id: 'cat-1', slug: 'desktop-automation', name: 'Desktop automation' },
  { id: 'cat-2', slug: 'interview-assistance', name: 'Interview assistance' },
  { id: 'cat-3', slug: 'job-search-automation', name: 'Job-search automation' }
];



export const products: Product[] = [
  {
    id: "agent-1",
    slug: "omnix",
    name: "Omnix",
    categoryId: "cat-1",
    subHeading: "Voice Desktop Agent",
    category: { id: 'cat-1', slug: 'desktop-automation', name: 'Desktop automation' },
    tagline: "Speak your next task into action.",
    description: "A voice-first desktop agent being developed to understand natural-language instructions, plan tasks, and operate your computer. Capabilities and supported environments will be confirmed through release testing.",
    price: "Pricing to be confirmed",
    status: "published",
    releaseStatus: "development",
    logoUrl: null,
    features: [
      "Voice-first task instructions",
      "Task planning and computer interaction",
      "Release scope under development"
    ],
    version: "In development",
    requirements: "Supported operating systems and hardware requirements to be confirmed.",
    workflowHeading: "Built for your workflow.",
    workflowDescription: "A voice-first desktop agent being developed to understand natural-language instructions, plan tasks, and operate your computer. Capabilities and supported environments will be confirmed through release testing.",
    workflowMediaUrl: null,
    workflowNote: "",
    updatedAt: "2026-09-23"
  },
  {
    id: "agent-2",
    slug: "voro",
    name: "Voro",
    categoryId: "cat-2",
    subHeading: "Interview Assistant",
    category: { id: 'cat-2', slug: 'interview-assistance', name: 'Interview assistance' },
    tagline: "Bring context to your interview preparation.",
    description: "An interview assistant with screen and audio context, résumé memory, and coding assistance. Designed for practice and situations where assistance is permitted. The application is reported complete; the NORVI release and compatibility checks are still being prepared.",
    price: "Pricing to be confirmed",
    status: "published",
    releaseStatus: "prelaunch",
    logoUrl: null,
    features: [
      "Screen and audio context",
      "Résumé and conversation memory",
      "Zero-setup NORVI Cloud AI",
      "Coding assistance"
    ],
    version: "Release version to be confirmed",
    requirements: "Windows-oriented application. Supported Windows versions and audio setup documented in the setup guide.",
    workflowHeading: "Built for your workflow.",
    workflowDescription: "An interview assistant with screen and audio context, résumé memory, and coding assistance. Designed for practice and situations where assistance is permitted. The application is reported complete; the NORVI release and compatibility checks are still being prepared.",
    workflowMediaUrl: null,
    workflowNote: "",
    updatedAt: "2026-09-23",
    extendedContent: {
      badgeText: "⚡ Ultra-Low Latency | 100% Undetectable | Managed Cloud AI",
      platformBadges: ["Zoom", "Microsoft Teams", "Google Meet", "HackerRank", "LeetCode", "CoderPad"],
      featurePillars: [
        {
          id: "voro-p1",
          title: "Hardware-Routed Audio Stealth",
          tag: "Undetectable",
          icon: "ShieldCheck",
          description: "Bypasses Windows Media Foundation capture hooks. Audio routes directly to your private earpiece so no call participants ever hear it."
        },
        {
          id: "voro-p2",
          title: "Screen-Aware Multimodal OCR",
          tag: "Live Vision",
          icon: "ScanEye",
          description: "Reads coding problems, diagrams, and formulas directly off your active screen in real-time."
        },
        {
          id: "voro-p3",
          title: "Résumé & Coding Copilot",
          tag: "Tailored Answers",
          icon: "Bot",
          description: "Tailors generated answers to your exact background, past projects, and solves live coding challenges with optimal time complexity."
        }
      ],
      comparison: {
        headline: "Why Voro Outperforms the Alternatives",
        competitor1Name: "Parakeet.ai",
        competitor2Name: "ChatGPT / Web AI",
        rows: [
          { feature: "Invisible on Screen Share", us: true, comp1: true, comp2: false },
          { feature: "Hardware Audio Bypass", us: true, comp1: false, comp2: false },
          { feature: "Zero-Setup Managed Cloud AI", us: true, comp1: false, comp2: false },
          { feature: "Pricing Model", us: "From ₹499 / Lifetime", comp1: "$149.90 / month", comp2: "$20 / month" },
          { feature: "LeetCode & Code Assistant", us: true, comp1: true, comp2: true }
        ]
      },
      workflowSteps: [
        { step: "01", title: "Launch & Enter Key", description: "Open Voro on your Windows PC. It silently sits in your system tray." },
        { step: "02", title: "Load Context", description: "Paste your target job description or résumé so answers are tailored to your real experience." },
        { step: "03", title: "Join Meeting", description: "Open Zoom, Teams, or HackerRank. Voro listens and projects instant answers to your private HUD." }
      ],
      faqs: [
        { question: "Will Zoom, Teams, or Google Meet detect Voro?", answer: "No. Voro utilizes hardware-level overlay layering that is completely invisible to screen-sharing capture software." },
        { question: "Can interviewers hear Voro voice output?", answer: "No. Voro routes audio exclusively to your selected headphone output, bypassing Windows recording hooks." },
        { question: "Do I need to configure my own AI keys or local servers?", answer: "No. Cloud AI intelligence is included and managed automatically through your NORVI license with zero extra AI keys required." }
      ],
      seo: {
        metaTitle: "Voro - #1 Real-Time AI Interview Assistant & Coding Copilot | Undetectable",
        metaDescription: "Nail your live interviews with Voro: the #1 real-time AI interview assistant with screen awareness, invisible audio routing, and live coding support. Try free.",
        focusKeywords: "interview assistant agent, real time ai interview assistant, ai interview copilot, leetcode ai helper, parakeet ai alternative, voro ai"
      },
      guide: {
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        sections: [
          {
            id: "guide-step-1",
            heading: "1. Download and Extract Voro",
            content: "Click the Download button from your agent collection. Extract the downloaded zip package into your preferred folder on Windows.",
            imageUrl: null
          },
          {
            id: "guide-step-2",
            heading: "2. Activate With Your License Key",
            content: "Launch Voro.exe. When prompted, click 'View license' in your NORVI dashboard, copy your unique product activation key, and paste it into the application.",
            imageUrl: null
          },
          {
            id: "guide-step-3",
            heading: "3. Configure Audio & Stealth Overlay",
            content: "Open Settings inside Voro and select your audio device. The stealth overlay automatically runs in a private layer invisible to Zoom, Teams, and Google Meet screen shares.",
            imageUrl: null
          }
        ]
      }
    }
  },
  {
      "id": "agent-3",
      "slug": "rolvio",
      "name": "Rolvio",
      "categoryId": "cat-3",
      "subHeading": "Autonomous Career Agent",
      "category": { id: 'cat-3', slug: 'job-search-automation', name: 'Job-search automation' },
      "tagline": "The Autonomous AI Career Agent & Desktop Job-Search Engine",
      "description": "An end-to-end autonomous AI career agent that automates your entire job hunt. Features AI resume parsing, ATS skill matching, stealth multi-platform auto-applying across LinkedIn, Indeed, Naukri, Internshala, and Wellfound, strict DOM verification, and background IMAP email interview tracking.",
      "price": "₹499",
      "status": "published",
      "releaseStatus": "live",
      "logoUrl": null,
      "features": [
          "Multi-Platform Stealth Auto-Apply (LinkedIn, Indeed, Naukri, Internshala, Wellfound)",
          "NORVI Cloud AI Resume Parsing & ATS Match Scoring",
          "Intelligent Dynamic CTC, Notice Period & Screening Question Engine",
          "Zero-False-Positive DOM-Level Proof of Submission Verification",
          "Automated IMAP Recruiter Response & Interview Radar",
          "Dark-Mode Mission Control Kanban Dashboard"
      ],
      "version": "v1.0.0 Stable",
      "requirements": "Windows 10/11 64-bit, 8GB RAM, Google Chrome / Chromium. Zero local AI setup required.",
      "workflowHeading": "Autonomous career automation, from discovery to interview.",
      "workflowDescription": "Rolvio operates silently on your desktop. It discovers high-match jobs across 5 platforms, uses NORVI Cloud AI to answer screening questions with precision, submits applications using stealth browser automation, and tracks recruiter interview invites in a real-time Kanban board.",
      "workflowMediaUrl": null,
      "workflowNote": "Includes native Windows installer, automatic updates, and SQLite local encrypted answer vault.",
      "updatedAt": "2026-09-23",
      "extendedContent": {
          "badgeText": "⚡ 100% Stealth Playwright | Managed Cloud AI | 5 Global Job Platforms",
          "platformBadges": [
              "LinkedIn",
              "Indeed",
              "Naukri",
              "Internshala",
              "Wellfound",
              "Google Chrome",
              "Windows 11"
          ],
          "featurePillars": [
              {
                  "id": "rolvio-p1",
                  "title": "NORVI Cloud AI & ATS Precision Fit Scorer",
                  "tag": "Zero Local Setup",
                  "icon": "Bot",
                  "description": "Powered by NORVI Cloud AI with zero local runtime downloads. Rolvio ingests your master resume, filters mismatched jobs locally, scores compatibility out of 100, and tailors screening answers to your real experience."
              },
              {
                  "id": "rolvio-p2",
                  "title": "Stealth Playwright Multi-Platform Engine",
                  "tag": "Anti-Bot Resilient",
                  "icon": "Shield",
                  "description": "Bypasses detection by running directly in your authenticated browser sessions across LinkedIn, Indeed, Naukri, Internshala, and Wellfound. Employs human typing cadence, bezier curve mouse jitter, and automated session recovery."
              },
              {
                  "id": "rolvio-p3",
                  "title": "Strict DOM Verification & Memory Vault",
                  "tag": "Zero False Positives",
                  "icon": "Zap",
                  "description": "No hallucinated submissions. Rolvio strictly verifies confirmation dialogs, post-submission URLs, and dismiss prompts before marking an application sent. Persists answers in a local SQLite memory vault to prevent duplicate submissions."
              },
              {
                  "id": "rolvio-p4",
                  "title": "Mission Control Kanban & IMAP Interview Radar",
                  "tag": "Inbox Automation",
                  "icon": "Layers",
                  "description": "Never update a spreadsheet again. Rolvio monitors your email inbox via secure IMAP, extracts recruiter replies, categorizes coding tests and interview invitations, and advances job cards dynamically across a visual Kanban board."
              }
          ],
          "comparison": {
              "headline": "Why Candidates Choose Rolvio Over Bot Extensions",
              "competitor1Name": "LazyApply / Sonara",
              "competitor2Name": "Manual Job Applications",
              "rows": [
                  {
                      "feature": "Custom Screening Question Handling",
                      "us": "AI Context-Aware (Resume-Grounded)",
                      "comp1": "Basic regex / Fails on complex forms",
                      "comp2": "Tedious manual typing"
                  },
                  {
                      "feature": "Submission Proof & Verification",
                      "us": "Strict DOM Modal & Confirmation Check",
                      "comp1": "Unverified button clicks",
                      "comp2": "Manual visual verification"
                  },
                  {
                      "feature": "AI Runtime & Privacy",
                      "us": "Managed NORVI Cloud AI (Zero Local Setup)",
                      "comp1": "Cloud-hosted (Data privacy risk)",
                      "comp2": "N/A"
                  },
                  {
                      "feature": "Platform Support",
                      "us": "LinkedIn, Indeed, Naukri, Internshala, Wellfound",
                      "comp1": "LinkedIn / Indeed only",
                      "comp2": "All (Hours of tab switching)"
                  },
                  {
                      "feature": "Inbox & Interview Radar",
                      "us": "Automated IMAP Email Categorization",
                      "comp1": "No email integration",
                      "comp2": "Manual inbox checking"
                  },
                  {
                      "feature": "Anti-Detection Protection",
                      "us": "Native Playwright + Bezier Jitter & Human Delays",
                      "comp1": "Standard Chrome extensions (Flagged easily)",
                      "comp2": "Natural human"
                  },
                  {
                      "feature": "Persistent Answer Memory",
                      "us": "Local SQLite QA Vault (Learns & Deduplicates)",
                      "comp1": "None",
                      "comp2": "Copy-paste notes"
                  },
                  {
                      "feature": "Pricing Model",
                      "us": "From ₹499 / Lifetime Available (INR)",
                      "comp1": "$150 - $250 / month (USD)",
                      "comp2": "Hours of daily unpaid labor"
                  }
              ]
          },
          "workflowSteps": [
              {
                  "step": "01",
                  "title": "Ingest Profile & Set Preferences",
                  "description": "Upload your resume and set target job titles, locations, CTC range, and minimum ATS match score."
              },
              {
                  "step": "02",
                  "title": "Autonomous Radar & Scoring",
                  "description": "Rolvio scans 5 platforms, filters irrelevant listings locally, and uses NORVI Cloud AI to score matching roles against your resume."
              },
              {
                  "step": "03",
                  "title": "Stealth Execution & Interview Tracking",
                  "description": "Launch 1-click stealth auto-apply and let Rolvio handle applications and sync incoming recruiter interview emails to your Kanban."
              }
          ],
          "faqs": [
              {
                  "question": "Will LinkedIn, Indeed, or Naukri detect or ban my account?",
                  "answer": "No. Unlike browser extensions that inject unsafe scripts into the DOM or headless cloud bots with datacenter IP addresses, Rolvio runs on your local desktop using Microsoft Playwright. It leverages your existing, authenticated browser session cookies and mimics natural human behavior—including randomized bezier mouse curves, variable typing delays (50–120ms per keystroke), and human-like inspection pauses. If a CAPTCHA ever appears, Rolvio pauses and alerts you to solve it naturally before resuming seamlessly."
              },
              {
                  "question": "How does Rolvio handle complex screening questions like CTC, notice period, and experience?",
                  "answer": "Rolvio uses an intelligent dual-engine approach. For standard questions (notice period, current CTC, expected CTC, years of experience, legal authorization), it dynamically computes and formats the exact numerical or text answer based on your Master Profile. For subjective screening questions (\"Why do you want to work here?\", \"Describe your experience with distributed systems\"), Rolvio's AI Brain generates grounded answers strictly referencing your uploaded resume. All answers are cached in an encrypted local SQLite database so questions are never repeatedly re-prompted."
              },
              {
                  "question": "Do I have to configure AI API keys or install local models?",
                  "answer": "No! Cloud AI resume parsing, ATS scoring, and screening answers are included automatically with your active NORVI license with zero local AI software or personal API keys required."
              },
              {
                  "question": "Can I review and approve job applications before Rolvio submits them?",
                  "answer": "Yes. Rolvio features dual execution modes: \"Review Queue Mode\" and \"1-Click Autonomous Stealth Mode\". In Review Queue Mode, all matched jobs are queued in your Pending Review tab with ATS match scores, allowing you to approve, skip, or modify applications one-by-one. Once you trust the criteria, switch to Autonomous Mode and let Rolvio process your approved queue in the background while you focus on interview prep."
              },
              {
                  "question": "How does Rolvio guarantee that an application was actually submitted?",
                  "answer": "Rolvio features strict, zero-false-positive DOM verification. Rather than merely clicking a \"Submit\" button and assuming success, Rolvio monitors the browser state to confirm submission modals, \"Application Submitted\" headers, post-submission redirect URLs, or dismiss confirmation dialogs. If an unexpected error or incomplete question blocks submission, the job is flagged for your review instead of being falsely recorded as applied."
              },
              {
                  "question": "How does the IMAP email and interview tracking work?",
                  "answer": "Rolvio connects securely via standard IMAP to your job-search email inbox (e.g., Gmail, Outlook, Yahoo) using encrypted credentials or app passwords. Its background worker checks exclusively for new unread messages from recruiters. When an email arrives, the AI parses the sender, company name, and email context to determine if it is an interview invitation, a technical assessment, or a rejection—automatically updating the application status in your Mission Control Kanban board."
              },
              {
                  "question": "Is my personal data, resume, and login credentials safe?",
                  "answer": "Completely. Rolvio is a privacy-first, desktop-native application. Your resumes, profile details, session cookies, application history, and API keys are stored locally on your machine in an encrypted SQLite database. NORVI does not harvest, store, or sell your personal career data."
              },
              {
                  "question": "Can I transfer my Rolvio license to a new computer?",
                  "answer": "Yes. Every NORVI license includes hardware device management. If you switch or format your computer, simply log into your NORVI customer dashboard at nor-vi.in/account/licenses, click \"Release device\", and activate Rolvio on your new machine with your existing activation key."
              }
          ],
          "seo": {
              "metaTitle": "Rolvio - #1 Autonomous AI Job Hunter & Career Agent | Stealth Playwright",
              "metaDescription": "Automate your job search with Rolvio: the #1 desktop AI job hunter. Stealth auto-apply across LinkedIn, Indeed, Naukri, Internshala & Wellfound with managed Cloud AI & IMAP interview radar.",
              "focusKeywords": "ai job applicant agent, automated job application, auto apply linkedin, indeed auto apply bot, rolvio ai, job hunt automation, playwright job applicant"
          },
          "guide": {
              "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              "sections": [
                  {
                      "id": "guide-step-1",
                      "heading": "1. Download & Install Rolvio Desktop",
                      "content": "Download the official Rolvio Windows installer (.exe or .zip) from your NORVI dashboard under \"My agents\". Run the installer and launch Rolvio from your desktop shortcut or Start Menu.",
                      "imageUrl": null
                  },
                  {
                      "id": "guide-step-2",
                      "heading": "2. Activate With Your NORVI License Key",
                      "content": "On first launch, Rolvio will prompt you for your Product Activation Key. Navigate to nor-vi.in/account/licenses in your browser, click \"Reveal key\" next to Rolvio, copy your key (e.g., NORVI-XXXX-XXXX-XXXX-XXXX), and paste it into the application to link your device.",
                      "imageUrl": null
                  },
                  {
                      "id": "guide-step-3",
                      "heading": "3. Automatic Cloud AI Activation",
                      "content": "Once you log in and activate your Rolvio license key, NORVI Cloud AI connects automatically — no Ollama installation or third-party AI API keys needed.",
                      "imageUrl": null
                  },
                  {
                      "id": "guide-step-4",
                      "heading": "4. Upload Resume & Build Your Master Profile",
                      "content": "Go to the Profile tab. Click \"Upload Resume\" (PDF or DOCX). Rolvio's AI will parse your technical skills, work history, and contact details. Fill in your compensation parameters (Current CTC, Expected CTC), notice period, and preferred work arrangements (Remote, Hybrid, On-site). This profile serves as the single source of truth for screening questions.",
                      "imageUrl": null
                  },
                  {
                      "id": "guide-step-5",
                      "heading": "5. Connect Your Job Platform Sessions",
                      "content": "Go to the Platforms tab. Click \"Connect\" next to the platforms you want Rolvio to operate on (LinkedIn, Indeed, Naukri, Internshala, Wellfound). A secure browser window will open—simply log into your account normally. Rolvio captures and encrypts your session cookies locally, allowing it to apply under your verified identity without ever asking for your passwords.",
                      "imageUrl": null
                  },
                  {
                      "id": "guide-step-6",
                      "heading": "6. Configure Job Discovery Radar & ATS Match Threshold",
                      "content": "Go to the Radar tab. Add your target job titles (e.g., \"Full Stack Developer\", \"Data Engineer\", \"Product Designer\") and locations. Set your minimum ATS Match Threshold (e.g., 75%). When Discovery runs, Rolvio scrapes matching postings, evaluates each description against your resume, and only approves jobs that meet your criteria.",
                      "imageUrl": null
                  },
                  {
                      "id": "guide-step-7",
                      "heading": "7. Launch Autonomous Stealth Auto-Apply",
                      "content": "Review your matched jobs in the \"Pending Review\" queue or head straight to \"Mission Control\" and click \"Start Autonomous Engine\". Rolvio will launch its stealth Playwright automation, fill application forms with human-like typing and mouse movements, handle screening questions, verify DOM submission confirmation, and log screenshots of every successful application.",
                      "imageUrl": null
                  },
                  {
                      "id": "guide-step-8",
                      "heading": "8. Connect IMAP Email & Track Real-Time Interviews",
                      "content": "In Settings, enter your IMAP email details (such as your Gmail App Password). Rolvio will silently monitor incoming recruiter responses in the background. As interview invites, coding tests, and status updates arrive, Rolvio categorizes them and moves company cards automatically on your Mission Control Kanban board.",
                      "imageUrl": null
                  }
              ]
          }
      },
      "icon": "sparkles",
      "color": "purple",
      "price1m": "499",
      "price3m": "999",
      "price_lifetime": "1999",
      "aiUsage": "Managed NORVI Cloud AI included with your active license — zero local AI downloads or third-party keys needed.",
      "deviceAllowance": "1 active desktop device per license. Manage and release devices instantly in your NORVI dashboard."
  }
];
export function seed(): Store {
  const date = '2026-09-22T09:00:00.000Z';
  return { categories: structuredClone(categories), products: structuredClone(products), settings: { ...settings }, users: [
    { id: 'preview-owner', name: 'name_Owner', email: 'owner@example.invalid', role: 'owner', status: 'active', createdAt: date, lastLogin: null },
    { id: 'preview-customer', name: 'name_Customer', email: 'customer@example.invalid', role: 'customer', status: 'active', createdAt: date, lastLogin: null },
    { id: 'preview-nonbuyer', name: 'name_Visitor', email: 'visitor@example.invalid', role: 'customer', status: 'active', createdAt: date, lastLogin: date },
    { id: 'preview-support', name: 'name_Support', email: 'support@example.invalid', role: 'support', status: 'active', createdAt: date, lastLogin: null },
    { id: 'preview-product', name: 'name_Editor', email: 'editor@example.invalid', role: 'product_manager', status: 'active', createdAt: date, lastLogin: null },
  ], licenses: [], orders: [], audit: [], tickets: [], invitations: [], emails: [], announcements: [] };
}
export const routes = ['', 'agents', 'agents/agent-1', 'agents/agent-2', 'agents/agent-3', 'pricing', 'about', 'contact', 'help', 'privacy', 'terms', 'refunds', 'delivery', 'license', 'register', 'login', 'verify-email', 'reset-password', 'update-password', 'auth/confirm', 'account/security', 'onboarding', 'account', 'account/agents', 'account/licenses', 'account/billing', 'account/settings', 'account/support', 'checkout/agent-1', 'checkout/agent-2', 'checkout/agent-3', 'orders', 'admin', 'admin/login', 'admin/customers', 'admin/licenses', 'admin/orders', 'admin/inquiries', 'admin/subscriptions', 'admin/products', 'admin/releases', 'admin/categories', 'admin/announcements', 'admin/activity', 'admin/settings', 'admin/team', 'admin/content'];
