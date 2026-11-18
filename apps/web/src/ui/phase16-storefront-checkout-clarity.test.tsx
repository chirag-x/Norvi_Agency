import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Product, Settings } from '../../../../packages/shared/model';
import { Detail, Checkout } from './PublicPages';

// Mock common utilities
vi.mock('./common', () => ({
  PageHeading: ({ title, description }: any) => (
    <div><h1>{title}</h1><p>{description}</p></div>
  ),
  Notice: ({ children }: any) => <div className="notice">{children}</div>,
  Field: ({ label, children }: any) => <div><label>{label}</label>{children}</div>,
  Empty: ({ title }: any) => <div>{title}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  SmartVideoPlayer: () => <div>VideoPlayer</div>,
  parseYouTubeVideoId: () => null,
  api: vi.fn(),
  useData: vi.fn((path: string) => {
    if (path === '/auth/config') return { data: { preview: false }, loading: false };
    if (path === '/account') return { data: { id: 'u1', licenses: [] }, loading: false };
    return { data: null, loading: false };
  })
}));

vi.mock('./analytics', () => ({
  trackMetaPurchase: vi.fn(),
  trackMetaViewContent: vi.fn(),
  hasAdvertisingConsent: () => true,
  getProductDisplayPrice: () => '₹499'
}));

const mockSettings: Settings = {
  name: 'NORVI',
  headline: 'Less busywork.',
  description: 'AI agents',
  email: 'test@norvi.in',
  company: 'NORVI AI',
  domain: 'norvi.in',
  maintenanceMode: false,
  permissions: { owner: ['*'] }
};

const mockProduct: Product = {
  id: 'prod-voro-1234',
  slug: 'voro',
  name: 'Voro',
  categoryId: 'cat-1',
  tagline: 'Voice-First AI Assistant',
  description: 'Automate desktop workflows with voice.',
  price: '₹499',
  price1w: '199',
  price1m: '499',
  price3m: '1199',
  price_lifetime: '2999',
  features: ['Voice Control', 'Smart Actions'],
  version: '1.4.1',
  requirements: 'Windows 10/11',
  status: 'published',
  releaseStatus: 'live',
  logoUrl: null,
  workflowHeading: 'Flow',
  workflowDescription: 'Description',
  workflowMediaUrl: null,
  workflowNote: 'Note',
  extendedContent: {
    checkout_description: 'Choose your preferred duration. All paid tiers include task-specialized cloud models.',
    paid_highlights: [
      '⚡ Instant, sub-second responses tailored live to your screen & audio',
      '👁️ Real-time invisible screen perception & live vision assistant',
      '🚀 Priority cloud performance with zero waiting or queue delays',
      '🔒 100% private & undetectable — zero data harvesting or prompt training',
      '💻 Multi-device activation — seamlessly switch between your desktop & laptop',
      '✨ Unlimited daily access for real everyday productivity & work'
    ],
    trial_highlights: [
      '🎁 Instant 1-click desktop activation — no credit card needed',
      '👁️ Live screen-aware assistant to test real desktop workflows',
      '⚡ Fast contextual answers right on your personal PC',
      '⏱️ Generous daily trial allowance to experience the full software',
      '🚀 Test all core features before deciding to unlock the full paid version'
    ],
    trial_notice: 'Free trial runs on standard community cloud capacity. Upgrade anytime for instant sub-second speed.'
  }
};

describe('Phase 16: Storefront Checkout Clarity & Free Trial Transparency', () => {
  it('renders paid license highlights box on the product detail purchase sidebar', () => {
    const html = renderToStaticMarkup(<Detail product={mockProduct} settings={mockSettings} />);
    
    // Check paid highlights header
    expect(html).toContain("👑 What&#x27;s Included in Paid Licenses:");
    
    // Check marketing highlights rendered
    expect(html).toContain('Instant, sub-second responses tailored live');
    expect(html).toContain('Real-time invisible screen perception');
    expect(html).toContain('Multi-device activation');
  });

  it('renders checkout description and 1-Week pricing toggle on checkout page', () => {
    const html = renderToStaticMarkup(<Checkout product={mockProduct} settings={mockSettings} />);

    // Custom checkout description from extendedContent
    expect(html).toContain('Choose your preferred duration. All paid tiers include task-specialized cloud models.');

    // 1-Week (7 Days) pricing option
    expect(html).toContain('1 Week (7 Days)');
    expect(html).toContain('1 Month');
    expect(html).toContain('3 Months');
    expect(html).toContain('Lifetime Access');

    // Default highlights for paid selection
    expect(html).toContain("👑 What&#x27;s Included in Paid Licenses:");
    expect(html).toContain('Instant, sub-second responses tailored live');
  });

  it('renders fallback paid highlights when extendedContent is empty', () => {
    const productWithoutHighlights: Product = {
      ...mockProduct,
      extendedContent: undefined
    };

    const html = renderToStaticMarkup(<Detail product={productWithoutHighlights} settings={mockSettings} />);
    expect(html).toContain("👑 What&#x27;s Included in Paid Licenses:");
    expect(html).toContain('100% private &amp; undetectable');
    expect(html).toContain('Real-time invisible screen perception');
  });
});
