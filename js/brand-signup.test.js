import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRequestForm, renderMyBrands } from './brand-signup.js';

test('renderRequestForm includes name, slug, logo inputs and a submit button', () => {
  const html = renderRequestForm('Death Evangelist');
  assert.match(html, /id="brand-request-name"/);
  assert.match(html, /id="brand-request-slug"/);
  assert.match(html, /id="brand-request-logo"/);
  assert.match(html, /type="file"/);
  assert.match(html, /Submit request/);
  assert.match(html, /id="brand-slug-hint"/);
});

test('renderRequestForm wires the inline controller hooks', () => {
  const html = renderRequestForm();
  assert.match(html, /window\.brandSignup\.submit\(event\)/);
  assert.match(html, /window\.brandSignup\.checkSlug\(\)/);
});

test('renderRequestForm uses the configurable role label in copy', () => {
  assert.match(renderRequestForm('Grim Partner'), /Grim Partner/);
});

test('renderRequestForm escapes the role label', () => {
  const html = renderRequestForm('<script>x</script>');
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /&lt;script&gt;/);
});

test('renderMyBrands returns empty string when there are no requests', () => {
  assert.equal(renderMyBrands([]), '');
  assert.equal(renderMyBrands(null), '');
});

test('renderMyBrands lists each request with its capitalised status', () => {
  const html = renderMyBrands([
    { slug: 'acme', name: 'Acme Co', status: 'approved' },
    { slug: 'beta', name: 'Beta Co', status: 'pending' },
  ]);
  assert.match(html, /carkedit\.com\/acme/);
  assert.match(html, /Acme Co/);
  assert.match(html, /brand-signup__brand-status--approved/);
  assert.match(html, /Approved/);
  assert.match(html, /carkedit\.com\/beta/);
  assert.match(html, /brand-signup__brand-status--pending/);
  assert.match(html, /Pending/);
});

test('renderMyBrands escapes brand name + slug', () => {
  const html = renderMyBrands([{ slug: 'x', name: '<b>evil</b>', status: 'pending' }]);
  assert.doesNotMatch(html, /<b>evil<\/b>/);
  assert.match(html, /&lt;b&gt;evil/);
});
