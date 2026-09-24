const fs = require('fs');

let content = fs.readFileSync('e:/Agency/packages/shared/model.ts', 'utf-8');
content = content.replace(
  `export type Store = { products: Product[]; users: User[]; licenses: License[]; orders: Order[]; audit: Audit[]; tickets: Ticket[]; invitations: Invite[]; settings: Settings; emails: { id: string; userId: string; orderId: string; status: string; createdAt: string }[] };`,
  `export type Store = { categories: Category[]; products: Product[]; users: User[]; licenses: License[]; orders: Order[]; audit: Audit[]; tickets: Ticket[]; invitations: Invite[]; settings: Settings; emails: { id: string; userId: string; orderId: string; status: string; createdAt: string }[] };`
);

content = content.replace(/export const products: Product\[\] = \[[\s\S]*?\];/, `export const categories: Category[] = [
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
    updatedAt: "2026-09-23"
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
    updatedAt: "2026-09-23"
  }
];`);

content = content.replace(`return { products: structuredClone(products)`, `return { categories: structuredClone(categories), products: structuredClone(products)`);

fs.writeFileSync('e:/Agency/packages/shared/model.ts', content);
