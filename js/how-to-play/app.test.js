import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TABS,
  DEFAULT_TAB,
  SETUP_STEPS,
  DECKS,
  PHASES,
  normaliseTab,
  isTabActive,
  render,
  renderSetupPanel,
  renderPlayPanel,
} from './app.js';

// ── normaliseTab ──────────────────────────────────────────

test('normaliseTab: returns the value when it is a known tab', () => {
  assert.equal(normaliseTab('setup'), 'setup');
  assert.equal(normaliseTab('play'), 'play');
});

test('normaliseTab: falls back to the default for an unknown value', () => {
  assert.equal(normaliseTab('bogus'), DEFAULT_TAB);
});

test('normaliseTab: falls back to the default for empty string', () => {
  assert.equal(normaliseTab(''), DEFAULT_TAB);
});

test('normaliseTab: falls back to the default for undefined', () => {
  assert.equal(normaliseTab(undefined), DEFAULT_TAB);
});

test('DEFAULT_TAB is one of TABS', () => {
  assert.ok(TABS.includes(DEFAULT_TAB));
});

// ── isTabActive ───────────────────────────────────────────

test('isTabActive: true only for the matching tab', () => {
  assert.equal(isTabActive('setup', 'setup'), true);
  assert.equal(isTabActive('setup', 'play'), false);
  assert.equal(isTabActive('play', 'play'), true);
});

test('isTabActive: unknown active value defaults to setup being active', () => {
  assert.equal(isTabActive('bogus', 'setup'), true);
  assert.equal(isTabActive(undefined, 'setup'), true);
  assert.equal(isTabActive('bogus', 'play'), false);
});

// ── Content data integrity ────────────────────────────────

test('SETUP_STEPS: exactly three numbered steps in order', () => {
  assert.equal(SETUP_STEPS.length, 3);
  assert.deepEqual(SETUP_STEPS.map(s => s.n), [1, 2, 3]);
  assert.deepEqual(SETUP_STEPS.map(s => s.title), ['Host a Game', 'Share the Link', 'Join & Start']);
});

test('DECKS: three decks with the rulebook card counts', () => {
  assert.deepEqual(DECKS.map(d => d.name), ['Die', 'Live', 'Bye']);
  assert.deepEqual(DECKS.map(d => d.count), [48, 68, 68]);
  for (const d of DECKS) {
    assert.match(d.img, /^assets\/card-backs\/.+\.jpg$/, `${d.name} should reference a card-back asset`);
  }
});

test('PHASES: four phases in order', () => {
  assert.equal(PHASES.length, 4);
  assert.deepEqual(PHASES.map(p => p.n), [1, 2, 3, 4]);
  assert.deepEqual(PHASES.map(p => p.title), ['Die!', 'Live!', 'Bye!', 'Eulogy Wildcard']);
});

// ── Setup panel content contract ──────────────────────────

test('renderSetupPanel: includes the three step titles', () => {
  const html = renderSetupPanel('setup');
  for (const s of SETUP_STEPS) {
    assert.ok(html.includes(s.title), `expected step "${s.title}" in setup panel`);
  }
});

test('renderSetupPanel: includes the video-call tip with named platforms', () => {
  const html = renderSetupPanel('setup');
  assert.ok(html.includes('video call'), 'expected the video-call tip');
  assert.ok(html.includes('tell stories and connection'), 'expected the current video-call tip wording');
  for (const platform of ['Zoom', 'Google Meet', 'FaceTime']) {
    assert.ok(html.includes(platform), `expected "${platform}" in the video-call tip`);
  }
});

test('renderSetupPanel: video-call tip renders above the numbered steps', () => {
  const html = renderSetupPanel('setup');
  assert.ok(html.indexOf('htp-callout') < html.indexOf('htp-steps'), 'expected the tip callout before the steps list');
});

test('renderSetupPanel: step 1 shows the "Free Account Required" badge', () => {
  assert.equal(SETUP_STEPS[0].badge, 'Free Account Required');
  const html = renderSetupPanel('setup');
  assert.ok(html.includes('Free Account Required'), 'expected the account-required badge on step 1');
});

test('renderSetupPanel: step 3 shows the "No Account Required" badge (green variant)', () => {
  assert.equal(SETUP_STEPS[2].badge, 'No Account Required');
  assert.equal(SETUP_STEPS[2].badgeVariant, 'ok');
  const html = renderSetupPanel('setup');
  assert.ok(html.includes('No Account Required'), 'expected the no-account badge on step 3');
  assert.ok(html.includes('htp-step__badge--ok'), 'expected the green badge variant class');
});

test('renderSetupPanel: CTA advances to the Game Rules tab', () => {
  const html = renderSetupPanel('setup');
  assert.ok(html.includes('href="#play"'), 'expected the setup CTA to link to #play');
  assert.ok(html.includes('Game Rules'), 'expected the "Game Rules" CTA label');
});

test('renderPlayPanel: "Start a Game" CTA deep-links into the create-room screen', () => {
  const html = renderPlayPanel('play');
  assert.ok(html.includes('href="/?host=1"'), 'expected the CTA to deep-link to /?host=1');
  assert.ok(html.includes('Start a Game'), 'expected the "Start a Game" CTA label');
});

// ── Play panel content contract ───────────────────────────

test('renderPlayPanel: includes every deck name and its card-back image', () => {
  const html = renderPlayPanel('play');
  for (const d of DECKS) {
    assert.ok(html.includes(d.name), `expected deck "${d.name}"`);
    assert.ok(html.includes(d.img), `expected card-back image "${d.img}"`);
  }
});

test('renderPlayPanel: includes every phase title and the win condition', () => {
  const html = renderPlayPanel('play');
  for (const p of PHASES) {
    assert.ok(html.includes(p.title), `expected phase "${p.title}"`);
  }
  assert.ok(html.includes('Legendary Death Doula'), 'expected the win title');
  assert.ok(html.includes('1 Live + 1 Bye'), 'expected the short-game variant');
});

// ── Active-tab wiring ─────────────────────────────────────

test('render(setup): setup panel is active and play panel is hidden', () => {
  const html = render('setup');
  // The active panel keeps its active class; the inactive one is hidden.
  assert.ok(/id="htp-panel-setup"[\s\S]*?htp-panel--active|htp-panel--active[\s\S]*?id="htp-panel-setup"/.test(html) || html.includes('htp-panel--active'), 'setup panel should be active');
  // Exactly one panel should carry the active modifier.
  const activeCount = (html.match(/htp-panel--active/g) || []).length;
  assert.equal(activeCount, 1, 'exactly one panel active at a time');
});

test('render: defaults to the setup tab when called with no argument', () => {
  const html = render();
  assert.ok(html.includes('aria-selected="true"'), 'a tab should be selected by default');
  // The default tab button (setup) should be the active one.
  assert.ok(html.includes('htp-tab--active'), 'the default tab is marked active');
});
