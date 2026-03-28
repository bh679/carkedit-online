// CarkedIt Online — Card Grid Component
'use strict';

import { render as renderCard } from './card.js';

/**
 * Renders a 2-3 column grid of cards, each with a label below.
 *
 * @param {Array<{card: object, label: string, onClick?: string}>} entries
 * @param {object} options
 * @param {number} [options.columns=2] - grid columns (2 or 3)
 * @returns {string} HTML string
 */
export function render(entries, { columns = 2 } = {}) {
  const items = entries.map(({ card, label, onClick }) => {
    const clickAttr = onClick ? `onclick="${onClick}"` : '';
    const interactiveClass = onClick ? ' card-grid__item--interactive' : '';
    return `
      <div class="card-grid__item${interactiveClass}" ${clickAttr}>
        ${renderCard(card)}
        <span class="card-grid__label">${label}</span>
      </div>
    `;
  }).join('');

  return `<div class="card-grid card-grid--cols-${columns}">${items}</div>`;
}
