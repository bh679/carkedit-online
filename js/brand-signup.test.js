import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderRequestForm,
  renderMyBrands,
  renderPlanSelect,
  normalisePlan,
  PLAN_LABELS,
} from './brand-signup.js';

test('renderRequestForm includes name, slug, email, phone, logo inputs and a submit button', () => {
  const html = renderRequestForm('Death Evangelist');
  assert.match(html, /id="brand-request-name"/);
  assert.match(html, /id="brand-request-slug"/);
  assert.match(html, /id="brand-request-email"/);
  assert.match(html, /type="email"/);
  assert.match(html, /id="brand-request-phone"/);
  assert.match(html, /type="tel"/);
  assert.match(html, /id="brand-request-logo"/);
  assert.match(html, /type="file"/);
  assert.match(html, /Submit request/);
  assert.match(html, /id="brand-slug-hint"/);
});

test('renderRequestForm pre-fills the contact email from the account (escaped)', () => {
  const html = renderRequestForm('Death Evangelist', null, 'me@example.com');
  assert.match(html, /id="brand-request-email"[^>]*value="me@example\.com"/);
  // Empty email leaves the field blank.
  assert.match(renderRequestForm('Death Evangelist'), /id="brand-request-email"[^>]*value=""/);
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

// ── plan selection tracking ───────────────────────────────

test('normalisePlan: accepts known keys (case-insensitive), rejects junk', () => {
  assert.equal(normalisePlan('basic'), 'basic');
  assert.equal(normalisePlan('PRO'), 'pro');
  assert.equal(normalisePlan(' Ultimate '), 'ultimate');
  assert.equal(normalisePlan('enterprise'), null);
  assert.equal(normalisePlan(''), null);
  assert.equal(normalisePlan(undefined), null);
});

test('PLAN_LABELS: covers the three tier keys', () => {
  assert.deepEqual(Object.keys(PLAN_LABELS), ['basic', 'pro', 'ultimate']);
});

test('renderPlanSelect: a switchable select with all tiers, none chosen by default', () => {
  const html = renderPlanSelect(null);
  assert.match(html, /<select id="brand-request-plan"/);
  assert.match(html, /Choose a plan/);
  Object.values(PLAN_LABELS).forEach((label) => assert.match(html, new RegExp(label)));
  // Placeholder is the selected option when no plan is supplied.
  assert.match(html, /value=""\s+selected/);
});

test('renderPlanSelect: each option shows the price after the name on one line', () => {
  const html = renderPlanSelect(null);
  assert.match(html, /Basic — \$150 \/ year/);
  assert.match(html, /Pro — \$250 \/ year/);
  assert.match(html, /Ultimate — \$500 \/ year/);
});

test('renderPlanSelect: pre-selects the plan passed from the pricing page', () => {
  const html = renderPlanSelect('ultimate');
  assert.match(html, /value="ultimate"\s+selected/);
  // The empty placeholder is no longer the selected option.
  assert.doesNotMatch(html, /value=""\s+selected/);
});

test('renderPlanSelect: an unknown plan falls back to no selection', () => {
  const html = renderPlanSelect('bogus');
  assert.match(html, /value=""\s+selected/);
});

test('renderRequestForm: always includes the switchable plan select', () => {
  assert.match(renderRequestForm('Evangelist', 'ultimate'), /<select id="brand-request-plan"/);
  assert.match(renderRequestForm('Evangelist', 'ultimate'), /value="ultimate"\s+selected/);
  assert.match(renderRequestForm('Evangelist'), /<select id="brand-request-plan"/);
});
