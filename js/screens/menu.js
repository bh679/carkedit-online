// CarkedIt Online — Menu Screen
'use strict';

import { renderAuthButton } from '../components/auth-button.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
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
        <button class="btn btn--primary" onclick="window.game.showScreen('mode-select')">
          Start Game
        </button>
        <button class="btn btn--secondary" onclick="window.game.showScreen('join-game')">
          Join Game
        </button>
        <a class="btn btn--secondary menu__site-link" href="card-designer">
          Card Designer
        </a>
        <a class="btn btn--ghost menu__site-link menu__shop-link" href="https://carkedit.com/shop/all-products/games/carked-it/" target="_blank" rel="noopener noreferrer">Buy Physical Game</a>
        <a class="btn btn--ghost menu__site-link" href="https://carkedit.com" target="_blank" rel="noopener noreferrer">CarkedIt.com</a>
      </div>
      <div class="menu__auth">${renderAuthButton(state)}</div>
      <div class="menu__versions">
        <a class="menu__version" id="menu-version-client" href="https://github.com/bh679/carkedit-online" target="_blank" rel="noopener noreferrer"></a>
        <a class="menu__version" id="menu-version-server" href="https://github.com/bh679/carkedit-api" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </div>
  `;
}
