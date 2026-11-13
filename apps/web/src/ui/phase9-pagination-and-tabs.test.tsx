import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminOrderTable, PaginationBar, InquiriesAdmin } from './Workspace';

describe('Phase 9: Classic Page-by-Page Pagination (Top & Bottom Controls)', () => {
  it('AdminOrderTable renders page 1 with top and bottom PaginationBar when given 30 orders', () => {
    const fakeOrders = Array.from({ length: 30 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      customer: `Customer ${i + 1}`,
      email: `customer${i + 1}@example.com`,
      product: 'Voro',
      productSlug: 'voro',
      amount: '₹499.00',
      createdAt: new Date().toISOString(),
      status: 'paid'
    }));

    const html = renderToStaticMarkup(<AdminOrderTable items={fakeOrders} />);

    // Check pagination bar is rendered with "Page 1 of 2" and "Showing 1–15 of 30 orders"
    expect(html).toContain('Showing <b>1–15</b> of <b>30</b> orders');
    expect(html).toContain('Page 1 of 2');
    expect(html).toContain('‹ Prev');
    expect(html).toContain('Next ›');
    expect(html).toContain('Go to:');
    expect(html).toContain('>Go</button>');

    // "Show all" and "Load more" buttons must NOT exist
    expect(html).not.toContain('Load 15 more');
    expect(html).not.toContain('Show all');

    // Verify first 15 orders are present, but 16th is sliced off
    expect(html).toContain('Customer 1<');
    expect(html).toContain('Customer 15<');
    expect(html).not.toContain('Customer 16<');

    // Verify top AND bottom pagination bars exist (count should be at least 2)
    const matches = html.match(/class="pagination-bar"/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);
  });

  it('PaginationBar renders page 2 range and controls accurately', () => {
    const html = renderToStaticMarkup(
      <PaginationBar page={2} totalItems={40} pageSize={15} onPageChange={() => {}} label="customers" />
    );

    expect(html).toContain('Showing <b>16–30</b> of <b>40</b> customers');
    expect(html).toContain('Page 2 of 3');
    expect(html).toContain('‹ Prev');
    expect(html).toContain('Next ›');
    expect(html).toContain('Go to:');
  });

  it('AdminOrderTable renders pagination bar even when items <= 15 (e.g. 5 orders)', () => {
    const fakeOrders = Array.from({ length: 5 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      customer: `Customer ${i + 1}`,
      email: `customer${i + 1}@example.com`,
      product: 'Voro',
      productSlug: 'voro',
      amount: '₹499.00',
      createdAt: new Date().toISOString(),
      status: 'paid'
    }));

    const html = renderToStaticMarkup(<AdminOrderTable items={fakeOrders} />);

    expect(html).toContain('pagination-bar');
    expect(html).toContain('Showing <b>1–5</b> of <b>5</b> orders');
    expect(html).toContain('Page 1 of 1');
    expect(html).toContain('‹ Prev');
    expect(html).toContain('Next ›');
    expect(html).toContain('Customer 1<');
    expect(html).toContain('Customer 5<');
  });

  it('InquiriesAdmin correctly renders without crashing', () => {
    const html = renderToStaticMarkup(<InquiriesAdmin onFeedback={() => {}} />);
    expect(html).toBeDefined();
  });
});
