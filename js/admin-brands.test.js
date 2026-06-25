import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_STATUSES,
  statusBadge,
  filterOptions,
  actionsFor,
  renderBrandRow,
  renderBrandsTable,
} from './admin-brands.js';

const baseBrand = {
  id: 'brand_1',
  slug: 'acme',
  name: 'Acme Funerals',
  logo_url: '/uploads/brands/a.png',
  owner_display_name: 'Jane Doe',
  owner_email: 'jane@example.com',
  status: 'pending',
  created_at: '2026-06-20T10:00:00Z',
};

test('statusBadge renders the matching modifier class per status', () => {
  for (const s of BRAND_STATUSES) {
    assert.match(statusBadge(s), new RegExp(`admin-brands__badge--${s}`));
  }
});

test('statusBadge falls back to pending for unknown status', () => {
  assert.match(statusBadge('bogus'), /admin-brands__badge--pending/);
});

test('filterOptions includes All + every status, marking the selected one', () => {
  const html = filterOptions('approved');
  assert.match(html, /<option value="">All<\/option>/);
  for (const s of BRAND_STATUSES) assert.match(html, new RegExp(`value="${s}"`));
  assert.match(html, /value="approved" selected/);
});

test('actionsFor offers approve/reject when pending, suspend when approved', () => {
  assert.deepEqual(actionsFor('pending'), ['approve', 'reject']);
  assert.deepEqual(actionsFor('approved'), ['suspend']);
  assert.deepEqual(actionsFor('rejected'), ['approve']);
  assert.deepEqual(actionsFor('suspended'), ['approve']);
});

test('renderBrandRow shows slug, name, owner name + email, and a status badge', () => {
  const row = renderBrandRow(baseBrand);
  assert.match(row, /\/acme/);
  assert.match(row, /Acme Funerals/);
  assert.match(row, /Jane Doe/);
  assert.match(row, /jane@example\.com/);
  assert.match(row, /admin-brands__badge--pending/);
});

test('renderBrandRow emits action buttons carrying brand id + target status', () => {
  const row = renderBrandRow(baseBrand);
  assert.match(row, /data-brand-id="brand_1"/);
  assert.match(row, /data-status="approved"/); // approve button
  assert.match(row, /data-status="rejected"/); // reject button
});

test('renderBrandRow links the slug only when approved', () => {
  assert.match(renderBrandRow({ ...baseBrand, status: 'approved' }), /<a class="admin-brands__slug" href="\/acme"/);
  assert.doesNotMatch(renderBrandRow(baseBrand), /<a class="admin-brands__slug"/); // pending → plain text
});

test('renderBrandRow renders an empty-logo placeholder when no logo_url', () => {
  const row = renderBrandRow({ ...baseBrand, logo_url: null });
  assert.match(row, /admin-brands__logo--empty/);
  assert.doesNotMatch(row, /<img/);
});

test('renderBrandRow escapes a malicious brand name', () => {
  const row = renderBrandRow({ ...baseBrand, name: '<script>alert(1)</script>' });
  assert.doesNotMatch(row, /<script>alert/);
  assert.match(row, /&lt;script&gt;/);
});

test('renderBrandsTable shows an empty state for no brands', () => {
  assert.match(renderBrandsTable([]), /admin-brands__empty/);
  assert.match(renderBrandsTable(null), /admin-brands__empty/);
});

test('renderBrandsTable renders a header row + one row per brand', () => {
  const html = renderBrandsTable([baseBrand, { ...baseBrand, id: 'brand_2', slug: 'beta' }]);
  assert.match(html, /<thead>/);
  assert.equal((html.match(/<tr>/g) || []).length, 3); // 1 header + 2 body
  assert.match(html, /\/acme/);
  assert.match(html, /\/beta/);
});
