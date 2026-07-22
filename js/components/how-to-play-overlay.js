// CarkedIt Online — How to Play overlay (in-lobby)
//
// Renders the /how-to-play content as a screen ON TOP of the online lobby, so a
// first-time player can read the instructions without navigating away (which, on
// mobile, would drop them out of their room). The "Set Up a Game" steps tick off
// live as the lobby state advances (hosting → someone joins → ready to start).
//
// Import-safe / DOM-free: pure string builders + guarded localStorage helpers,
// so this module can be unit tested under `node --test` and imported into the
// game bundle without any bootstrap side effects. Content data is shared with the
// standalone page via ../how-to-play/content.js.
'use strict';

import { SETUP_STEPS, DECKS, PHASES } from '../how-to-play/content.js';

// ── Tabs ──────────────────────────────────────────────────
export const TABS = ['setup', 'play'];
export const DEFAULT_TAB = 'setup';

export function normaliseTab(value) {
  return TABS.includes(value) ? value : DEFAULT_TAB;
}

// ── First-game tracking ───────────────────────────────────
// The "How to Play" button is always available, but emphasized until the player
// has been through their first online game (set on the first phase transition).
export const PLAYED_KEY = 'carkedit:hasPlayedOnline';

export function isFirstOnlineGame() {
  try {
    return !(typeof localStorage !== 'undefined' && localStorage.getItem(PLAYED_KEY));
  } catch {
    return true;
  }
}

export function markOnlinePlayed() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PLAYED_KEY, '1');
  } catch {
    /* private-mode / storage disabled — emphasis simply persists, harmless */
  }
}

// The first-game banner can also be dismissed with its ✕ before the first game;
// once dismissed it stays gone (the header "?" remains the way back in).
export const BANNER_DISMISS_KEY = 'carkedit:howToBannerDismissed';

export function isHowToBannerDismissed() {
  try {
    return !!(typeof localStorage !== 'undefined' && localStorage.getItem(BANNER_DISMISS_KEY));
  } catch {
    return false;
  }
}

export function markHowToBannerDismissed() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(BANNER_DISMISS_KEY, '1');
  } catch {
    /* storage disabled — banner reappears on reload, harmless */
  }
}

// ── Setup-step completion (derived from live lobby state) ──
/**
 * Which of the three "Set Up a Game" steps are complete, in order.
 *   1) Host a Game   — done once connected to a room
 *   2) Share the Link — done once the game minimum of 3 players is in
 *   3) Join & Start   — done once 3+ players are in and everyone is ready
 * @param {object} state
 * @returns {[boolean, boolean, boolean]}
 */
export function setupStepStatus(state) {
  const connected = state?.connectionStatus === 'connected';
  const players = Array.isArray(state?.onlinePlayers) ? state.onlinePlayers : [];
  const count = players.length;
  return [
    connected,
    connected && count >= 3,
    connected && count >= 3 && players.every(p => p && p.ready),
  ];
}

// ── Buttons shown in the lobby ────────────────────────────

/** Persistent header help button (both lobby states). */
export function renderHelpButton() {
  return `
    <button
      class="phase-header__help-btn"
      aria-label="How to play"
      title="How to play"
      onclick="window.game.openHowToPlay()"
    >?</button>
  `;
}

/**
 * Slim first-game banner: a single dismissible line that opens the instructions.
 * Shown only until the player's first online game, and hidden once dismissed (✕)
 * — the header help button remains the permanent way in. Kept short so it never
 * pushes the lobby into a scroll.
 */
export function renderFirstGameBanner(state) {
  if (!isFirstOnlineGame() || isHowToBannerDismissed()) return '';
  return `
    <div class="online-lobby__howto-bar" role="button" tabindex="0" onclick="window.game.openHowToPlay()">
      <span class="online-lobby__howto-bar-emoji" aria-hidden="true">🃏</span>
      <span class="online-lobby__howto-bar-text">First time? <span class="online-lobby__howto-bar-link">Here's how to play &rarr;</span></span>
      <button type="button" class="online-lobby__howto-bar-x" aria-label="Dismiss" onclick="event.stopPropagation(); window.game.dismissHowToBanner()">&times;</button>
    </div>
  `;
}

// ── Overlay ───────────────────────────────────────────────

function renderTabs(active) {
  const tab = (id, label) => `
    <button
      class="htp-tab${active === id ? ' htp-tab--active' : ''}"
      role="tab"
      aria-selected="${active === id}"
      data-tab="${id}"
      onclick="window.game.setHowToPlayTab('${id}')"
    >${label}</button>
  `;
  return `
    <div class="htp-tabs" role="tablist">
      ${tab('setup', 'Set Up a Game')}
      ${tab('play', 'Game Rules')}
    </div>
  `;
}

function renderSetupPanel(state, active) {
  const on = active === 'setup';
  const done = setupStepStatus(state);
  const currentIndex = done.indexOf(false); // first incomplete step, or -1 if all done

  const steps = SETUP_STEPS.map((s, i) => {
    const isDone = done[i];
    const isCurrent = i === currentIndex;

    // Completed steps collapse to a compact ✓ + title + Done row — the details
    // are no longer needed, they just record the progress already made.
    if (isDone) {
      return `
        <li class="htp-step htp-step--done htp-step--mini">
          <span class="htp-step__num" aria-hidden="true">✓</span>
          <h3 class="htp-step__title">${s.title} <span class="htp-step__done-label">Done</span></h3>
        </li>
      `;
    }

    // "Share the Link" is actionable in place: tapping the step copies the
    // invite link (only possible once connected, when a room code exists).
    const isShareStep = s.title === 'Share the Link';
    const canCopy = isShareStep && state?.connectionStatus === 'connected' && !!state?.roomCode;
    const copyAttrs = canCopy
      ? ` role="button" tabindex="0" onclick="window.game.copyJoinLinkFromHowTo()"`
      : '';
    const copyHint = canCopy
      ? '<p class="htp-step__copy-hint" id="htp-copy-hint">Tap to copy the invite link</p>'
      : '';

    const cls = ['htp-step', isCurrent ? 'htp-step--current' : '', canCopy ? 'htp-step--copy' : '']
      .filter(Boolean).join(' ');
    const badge = s.badge
      ? ` <span class="htp-step__badge${s.badgeVariant ? ` htp-step__badge--${s.badgeVariant}` : ''}">${s.badge}</span>`
      : '';
    return `
      <li class="${cls}"${copyAttrs}>
        <span class="htp-step__num" aria-hidden="true">${s.n}</span>
        <div class="htp-step__text">
          <h3 class="htp-step__title">${s.title}${badge}</h3>
          <p class="htp-step__body">${s.body}</p>
          ${copyHint}
        </div>
      </li>
    `;
  }).join('');

  return `
    <section
      class="htp-panel${on ? ' htp-panel--active' : ''}"
      id="htp-panel-setup"
      role="tabpanel"
      ${on ? '' : 'hidden'}
    >
      <p class="htp-intro">Carked It! Online plays across everyone’s phones. Get a game going in three steps:</p>
      <ol class="htp-steps">${steps}</ol>
      <div class="htp-callout">
        <span class="htp-callout__icon" aria-hidden="true">\u{1F4F9}</span>
        <p class="htp-callout__text">
          <strong>Best with a video call.</strong> Carked It! is all about pitching, conversations
          and stories — get everyone on <strong>Zoom, Google Meet, FaceTime</strong> or
          similar and play with your phones in hand.
        </p>
      </div>
      <button type="button" class="btn btn--primary htp-cta" onclick="window.game.setHowToPlayTab('play')">Game Rules &rarr;</button>
    </section>
  `;
}

function renderPlayPanel(active) {
  const on = active === 'play';
  const decks = DECKS.map(d => `
    <li class="htp-deck htp-deck--${d.key}">
      <img class="htp-deck__img" src="${d.img}" alt="${d.name} deck card back"
        onerror="this.style.display='none'" />
      <div class="htp-deck__info">
        <h3 class="htp-deck__name">${d.name}</h3>
        <span class="htp-deck__count">${d.count} cards</span>
        <p class="htp-deck__desc">${d.desc}</p>
      </div>
    </li>
  `).join('');

  const phases = PHASES.map(p => `
    <li class="htp-phase htp-phase--${p.key}">
      <span class="htp-phase__num">${p.n}</span>
      <div class="htp-phase__text">
        <h3 class="htp-phase__title">${p.title}</h3>
        <p class="htp-phase__body">${p.body}</p>
      </div>
    </li>
  `).join('');

  return `
    <section
      class="htp-panel${on ? ' htp-panel--active' : ''}"
      id="htp-panel-play"
      role="tabpanel"
      ${on ? '' : 'hidden'}
    >
      <div class="htp-goal">
        <h2 class="htp-section-title">The Goal</h2>
        <p>Plan your life, death and afterlife with three decks of cards. Players pitch what they
        reckon is best for each other — score a point when your card gets picked. Most points wins
        and is crowned the <strong>Legendary Death Doula!</strong> \u{1F480}\u{1F451}</p>
      </div>

      <h2 class="htp-section-title">The Three Decks</h2>
      <ul class="htp-decks">${decks}</ul>

      <h2 class="htp-section-title">The Four Phases</h2>
      <ol class="htp-phases">${phases}</ol>

      <div class="htp-winning">
        <h2 class="htp-section-title">Winning</h2>
        <p>After the eulogies, whoever has the most points wins and is crowned the
        <strong>Legendary Death Doula</strong>. Short on time? Play to <strong>1 Live + 1 Bye</strong>
        card each instead of 2.</p>
      </div>

      <button type="button" class="btn btn--primary htp-cta" onclick="window.game.closeHowToPlay()">Got it! Back to the lobby</button>
    </section>
  `;
}

/**
 * Full overlay markup. Rendered on top of the lobby when state.showHowToPlay is
 * true; dismissed via the scrim, ✕, or the panel's own button — never by
 * navigating, so the lobby/room stays intact underneath.
 * @param {object} state
 * @returns {string}
 */
export function renderOverlay(state) {
  const active = normaliseTab(state?.howToPlayTab);
  return `
    <div class="htp-overlay" role="dialog" aria-modal="true" aria-label="How to Play">
      <div class="htp-overlay__scrim" onclick="window.game.closeHowToPlay()"></div>
      <div class="htp-overlay__panel">
        <button class="htp-overlay__close" aria-label="Close instructions" onclick="window.game.closeHowToPlay()">✕</button>
        <div class="htp htp--overlay">
          <div class="htp-overlay__titles">
            <h1 class="htp-header__title">How to Play</h1>
            <p class="htp-header__subtitle">Carked It! Online</p>
          </div>
          ${renderTabs(active)}
          ${renderSetupPanel(state, active)}
          ${renderPlayPanel(active)}
        </div>
      </div>
    </div>
  `;
}
