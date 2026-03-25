// CarkedIt Online — Hand Component
'use strict';

import { render as renderCard } from './card.js';

const CARD_WIDTH = 135;
const CARD_OFFSET = 43;

/**
 * @param {Array<{ id: string|number, title: string, deckType: string }>} cards
 * @param {object} options
 * @param {boolean} options.dimmed - Whether to dim the hand (during pitching/judging)
 * @param {object|null} options.selectedCard - Card currently being inspected
 * @param {string|null} options.livingDeadMessage - Message to show for Living Dead player
 * @param {string} options.deckType - Deck type for card rendering ('live' or 'bye')
 * @returns {string} HTML string
 */
export function render(cards = [], { dimmed = false, selectedCard = null, livingDeadMessage = null, deckType = 'live' } = {}) {
  if (livingDeadMessage) {
    return `
      <div class="hand hand--living-dead-container">
        <div class="living-dead-message">
          <p class="living-dead-message__text">${livingDeadMessage}</p>
        </div>
      </div>
    `;
  }

  if (!cards.length) {
    return '<div class="hand hand--empty"></div>';
  }

  const fanWidth = (cards.length - 1) * CARD_OFFSET + CARD_WIDTH;
  const dimmedClass = dimmed ? ' hand--dimmed' : '';

  const cardEls = cards.map((c, index) => `
    <div class="hand__card" style="left: ${index * CARD_OFFSET}px"
         data-card-id="${c.id}"
         onclick="window.game.inspectCard('${c.id}')">
      ${renderCard({ ...c, deckType: c.deckType || deckType })}
    </div>
  `).join('');

  const inspectOverlay = selectedCard ? `
    <div class="hand__inspect-overlay" onclick="window.game.dismissInspect()">
      <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
        ${renderCard({ ...selectedCard, deckType: selectedCard.deckType || deckType })}
        <button class="btn btn--primary hand__submit-btn"
                onclick="window.game.submitCard('${selectedCard.id}')">
          Play This Card
        </button>
      </div>
    </div>
  ` : '';

  return `
    <div class="hand${dimmedClass}">
      <div class="hand__fan" style="min-width: ${fanWidth}px">
        ${cardEls}
      </div>
    </div>
    ${inspectOverlay}
  `;
}
