import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS,
  SIGNUP_HREF,
  WHITELABEL_EMAIL,
  PLAN_KEYS,
  DEFAULT_PLAN,
  isSelected,
  signupUrl,
  renderHeader,
  renderTier,
  renderTiers,
  renderActions,
  renderWhiteLabel,
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

// ── Selection logic ───────────────────────────────────────

test('PLAN_KEYS / DEFAULT_PLAN: keys match tiers; default is the featured tier', () => {
  assert.deepEqual(PLAN_KEYS, ['basic', 'pro', 'ultimate']);
  assert.equal(DEFAULT_PLAN, 'pro');
});

test('isSelected: true only for the matching key', () => {
  assert.equal(isSelected('pro', 'pro'), true);
  assert.equal(isSelected('pro', 'basic'), false);
});

test('signupUrl: carries a valid plan; falls back to bare signup for junk', () => {
  assert.equal(signupUrl('ultimate'), `${SIGNUP_HREF}?plan=ultimate`);
  assert.equal(signupUrl('bogus'), SIGNUP_HREF);
});

// ── renderTier (now a selectable radio, no per-tier link) ──

test('renderTier: is a radio option with no per-tier link', () => {
  const html = renderTier(TIERS[0], 'basic');
  assert.match(html, /Basic/);
  assert.match(html, /\$150/);
  assert.match(html, /role="radio"/);
  assert.match(html, /data-plan="basic"/);
  assert.ok(!html.includes('href='), 'tier should not contain its own link');
});

test('renderTier: marks the selected tier with aria-checked=true', () => {
  assert.match(renderTier(TIERS[1], 'pro'), /aria-checked="true"/);
  assert.match(renderTier(TIERS[1], 'basic'), /aria-checked="false"/);
});

test('renderTier: featured tier renders the "Most popular" badge', () => {
  const pro = TIERS.find((t) => t.key === 'pro');
  const basic = TIERS.find((t) => t.key === 'basic');
  assert.match(renderTier(pro, 'pro'), /Most popular/);
  assert.ok(!renderTier(basic, 'basic').includes('Most popular'));
});

test('renderTier: renders each feature string', () => {
  const html = renderTier(TIERS[2], 'ultimate');
  assert.match(html, /Unlimited Games/);
  assert.match(html, /Up to 200 Custom Cards/);
  assert.match(html, /Clients can make 2 cards each/);
  assert.match(html, /Custom Post-Game Survey/);
  assert.match(html, /Everything in Pro/);
});

// ── renderTiers / renderActions / render ──────────────────

test('renderTiers: is a radiogroup with exactly one checked option', () => {
  const html = renderTiers(TIERS, 'pro');
  assert.match(html, /role="radiogroup"/);
  const checked = html.match(/aria-checked="true"/g) || [];
  assert.equal(checked.length, 1);
});

test('renderActions: a single signup button, no per-tier links', () => {
  const html = renderActions('Death Evangelist', 'pro');
  const buttons = html.match(/<button/g) || [];
  assert.equal(buttons.length, 1);
  assert.match(html, /goToSignup\(\)/);
  assert.match(html, /Become a Death Evangelist/);
});

test('render: includes all tier names, the evangelist term, and one button', () => {
  const html = render('Death Evangelist');
  ['Basic', 'Pro', 'Ultimate'].forEach((n) => assert.match(html, new RegExp(n)));
  assert.match(html, /Death Evangelist/);
  const buttons = html.match(/<button/g) || [];
  assert.equal(buttons.length, 1, 'page should have exactly one button');
});

// ── renderWhiteLabel (inline link, not a button) ──────────

test('renderWhiteLabel: offers a white label via an inline mailto link (no button)', () => {
  const html = renderWhiteLabel();
  assert.match(html, /white label/i);
  assert.match(html, new RegExp(`href="mailto:${WHITELABEL_EMAIL}"`));
  assert.ok(!html.includes('<button'), 'white-label should not be a button');
  assert.ok(!html.includes('btn'), 'white-label should not use the btn class');
});

test('render: includes the white-label contact email', () => {
  assert.match(render('Evangelist'), new RegExp(`mailto:${WHITELABEL_EMAIL}`));
});
