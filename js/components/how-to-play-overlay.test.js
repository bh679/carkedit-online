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
import { SETUP_STEPS, VIDEO_CALL_TIP } from '../how-to-play/content.js';

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

test('setupStepStatus: 2 players is NOT enough — game minimum is 3', () => {
  const twoWaiting = { connectionStatus: 'connected', onlinePlayers: [{ ready: false }, { ready: false }] };
  assert.deepEqual(setupStepStatus(twoWaiting), [true, false, false]);
  // Even both ready: sharing isn't done until the 3-player minimum is in.
  const twoReady = { connectionStatus: 'connected', onlinePlayers: [{ ready: true }, { ready: true }] };
  assert.deepEqual(setupStepStatus(twoReady), [true, false, false]);
});

test('setupStepStatus: step 2 done once 3 players are in', () => {
  const state = { connectionStatus: 'connected', onlinePlayers: [{ ready: false }, { ready: false }, { ready: false }] };
  assert.deepEqual(setupStepStatus(state), [true, true, false]);
});

test('setupStepStatus: step 3 done once 3+ players are all ready', () => {
  const state = { connectionStatus: 'connected', onlinePlayers: [{ ready: true }, { ready: true }, { ready: true }] };
  assert.deepEqual(setupStepStatus(state), [true, true, true]);
});

test('setupStepStatus: step 3 not done if someone is not ready', () => {
  const state = { connectionStatus: 'connected', onlinePlayers: [{ ready: true }, { ready: true }, { ready: false }] };
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

test('renderOverlay: video-call tip is a tappable step above the numbered steps, not yet done', () => {
  const html = renderOverlay({ connectionStatus: 'disconnected', onlinePlayers: [] });
  assert.ok(html.includes(VIDEO_CALL_TIP.title), 'expected the tip title');
  assert.ok(html.includes('tell stories and connection'), 'expected the current tip wording');
  assert.ok(html.includes('htp-step--tip'), 'tip renders as a tappable step');
  assert.ok(html.includes('window.game.dismissVideoCallTip()'), 'tapping the tip marks it done');
  assert.ok(html.includes('Tap to mark as done'), 'expected the tip hint');
  assert.ok(html.indexOf(VIDEO_CALL_TIP.title) < html.indexOf(SETUP_STEPS[0].title), 'tip appears above step 1');
});

test('renderOverlay: dismiss controls are wired to close, never navigation', () => {
  const html = renderOverlay({});
  assert.ok(html.includes('window.game.closeHowToPlay()'), 'scrim/close button close the overlay');
  assert.ok(!html.includes('href="/?host=1"'), 'no navigating CTA that would drop the lobby');
  assert.ok(!html.includes('<a '), 'overlay uses buttons, not anchors, so it never leaves the lobby');
});

test('renderOverlay: completed steps are minimized — ✓ + title + Done, no body', () => {
  const allReady = { connectionStatus: 'connected', onlinePlayers: [{ ready: true }, { ready: true }, { ready: true }] };
  const html = renderOverlay(allReady);
  assert.ok(html.includes('htp-step--done'), 'expected a done step');
  assert.ok(html.includes('htp-step--mini'), 'done steps render the compact variant');
  // All three steps are done → no step bodies remain in the setup panel.
  assert.ok(!html.includes('htp-step__body'), 'minimized steps drop their body text');
  // Step 1 (Host a Game) is complete, so its "Free Account Required" badge is hidden.
  assert.ok(!html.includes('Free Account Required'), 'completed step hides its badge');
});

test('renderOverlay: incomplete first step shows its badge and is current', () => {
  const html = renderOverlay({ connectionStatus: 'disconnected', onlinePlayers: [] });
  assert.ok(html.includes('Free Account Required'), 'step 1 badge visible while incomplete');
  assert.ok(html.includes('htp-step--current'), 'first incomplete step is highlighted');
  assert.ok(!html.includes('htp-step--mini'), 'no minimized steps while nothing is done');
});

test('renderOverlay: Share the Link is tap-to-copy while incomplete in a room', () => {
  const inRoom = { connectionStatus: 'connected', roomCode: 'ABCD', onlinePlayers: [{ ready: false }, { ready: false }] };
  const html = renderOverlay(inRoom);
  assert.ok(html.includes('window.game.copyJoinLinkFromHowTo()'), 'share step copies the invite link');
  assert.ok(html.includes('htp-step--copy'), 'share step is styled tappable');
  assert.ok(html.includes('Tap to copy the invite link'), 'share step shows the copy hint');
});

test('renderOverlay: Share the Link is not tappable without a room', () => {
  const html = renderOverlay({ connectionStatus: 'disconnected', onlinePlayers: [] });
  assert.ok(!html.includes('copyJoinLinkFromHowTo'), 'no copy handler before a room exists');
  assert.ok(!html.includes('htp-step__copy-hint'), 'no copy hint before a room exists');
});

test('renderOverlay: Share the Link stops being tappable once done (3 players)', () => {
  const three = { connectionStatus: 'connected', roomCode: 'ABCD', onlinePlayers: [{ ready: false }, { ready: false }, { ready: false }] };
  const html = renderOverlay(three);
  assert.ok(!html.includes('copyJoinLinkFromHowTo'), 'done share step is no longer a copy button');
});
