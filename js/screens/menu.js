// CarkedIt Online — Menu Screen
'use strict';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  return `
    <div class="screen screen--menu">
      <div class="menu__logo">
        <h1 class="menu__title">Carked It!</h1>
        <p class="menu__subtitle">Online</p>
      </div>
      <div class="menu__actions">
        <button class="btn btn--primary" onclick="window.game.showScreen('lobby')">
          Start Game
        </button>
      </div>
    </div>
  `;
}
