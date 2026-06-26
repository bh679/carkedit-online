import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS,
  SIGNUP_HREF,
  renderHeader,
  renderTier,
  renderTiers,
  render,
} from './app.js';

// ── TIERS data shape ──────────────────────────────────────

test('TIERS: has the three expected tiers in order', () => {
  assert.deepEqual(TIERS.map((t) => t.name), ['Basic', 'Pro', 'Ultimate']);
  assert.deepEqual(TIERS.map((t) => t.key), ['basic', 'pro', 'ultimate']);
});

test('TIERS: prices match the offering', () => {
  assert.deepEqual(TIERS.map((t) => t.price), ['$150', '$250', '$500']);
  TIERS.forEach((t) => assert.equal(t.period, '/ year'));
});

test('TIERS: Pro is the single featured tier', () => {
  const featured = TIERS.filter((t) => t.featured);
  assert.equal(featured.length, 1);
  assert.equal(featured[0].name, 'Pro');
});

test('TIERS: Pro and Ultimate inherit lower tiers; Basic does not', () => {
  const byKey = Object.fromEntries(TIERS.map((t) => [t.key, t]));
  assert.equal(byKey.basic.inherits, undefined);
  assert.equal(byKey.pro.inherits, 'Everything in Basic');
  assert.equal(byKey.ultimate.inherits, 'Everything in Pro');
});

// ── renderHeader ──────────────────────────────────────────

test('renderHeader: uses the configurable evangelist term in the title', () => {
  const html = renderHeader('Death Evangelist');
  assert.match(html, /Death Evangelist Pricing/);
  assert.match(html, /href="\/"/); // back to menu
});

test('renderHeader: escapes the injected term', () => {
  const html = renderHeader('<script>x</script>');
  assert.ok(!html.includes('<script>x</script>'));
  assert.match(html, /&lt;script&gt;/);
});

// ── renderTier ────────────────────────────────────────────

test('renderTier: shows name, price, period and a signup CTA', () => {
  const html = renderTier(TIERS[0], 'Evangelist');
  assert.match(html, /Basic/);
  assert.match(html, /\$150/);
  assert.match(html, /\/ year/);
  assert.match(html, new RegExp(`href="${SIGNUP_HREF}"`));
});

test('renderTier: featured tier renders the "Most popular" badge', () => {
  const pro = TIERS.find((t) => t.key === 'pro');
  const basic = TIERS.find((t) => t.key === 'basic');
  assert.match(renderTier(pro), /Most popular/);
  assert.ok(!renderTier(basic).includes('Most popular'));
});

test('renderTier: renders each feature string', () => {
  const html = renderTier(TIERS[2]); // Ultimate
  assert.match(html, /Unlimited Games/);
  assert.match(html, /Up to 200 Custom Cards/);
  assert.match(html, /Clients can make 10 custom cards each/);
  assert.match(html, /Everything in Pro/);
});

// ── renderTiers / render ──────────────────────────────────

test('renderTiers: every tier CTA points to the signup page', () => {
  const html = renderTiers(TIERS, 'Evangelist');
  const ctas = html.match(new RegExp(`href="${SIGNUP_HREF}"`, 'g')) || [];
  assert.equal(ctas.length, TIERS.length);
});

test('render: includes all tier names and the evangelist term', () => {
  const html = render('Death Evangelist');
  ['Basic', 'Pro', 'Ultimate'].forEach((n) => assert.match(html, new RegExp(n)));
  assert.match(html, /Death Evangelist/);
});
