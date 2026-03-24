// CarkedIt Online — Hand Component
'use strict';

/**
 * @param {Array<{ id: string, title: string }>} cards
 * @returns {string} HTML string
 */
export function render(cards = []) {
  if (!cards.length) {
    return '<div class="hand hand--empty"></div>';
  }

  const cardEls = cards.map((c) => `
    <div class="hand__card" data-card-id="${c.id}">
      <span class="hand__card-title">${c.title}</span>
    </div>
  `).join('');

  return `<div class="hand">${cardEls}</div>`;
}
