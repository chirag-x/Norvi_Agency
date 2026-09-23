export type Role = 'owner' | 'administrator' | 'product_manager' | 'support' | 'customer';
export type Product = { id: string; slug: string; name: string; category: string; tagline: string; description: string; price: string; status: 'draft' | 'published' | 'archived'; releaseStatus?: 'development' | 'prelaunch'; icon: string; color: string; features: string[]; version: string; requirements: string; updatedAt: string };
export type User = { id: string; name: string; email: string; role: Role; status: 'active' | 'suspended'; createdAt: string; lastLogin: string | null };
export type License = { id: string; userId: string; productId: string; status: 'active' | 'revoked'; keyHash: string; encryptedKey: string; suffix: string; createdAt: string; device: string | null; expiresAt: string | null };
export type Order = { id: string; userId: string; productId: string; status: 'simulated' | 'refunded'; amount: string; createdAt: string; licenseId: string };
export type Audit = { id: string; actor: string; action: string; target: string; createdAt: string };
export type Ticket = { id: string; userId: string; subject: string; message: string; status: 'open' | 'closed'; createdAt: string };
export type Invite = { id: string; email: string; role: Role; status: 'pending' | 'revoked'; createdAt: string };
export type Settings = { name: string; headline: string; description: string; email: string; company: string; domain: string };
export type Store = { products: Product[]; users: User[]; licenses: License[]; orders: Order[]; audit: Audit[]; tickets: Ticket[]; invitations: Invite[]; settings: Settings; emails: { id: string; userId: string; orderId: string; status: string; createdAt: string }[] };
export const settings: Settings = { name: 'NORVI', headline: 'Less busywork.\nMore possibility.', description: 'Make room for the work that matters. Discover AI agents built to take everyday tasks off your hands.', email: 'email_Support', company: 'name_Company', domain: 'domain_Website' };
export const products: Product[] = [
  {
    "id": "agent-1",
    "slug": "omnix",
    "name": "Omnix",
    "category": "Desktop automation",
    "tagline": "Speak your next task into action.",
    "description": "A voice-first desktop agent being developed to understand natural-language instructions, plan tasks, and operate your computer. Capabilities and supported environments will be confirmed through release testing.",
    "price": "Pricing to be confirmed",
    "status": "published",
    "releaseStatus": "development",
    "icon": "workflow",
    "color": "lime",
    "features": [
      "Voice-first task instructions",
      "Task planning and computer interaction",
      "Release scope under development"
    ],
    "version": "In development",
    "requirements": "Supported operating systems and hardware requirements to be confirmed.",
    "updatedAt": "2026-09-23"
  },
  {
    "id": "agent-2",
    "slug": "voro",
    "name": "Voro",
    "category": "Interview assistance",
    "tagline": "Bring context to your interview preparation.",
    "description": "An interview assistant with screen and audio context, résumé memory, and coding assistance. Designed for practice and situations where assistance is permitted. The application is reported complete; the NORVI release and compatibility checks are still being prepared.",
    "price": "Pricing to be confirmed",
    "status": "published",
    "releaseStatus": "prelaunch",
    "icon": "message",
    "color": "blue",
    "features": [
      "Screen and audio context",
      "Résumé and conversation memory",
      "Local and cloud AI options",
      "Coding assistance"
    ],
    "version": "Release version to be confirmed",
    "requirements": "Windows-oriented application. Supported Windows versions, audio setup, and local-model hardware requirements need verification.",
    "updatedAt": "2026-09-23"
  },
  {
    "id": "agent-3",
    "slug": "rolvio",
    "name": "Rolvio",
    "category": "Job-search automation",
    "tagline": "Your next role, with less routine.",
    "description": "Discover relevant openings, compare job descriptions with your résumé, assist with applications, and track responses in a Kanban workspace. The application is reported complete; supported-platform testing and the NORVI release are being prepared. Applications require your authorization and accurate profile information.",
    "price": "Pricing to be confirmed",
    "status": "published",
    "releaseStatus": "prelaunch",
    "icon": "sparkles",
    "color": "purple",
    "features": [
      "Job discovery and résumé-fit scoring",
      "Application workflow and duplicate detection",
      "Email response tracking",
      "Kanban application dashboard"
    ],
    "version": "Release version to be confirmed",
    "requirements": "Python application with a browser-driven workflow. Packaged installer, supported systems, AI provider setup, and email requirements to be confirmed.",
    "updatedAt": "2026-09-23"
  }
];
export function seed(): Store {
  const date = '2026-09-22T09:00:00.000Z';
  return { products: structuredClone(products), settings: { ...settings }, users: [
    { id: 'preview-owner', name: 'name_Owner', email: 'owner@example.invalid', role: 'owner', status: 'active', createdAt: date, lastLogin: null },
    { id: 'preview-customer', name: 'name_Customer', email: 'customer@example.invalid', role: 'customer', status: 'active', createdAt: date, lastLogin: null },
    { id: 'preview-nonbuyer', name: 'name_Visitor', email: 'visitor@example.invalid', role: 'customer', status: 'active', createdAt: date, lastLogin: date },
    { id: 'preview-support', name: 'name_Support', email: 'support@example.invalid', role: 'support', status: 'active', createdAt: date, lastLogin: null },
    { id: 'preview-product', name: 'name_Editor', email: 'editor@example.invalid', role: 'product_manager', status: 'active', createdAt: date, lastLogin: null },
  ], licenses: [], orders: [], audit: [], tickets: [], invitations: [], emails: [] };
}
export const routes = ['', 'agents', 'agents/agent-1', 'agents/agent-2', 'agents/agent-3', 'pricing', 'about', 'contact', 'help', 'privacy', 'terms', 'refunds', 'license', 'register', 'login', 'verify-email', 'reset-password', 'update-password', 'auth/confirm', 'account/security', 'onboarding', 'account', 'account/agents', 'account/licenses', 'account/billing', 'account/settings', 'account/support', 'checkout/agent-1', 'checkout/agent-2', 'checkout/agent-3', 'orders', 'admin', 'admin/login', 'admin/customers', 'admin/licenses', 'admin/orders', 'admin/subscriptions', 'admin/products', 'admin/activity', 'admin/settings', 'admin/team', 'admin/content'];
