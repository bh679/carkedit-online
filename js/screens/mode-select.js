// CarkedIt Online — Play Mode Selection Screen
'use strict';

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
        <p class="menu__subtitle">How do you want to play?</p>
      </div>
      <div class="menu__actions">
        <button class="btn btn--primary" onclick="window.game.showScreen('online-lobby')">
          Online
        </button>
        <button class="btn btn--secondary" onclick="window.game.showScreen('lobby')">
          Shared Device
        </button>
        <button class="btn mode-select__back-btn" onclick="window.game.showScreen('menu')">
          &larr; Back
        </button>
      </div>
    </div>
  `;
}
