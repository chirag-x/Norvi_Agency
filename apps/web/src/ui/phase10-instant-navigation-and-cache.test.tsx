import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { getCached, setCached, removeCached, clearAllCaches } from './common';
import { Detail } from './PublicPages';
import App from './App';
import type { Product, Settings } from '../../../../packages/shared/model';

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; }
  };
})();

describe('Phase 10: Instant Navigation, Optimistic Cache & Zero Flicker', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true
    });
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('getCached, setCached, removeCached, and clearAllCaches operate reliably', () => {
    setCached('norvi_cache_test', { greeting: 'hello' });
    expect(getCached<{ greeting: string }>('norvi_cache_test')).toEqual({ greeting: 'hello' });

    removeCached('norvi_cache_test');
    expect(getCached('norvi_cache_test')).toBeNull();

    setCached('norvi_cache_user', { name: 'Chirag Sharma' });
    setCached('norvi_cache__account', { licenses: [] });
    localStorage.setItem('unrelated_key', 'keep_me');

    clearAllCaches();
    expect(getCached('norvi_cache_user')).toBeNull();
    expect(getCached('norvi_cache__account')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keep_me');
  });

  it('Detail renders "Download agent & view key" immediately when cached account owns the license', () => {
    const dummyProduct = {
      id: 'prod-voro-123',
      slug: 'voro',
      name: 'Voro',
      tagline: 'Real-time interview copilot',
      description: 'Your autonomous desktop agent.',
      price: '₹499/mo',
      status: 'published',
      releaseStatus: 'live',
      version: '1.0.0',
      requirements: 'Windows 11'
    } as unknown as Product;

    const dummySettings = {
      name: 'NORVI Agency',
      headline: 'Less busywork.',
      description: 'AI agents for your work',
      email: 'contact@nor-vi.in',
      company: 'NORVI',
      domain: 'nor-vi.in',
      maintenanceMode: false,
      permissions: {}
    } as unknown as Settings;

    // Pre-populate optimistic cache for /account
    setCached('norvi_cache__account', {
      licenses: [
        {
          id: 'lic-1',
          productId: 'prod-voro-123',
          status: 'active',
          keySuffix: 'BB3E'
        }
      ]
    });

    const html = renderToStaticMarkup(
      <Detail product={dummyProduct} settings={dummySettings} isCatalogLoaded={true} />
    );

    // Verified ownership states must be immediately present
    expect(html).toContain('Ready to go.');
    expect(html).toContain('You already own a license for Voro.');
    expect(html).toContain('Download agent &amp; view key');
    expect(html).toContain('READY IN YOUR ACCOUNT');

    // "Buy now" must NEVER exist when user owns the agent
    expect(html).not.toContain('Buy now');
    expect(html).not.toContain('GET STARTED TODAY');
  });

  it('Detail renders loading skeleton rather than flashing "Buy now" while license status is checking on fresh device', () => {
    const dummyProduct = {
      id: 'prod-nexus-456',
      slug: 'nexus',
      name: 'Nexus',
      tagline: 'Viral content studio',
      description: 'Autonomous content creation.',
      price: '₹999/mo',
      status: 'published',
      releaseStatus: 'live',
      version: '1.0.0',
      requirements: 'macOS, Windows 11'
    } as unknown as Product;

    // No cache exists in localStorage
    localStorageMock.clear();

    const html = renderToStaticMarkup(
      <Detail product={dummyProduct} isCatalogLoaded={true} />
    );

    // In SSR/fresh state where account is loading without cache:
    // It must render the neutral skeleton rather than flashing "Buy now"
    expect(html).toContain('purchase-skeleton');
    expect(html).toContain('CHECKING ACCESS');
    expect(html).not.toContain('Buy now');
  });

  it('App renders user avatar immediately on frame 1 when norvi_cache_user is cached', () => {
    setCached('norvi_cache_user', {
      id: 'usr-1',
      name: 'Chirag Sharma',
      email: 'chirag@norvi.agency',
      role: 'owner',
      status: 'active'
    });

    const html = renderToStaticMarkup(<App initialPath="/" />);

    // Top right avatar should render "C" immediately
    expect(html).toContain('class="avatar">C</span>');
    expect(html).not.toContain('Log in');
  });
});
