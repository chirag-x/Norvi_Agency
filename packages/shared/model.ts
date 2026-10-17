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
export type Product = { id: string; slug: string; name: string; categoryId: string; category?: Category; tagline: string; description: string; price: string; price1m?: string; price3m?: string; price_lifetime?: string; is_on_sale?: boolean; trialActive?: boolean; aiUsage?: string; deviceAllowance?: string; status: 'draft' | 'published' | 'archived'; releaseStatus: 'development' | 'prelaunch' | 'live'; logoUrl: string | null; features: string[]; version: string; requirements: string; workflowHeading: string; workflowDescription: string; workflowMediaUrl: string | null; workflowNote: string; updatedAt?: string; extendedContent?: AgentExtendedContent; };
export type User = { id: string; name: string; email: string; role: Role; status: 'active' | 'suspended'; createdAt: string; lastLogin: string | null };
export type License = { id: string; userId: string; productId: string; status: 'active' | 'revoked'; keyHash: string; encryptedKey: string; suffix: string; createdAt: string; device: string | null; expiresAt: string | null };
export type Order = { id: string; userId: string; productId: string; status: 'simulated' | 'refunded' | 'pending' | 'paid' | 'failed'; amount: string; createdAt: string; licenseId: string };
export type Audit = { id: string; actor: string; action: string; target: string; createdAt: string };
export type Ticket = { id: string; userId: string; subject: string; message: string; status: 'open' | 'closed'; createdAt: string };
export type Invite = { id: string; email: string; role: Role; status: 'pending' | 'revoked'; createdAt: string };
export type Settings = { name: string; headline: string; description: string; email: string; company: string; domain: string; maintenanceMode: boolean; permissions: Record<string, string[]>; bannerText?: string; saleActive?: boolean; salePercentage?: number; socialInstagram?: string; socialYoutube?: string; socialFacebook?: string; socialTwitter?: string; };
export type Announcement = { id: string; authorId: string; audience: 'customer' | 'team'; message: string; createdAt: string };
export type Store = { categories: Category[]; products: Product[]; users: User[]; licenses: License[]; orders: Order[]; audit: Audit[]; tickets: Ticket[]; invitations: Invite[]; settings: Settings; emails: { id: string; userId: string; orderId: string; status: string; createdAt: string }[]; announcements: Announcement[] };
export const settings: Settings = { name: 'NORVI', headline: 'Less busywork.\nMore possibility.', description: 'Make room for the work that matters. Discover AI agents built to take everyday tasks off your hands.', email: 'chiragsharmawork95@gmail.com', company: 'name_Company', domain: 'domain_Website', maintenanceMode: false, permissions: { owner: ['*'], administrator: ['', '/products', '/categories', '/customers', '/licenses', '/orders', '/subscriptions', '/announcements', '/content', '/activity'], product_manager: ['', '/products', '/categories', '/announcements', '/content'], support: ['', '/customers', '/licenses', '/orders', '/announcements'] } };
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
      "Local and cloud AI options",
      "Coding assistance"
    ],
    version: "Release version to be confirmed",
    requirements: "Windows-oriented application. Supported Windows versions, audio setup, and local-model hardware requirements need verification.",
    workflowHeading: "Built for your workflow.",
    workflowDescription: "An interview assistant with screen and audio context, résumé memory, and coding assistance. Designed for practice and situations where assistance is permitted. The application is reported complete; the NORVI release and compatibility checks are still being prepared.",
    workflowMediaUrl: null,
    workflowNote: "",
    updatedAt: "2026-09-23",
    extendedContent: {
      badgeText: "⚡ Ultra-Low Latency | 100% Undetectable | Local & Cloud AI",
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
          { feature: "100% Offline / Local Execution", us: true, comp1: false, comp2: false },
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
        { question: "Can I use my own Gemini or OpenAI API keys?", answer: "Yes. Voro supports Bring-Your-Own-Key (BYOK) for zero token markups, as well as 100% offline local models (Ollama)." }
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
    id: "agent-3",
    slug: "rolvio",
    name: "Rolvio",
    categoryId: "cat-3",
    category: { id: 'cat-3', slug: 'job-search-automation', name: 'Job-search automation' },
    tagline: "Your next role, with less routine.",
    description: "Discover relevant openings, compare job descriptions with your résumé, assist with applications, and track responses in a Kanban workspace. The application is reported complete; supported-platform testing and the NORVI release are being prepared. Applications require your authorization and accurate profile information.",
    price: "Pricing to be confirmed",
    status: "published",
    releaseStatus: "prelaunch",
    logoUrl: null,
    features: [
      "Job discovery and résumé-fit scoring",
      "Application workflow and duplicate detection",
      "Email response tracking",
      "Kanban application dashboard"
    ],
    version: "Release version to be confirmed",
    requirements: "Python application with a browser-driven workflow. Packaged installer, supported systems, AI provider setup, and email requirements to be confirmed.",
    workflowHeading: "Built for your workflow.",
    workflowDescription: "Discover relevant openings, compare job descriptions with your résumé, assist with applications, and track responses in a Kanban workspace. The application is reported complete; supported-platform testing and the NORVI release are being prepared. Applications require your authorization and accurate profile information.",
    workflowMediaUrl: null,
    workflowNote: "",
    updatedAt: "2026-09-23",
    extendedContent: {
      badgeText: "🚀 Automated Applications | Resume Matching | Smart Follow-up",
      platformBadges: ["LinkedIn", "Indeed", "Wellfound", "Glassdoor", "ZipRecruiter"],
      featurePillars: [
        {
          id: "rolvio-p1",
          title: "Smart Resume Matching",
          tag: "High ATS Fit",
          icon: "Bot",
          description: "Analyzes job descriptions and matches your resume skills with precision before applying."
        },
        {
          id: "rolvio-p2",
          title: "Browser-Driven Auto-Apply",
          tag: "Hands-Free",
          icon: "Zap",
          description: "Automatically fills applications, answers custom screening questions, and bypasses duplicate job posts."
        },
        {
          id: "rolvio-p3",
          title: "Response & Follow-up Tracking",
          tag: "Kanban",
          icon: "Layers",
          description: "Monitors interview invitations and recruiter emails in a visual status board."
        }
      ],
      comparison: {
        headline: "Why Rolvio Outperforms Job Bots",
        competitor1Name: "LazyApply",
        competitor2Name: "Manual Applying",
        rows: [
          { feature: "Smart Question Answering", us: true, comp1: false, comp2: true },
          { feature: "Duplicate Application Guard", us: true, comp1: false, comp2: false },
          { feature: "Email Response Tracking", us: true, comp1: false, comp2: false },
          { feature: "Pricing Model", us: "From ₹499 / Lifetime", comp1: "$250 / lifetime", comp2: "Hours of daily work" }
        ]
      },
      workflowSteps: [
        { step: "01", title: "Profile Setup", description: "Add your resume, target titles, locations, and salary expectations." },
        { step: "02", title: "Review Matches", description: "Rolvio discovers verified jobs and calculates ATS match scores." },
        { step: "03", title: "Automated Submissions", description: "Rolvio applies cleanly through your browser with human-like interactions." }
      ],
      faqs: [
        { question: "Can job platforms detect automated applications?", answer: "Rolvio mimics natural human typing patterns, mouse movements, and variable delays to safeguard your accounts." },
        { question: "Can I review applications before they are sent?", answer: "Yes. You can run Rolvio in full auto mode or semi-autonomous review mode where it pauses for your approval." }
      ],
      seo: {
        metaTitle: "Rolvio - AI Automated Job Applicant & Career Assistant | NORVI",
        metaDescription: "Automate your job search with Rolvio. Smart resume matching, automated job applications on LinkedIn and Indeed, and email response tracking.",
        focusKeywords: "automation for applying job, job apply agent, automated job application, auto apply linkedin, rolvio ai"
      }
    }
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
export const routes = ['', 'agents', 'agents/agent-1', 'agents/agent-2', 'agents/agent-3', 'pricing', 'about', 'contact', 'help', 'privacy', 'terms', 'refunds', 'delivery', 'license', 'register', 'login', 'verify-email', 'reset-password', 'update-password', 'auth/confirm', 'account/security', 'onboarding', 'account', 'account/agents', 'account/licenses', 'account/billing', 'account/settings', 'account/support', 'checkout/agent-1', 'checkout/agent-2', 'checkout/agent-3', 'orders', 'admin', 'admin/login', 'admin/customers', 'admin/licenses', 'admin/orders', 'admin/subscriptions', 'admin/products', 'admin/categories', 'admin/announcements', 'admin/activity', 'admin/settings', 'admin/team', 'admin/content'];
