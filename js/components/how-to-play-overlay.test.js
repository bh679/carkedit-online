import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TABS,
  DEFAULT_TAB,
  normaliseTab,
  isFirstOnlineGame,
  isHowToBannerDismissed,
  setupStepStatus,
  renderHelpButton,
  renderFirstGameBanner,
  renderOverlay,
} from './how-to-play-overlay.js';
import { SETUP_STEPS } from '../how-to-play/content.js';

// ── Tabs ──────────────────────────────────────────────────

test('normaliseTab: keeps known tabs, defaults unknown to setup', () => {
  assert.equal(normaliseTab('setup'), 'setup');
  assert.equal(normaliseTab('play'), 'play');
  assert.equal(normaliseTab('bogus'), DEFAULT_TAB);
  assert.equal(normaliseTab(undefined), DEFAULT_TAB);
  assert.ok(TABS.includes(DEFAULT_TAB));
});

// ── setupStepStatus ───────────────────────────────────────

test('setupStepStatus: nothing done when disconnected', () => {
  assert.deepEqual(setupStepStatus({ connectionStatus: 'disconnected', onlinePlayers: [] }), [false, false, false]);
  assert.deepEqual(setupStepStatus(undefined), [false, false, false]);
});

test('setupStepStatus: step 1 done once connected (host, alone)', () => {
  const state = { connectionStatus: 'connected', onlinePlayers: [{ ready: false }] };
  assert.deepEqual(setupStepStatus(state), [true, false, false]);
});

test('setupStepStatus: step 2 done once another player joins', () => {
  const state = { connectionStatus: 'connected', onlinePlayers: [{ ready: false }, { ready: false }] };
  assert.deepEqual(setupStepStatus(state), [true, true, false]);
});

test('setupStepStatus: step 3 done once 2+ players are all ready', () => {
  const state = { connectionStatus: 'connected', onlinePlayers: [{ ready: true }, { ready: true }] };
  assert.deepEqual(setupStepStatus(state), [true, true, true]);
});

test('setupStepStatus: step 3 not done if someone is not ready', () => {
  const state = { connectionStatus: 'connected', onlinePlayers: [{ ready: true }, { ready: false }] };
  assert.deepEqual(setupStepStatus(state), [true, true, false]);
});

// ── First-game emphasis ───────────────────────────────────

test('isFirstOnlineGame: true when no localStorage is present (node env)', () => {
  assert.equal(typeof localStorage === 'undefined', true);
  assert.equal(isFirstOnlineGame(), true);
});

test('renderFirstGameBanner: shows the slim dismissible bar on first game', () => {
  assert.equal(isHowToBannerDismissed(), false); // node env: no localStorage
  const html = renderFirstGameBanner({});
  assert.ok(html.includes('online-lobby__howto-bar'), 'expected the banner class');
  assert.ok(html.includes('window.game.openHowToPlay()'), 'banner opens the overlay');
  assert.ok(html.includes('window.game.dismissHowToBanner()'), 'has a dismiss (✕) control');
  assert.ok(html.includes('event.stopPropagation()'), 'dismiss does not also open the overlay');
});

test('renderHelpButton: opens the overlay and is labelled', () => {
  const html = renderHelpButton();
  assert.ok(html.includes('phase-header__help-btn'));
  assert.ok(html.includes('aria-label="How to play"'));
  assert.ok(html.includes('window.game.openHowToPlay()'));
});

// ── Overlay content contract ──────────────────────────────

test('renderOverlay: has both tabs and every setup step title', () => {
  const html = renderOverlay({ connectionStatus: 'disconnected', onlinePlayers: [] });
  assert.ok(html.includes('Set Up a Game'));
  assert.ok(html.includes('Game Rules'));
  for (const s of SETUP_STEPS) {
    assert.ok(html.includes(s.title), `expected step "${s.title}"`);
  }
});

test('renderOverlay: dismiss controls are wired to close, never navigation', () => {
  const html = renderOverlay({});
  assert.ok(html.includes('window.game.closeHowToPlay()'), 'scrim/close button close the overlay');
  assert.ok(!html.includes('href="/?host=1"'), 'no navigating CTA that would drop the lobby');
  assert.ok(!html.includes('<a '), 'overlay uses buttons, not anchors, so it never leaves the lobby');
});

test('renderOverlay: completed steps are marked done and lose their badge', () => {
  const allReady = { connectionStatus: 'connected', onlinePlayers: [{ ready: true }, { ready: true }] };
  const html = renderOverlay(allReady);
  assert.ok(html.includes('htp-step--done'), 'expected a done step');
  // Step 1 (Host a Game) is complete, so its "Free Account Required" badge is hidden.
  assert.ok(!html.includes('Free Account Required'), 'completed step hides its badge');
});

test('renderOverlay: incomplete first step shows its badge and is current', () => {
  const html = renderOverlay({ connectionStatus: 'disconnected', onlinePlayers: [] });
  assert.ok(html.includes('Free Account Required'), 'step 1 badge visible while incomplete');
  assert.ok(html.includes('htp-step--current'), 'first incomplete step is highlighted');
});
