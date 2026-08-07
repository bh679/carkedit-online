// CarkedIt Online — Menu Screen
'use strict';

import { renderAuthButton, manageAccountButton, brandAdminButton, brandPendingButton } from '../components/auth-button.js';
import { escapeHtml } from '../utils/escape.js';
import { renderCoBrand } from '../config/brand-config.js';
import { renderCountdown } from '../components/countdown.js';
import { formatStartTimeShort, hasStarted } from '../utils/schedule-format.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const reconnecting = state.connectionStatus === 'reconnecting';
  const brand = (typeof window !== 'undefined' && window.brand) ? window.brand : null;
  return `
    <div class="screen screen--menu">
      <div class="menu__logo">
        <img
          class="menu__logo-img"
          src="assets/CarkedIt-skull.webp"
          alt=""
          onerror="this.style.display='none'"
        />
        <h1 class="menu__title">Carked It!</h1>
        <p class="menu__subtitle">Online</p>
        ${renderCoBrand(brand)}
      </div>
      <div class="menu__actions">
        <button class="btn btn--primary" onclick="window.game.openOnlineLobby()">
          Start Game
        </button>
        <button class="btn btn--secondary" onclick="window.game.showScreen('join-game')">
          Join Game
        </button>
        ${renderMenuMiddle(state)}
        <a class="btn btn--ghost menu__site-link menu__shop-link" href="https://carkedit.com/shop/all-products/games/carked-it/" target="_blank" rel="noopener noreferrer">Buy Physical Game</a>
      </div>
      <div class="page-auth">${renderAuthButton(state)}</div>
      <div class="menu__versions">
        <a class="menu__version" id="menu-version-client" href="https://github.com/bh679/carkedit-online" target="_blank" rel="noopener noreferrer"></a>
        <a class="menu__version" id="menu-version-server" href="https://github.com/bh679/carkedit-api" target="_blank" rel="noopener noreferrer"></a>
      </div>
      ${reconnecting ? renderRecoveringOverlay(state) : ''}
    </div>
  `;
}

const HOW_TO_PLAY_BTN = `<a class="btn btn--secondary menu__site-link" href="how-to-play">How to Play</a>`;
const EXPANSIONS_BTN = `<a class="btn btn--secondary menu__site-link" href="expansions">Expansions</a>`;
// Links to the champion pricing page (404s until that feature merges).
const PARTNER_BTN = `<a class="btn btn--secondary menu__site-link" href="champion-pricing">Partner</a>`;
const SCHEDULED_GAMES_BTN = `<button class="btn btn--secondary" onclick="window.game.openScheduledGames()">Scheduled Games</button>`;

/**
 * Promoted version, shown in the main action list when the host actually has
 * games coming up. A game arranged for Friday is easy to lose track of, and the
 * host is the one everyone else is waiting on — so it says how many and when
 * the next one is, rather than hiding behind "More".
 */
function scheduledGamesButton(state) {
  const games = state.scheduledGames || [];
  if (games.length === 0) return null;
  // The list is sorted by start time and can still hold a game whose slot has
  // passed (it stays joinable for 24h), so "next" means the next one that
  // hasn't started — falling back to the most recent when they all have.
  const next = games.find((g) => !hasStarted(g.scheduledAt)) ?? games[games.length - 1];
  const countdown = renderCountdown(next.scheduledAt, { compact: true });
  const suffix = games.length > 1 ? ` (${games.length})` : '';
  return `
    <button class="btn btn--secondary menu__scheduled-btn" onclick="window.game.openScheduledGames()">
      <span>Scheduled Games${suffix}</span>
      ${countdown || `<span class="menu__scheduled-when">${escapeHtml(formatStartTimeShort(next.scheduledAt))}</span>`}
    </button>
  `;
}

/**
 * The middle of the menu: a promoted primary action followed by the collapsible
 * secondary actions. Owners get a brand button promoted to a primary slot —
 * Brand Admin when approved, Brand Pending while their request is pending — and
 * How to Play demoted into "More"; everyone else keeps How to Play primary.
 * Signed-in users without any brand get a Partner button (pricing) under More.
 * @param {object} state
 * @returns {string} HTML string
 */
function renderMenuMiddle(state) {
  const brandBtn = brandAdminButton(state) || brandPendingButton(state);
  const manageAccount = manageAccountButton(state);
  const hasAnyBrand = Array.isArray(state.myBrands) && state.myBrands.length > 0;
  const partner = (state.authUser && !hasAnyBrand) ? PARTNER_BTN : null;

  // A host with games coming up gets them in the main list; with none, the
  // entry point stays under "More" so the screen isn't orphaned (it's where
  // they'd land after cancelling their last one). Signed-out players never
  // see it — for them it would always lead to an empty list.
  const promotedScheduled = state.authUser ? scheduledGamesButton(state) : null;
  const scheduled = (state.authUser && !promotedScheduled) ? SCHEDULED_GAMES_BTN : null;

  const primary = brandBtn || HOW_TO_PLAY_BTN;
  const secondary = [
    brandBtn ? HOW_TO_PLAY_BTN : null,
    EXPANSIONS_BTN,
    scheduled,
    partner,
    manageAccount,
  ].filter(Boolean);

  return `${promotedScheduled ?? ''}${primary}\n${renderMenuSecondary(state, secondary)}`;
}

/**
 * Collapsible secondary actions. With 2+ items they sit behind a transparent
 * "More" button; pressing it reveals every item and the button itself disappears
 * (one-way, no collapse). A single item is shown inline (a toggle for one button
 * is not worth it).
 * @param {object} state
 * @param {string[]} secondary  button HTML strings
 * @returns {string} HTML string
 */
function renderMenuSecondary(state, secondary) {
  if (secondary.length === 0) return '';
  if (secondary.length === 1) return secondary[0];
  if (state.showMenuExtras) return secondary.join('\n');

  return `
    <button
      class="btn btn--ghost menu__more-toggle"
      onclick="window.game.toggleMenuExtras()"
      aria-expanded="false"
    >
      <span>More</span>
      <span class="menu__more-arrow" aria-hidden="true">▾</span>
    </button>
  `;
}

function renderRecoveringOverlay(state) {
  const code = state.roomCode ? escapeHtml(state.roomCode) : '';
  return `
    <div class="menu__recover-overlay" role="status" aria-live="polite">
      <div class="menu__recover-card">
        <div class="menu__recover-spinner" aria-hidden="true"></div>
        <h2 class="menu__recover-title">Rejoining your party…</h2>
        ${code ? `<p class="menu__recover-sub">Room ${code}</p>` : ''}
        <button class="btn btn--secondary menu__recover-cancel" onclick="window.game.cancelRecover()">
          Cancel
        </button>
      </div>
    </div>
  `;
}
