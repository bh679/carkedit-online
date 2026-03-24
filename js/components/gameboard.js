// CarkedIt Online — Gameboard Component
'use strict';

/**
 * @param {object} state - current game state
 * @param {string} content - inner HTML to render inside the board
 * @returns {string} HTML string
 */
export function render(state = {}, content = '') {
  return `
    <div class="gameboard">
      <div class="gameboard__content">
        ${content}
      </div>
    </div>
  `;
}
