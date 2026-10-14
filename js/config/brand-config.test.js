import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrand } from './brand-config.js';

test('resolveBrand returns null for missing or invalid input', () => {
  assert.equal(resolveBrand(null), null);
  assert.equal(resolveBrand(undefined), null);
  assert.equal(resolveBrand('x'), null);
  assert.equal(resolveBrand({}), null);
  assert.equal(resolveBrand({ id: 'x' }), null); // missing name
  assert.equal(resolveBrand({ name: 'x' }), null); // missing id
});

test('resolveBrand normalizes a valid payload and drops extra keys', () => {
  const b = resolveBrand({
    id: 'brand_1', slug: 'acme', name: 'Acme',
    logoUrl: '/uploads/brands/x.png', evil: '<script>',
  });
  assert.deepEqual(b, { id: 'brand_1', slug: 'acme', name: 'Acme', logoUrl: '/uploads/brands/x.png' });
});

test('resolveBrand tolerates a missing logo and slug', () => {
  const b = resolveBrand({ id: 'brand_1', name: 'Acme' });
  assert.deepEqual(b, { id: 'brand_1', slug: null, name: 'Acme', logoUrl: null });
});
