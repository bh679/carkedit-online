// CarkedIt Online — How to Play page
// Standalone informational page with two tabs:
//   1) Set Up a Game  (3-step remote setup)
//   2) Game Rules      (the rules)
//
// Pure render/logic functions are exported and import-safe (no DOM at load time)
// so they can be unit tested; the DOM bootstrap at the bottom is guarded.
'use strict';

// Content data (SETUP_STEPS/DECKS/PHASES) is shared with the in-lobby overlay,
// so it lives in a DOM-free module and is re-exported here for backwards
// compatibility with existing importers/tests.
export { SETUP_STEPS, DECKS, PHASES, VIDEO_CALL_TIP } from './content.js';
import { SETUP_STEPS, DECKS, PHASES, VIDEO_CALL_TIP } from './content.js';

export const TABS = ['setup', 'play'];
export const DEFAULT_TAB = 'setup';

// ── Pure tab logic ────────────────────────────────────────

export function normaliseTab(value) {
  return TABS.includes(value) ? value : DEFAULT_TAB;
}

export function isTabActive(active, id) {
  return normaliseTab(active) === id;
}

// ── Rendering (pure: returns HTML strings) ────────────────

export function renderHeader() {
  return `
    <header class="htp-header">
      <a class="htp-back" href="/" aria-label="Back to menu">&larr; Menu</a>
      <img
        class="htp-header__logo"
        src="assets/CarkedIt-skull.webp"
        alt=""
        onerror="this.style.display='none'"
      />
      <h1 class="htp-header__title">How to Play</h1>
      <p class="htp-header__subtitle">Carked It! Online</p>
    </header>
  `;
}

export function renderTabs(active) {
  const tab = (id, label) => `
    <button
      class="htp-tab${isTabActive(active, id) ? ' htp-tab--active' : ''}"
      role="tab"
      aria-selected="${isTabActive(active, id)}"
      data-tab="${id}"
      onclick="window.howToPlay.selectTab('${id}')"
    >${label}</button>
  `;
  return `
    <div class="htp-tabs" role="tablist">
      ${tab('setup', 'Set Up a Game')}
      ${tab('play', 'Game Rules')}
    </div>
  `;
}

export function renderSetupPanel(active) {
  const on = isTabActive(active, 'setup');
  const steps = SETUP_STEPS.map(s => `
    <li class="htp-step">
      <span class="htp-step__num">${s.n}</span>
      <div class="htp-step__text">
        <h3 class="htp-step__title">${s.title}${s.badge ? ` <span class="htp-step__badge${s.badgeVariant ? ` htp-step__badge--${s.badgeVariant}` : ''}">${s.badge}</span>` : ''}</h3>
        <p class="htp-step__body">${s.body}</p>
      </div>
    </li>
  `).join('');

  return `
    <section
      class="htp-panel${on ? ' htp-panel--active' : ''}"
      id="htp-panel-setup"
      role="tabpanel"
      ${on ? '' : 'hidden'}
    >
      <p class="htp-intro">Carked It! Online plays across everyone’s phones. Get a game going in three steps:</p>
      <div class="htp-callout">
        <span class="htp-callout__icon" aria-hidden="true">${VIDEO_CALL_TIP.icon}</span>
        <p class="htp-callout__text">
          <strong>${VIDEO_CALL_TIP.title}</strong> ${VIDEO_CALL_TIP.body}
        </p>
      </div>
      <ol class="htp-steps">${steps}</ol>
      <a class="btn btn--primary htp-cta" href="#play" onclick="window.howToPlay.selectTab('play'); window.scrollTo(0,0); return false;">Game Rules &rarr;</a>
    </section>
  `;
}

export function renderPlayPanel(active) {
  const on = isTabActive(active, 'play');
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

      <a class="btn btn--primary htp-cta" href="/?host=1">Start a Game &rarr;</a>
    </section>
  `;
}

export function render(active) {
  return `
    <div class="htp">
      ${renderHeader()}
      ${renderTabs(active)}
      ${renderSetupPanel(active)}
      ${renderPlayPanel(active)}
    </div>
  `;
}

// ── DOM behaviour (browser only) ──────────────────────────

function tabFromHash() {
  return normaliseTab((window.location.hash || '').replace('#', ''));
}

function showTab(tab) {
  const active = normaliseTab(tab);
  TABS.forEach(id => {
    const panel = document.getElementById(`htp-panel-${id}`);
    const btn = document.querySelector(`.htp-tab[data-tab="${id}"]`);
    const isActive = id === active;
    if (panel) {
      panel.classList.toggle('htp-panel--active', isActive);
      panel.hidden = !isActive;
    }
    if (btn) {
      btn.classList.toggle('htp-tab--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    }
  });
}

function selectTab(tab) {
  const active = normaliseTab(tab);
  // Update the hash without jumping the scroll position.
  if (tabFromHash() !== active) {
    history.replaceState(null, '', `#${active}`);
  }
  showTab(active);
}

function mount() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = render(tabFromHash());
  window.addEventListener('hashchange', () => showTab(tabFromHash()));
}

if (typeof document !== 'undefined') {
  window.howToPlay = { selectTab };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
