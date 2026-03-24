// CarkedIt Online — Phase Header Component
'use strict';

/**
 * @param {{ phase: string, label: string, currentPlayer: string }} options
 * @returns {string} HTML string
 */
export function render({ phase = '', label = '', currentPlayer = '' } = {}) {
  return `
    <header class="phase-header" data-phase="${phase}">
      <span class="phase-header__label">${label}</span>
      ${currentPlayer ? `<span class="phase-header__player">${currentPlayer}'s turn</span>` : ''}
    </header>
  `;
}
