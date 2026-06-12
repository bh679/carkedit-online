// CarkedIt Online — Menu Screen
'use strict';

import { renderAuthButton } from '../components/auth-button.js';
import { escapeHtml } from '../utils/escape.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const reconnecting = state.connectionStatus === 'reconnecting';
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
      </div>
      <div class="menu__actions">
        <button class="btn btn--primary" onclick="window.game.openOnlineLobby()">
          Start Game
        </button>
        <button class="btn btn--secondary" onclick="window.game.showScreen('join-game')">
          Join Game
        </button>
        <a class="btn btn--secondary menu__site-link" href="expansions">
          Expansions
        </a>
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
