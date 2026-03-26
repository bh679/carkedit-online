// CarkedIt Online — Hand Component
'use strict';

import { render as renderCard } from './card.js';

const CARD_WIDTH = 135;

/**
 * Shared full-screen inspect overlay — used for hand selection and judging.
 *
 * @param {object} options
 * @param {object|null} options.selectedCard - Card to display
 * @param {string} options.deckType - Deck type for card rendering and overlay accent colour
 * @param {string} options.submitLabel - Label for the confirm button
 * @param {string} options.onSubmit - onclick expression for the confirm button
 * @param {string} options.onPrev - onclick expression for the prev arrow
 * @param {string} options.onNext - onclick expression for the next arrow
 * @returns {string} HTML string (empty if no selectedCard)
 */
export function renderInspectOverlay({ selectedCard, deckType, submitLabel, onSubmit, onPrev, onNext }) {
  if (!selectedCard) return '';
  const activedeckType = selectedCard.deckType || deckType;
  return `
    <div class="hand__inspect-overlay hand__inspect-overlay--${activedeckType}" onclick="window.game.dismissInspect()">
      <button class="hand__nav-btn hand__nav-btn--prev" onclick="event.stopPropagation(); ${onPrev}">&#8249;</button>
      <div class="hand__inspect-card-wrapper" onclick="event.stopPropagation()">
        ${renderCard({ ...selectedCard, deckType: activedeckType })}
        <button class="btn btn--primary hand__submit-btn" onclick="${onSubmit}">
          ${submitLabel}
        </button>
      </div>
      <button class="hand__nav-btn hand__nav-btn--next" onclick="event.stopPropagation(); ${onNext}">&#8250;</button>
    </div>
  `;
}

/**
 * @param {Array<{ id: string|number, title: string, deckType: string }>} cards
 * @param {object} options
 * @param {boolean} options.dimmed - Whether to dim the hand (during pitching/judging)
 * @param {object|null} options.selectedCard - Card currently being inspected
 * @param {string|null} options.livingDeadMessage - Message to show for Living Dead player
 * @param {string} options.deckType - Deck type for card rendering ('live' or 'bye')
 * @returns {string} HTML string
 */
export function render(cards = [], { dimmed = false, selectedCard = null, livingDeadMessage = null, deckType = 'live', footer = '' } = {}) {
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

  const dimmedClass = dimmed ? ' hand--dimmed' : '';
  const count = cards.length;

  const cardEls = cards.map((c, index) => {
    const isSelected = selectedCard && String(c.id) === String(selectedCard.id);
    const selectedClass = isSelected ? ' hand__card--selected' : '';
    const leftStyle = count === 1
      ? 'left: 0'
      : `left: calc((100% - ${CARD_WIDTH}px) * ${index} / ${count - 1})`;
    return `
    <div class="hand__card${selectedClass}" style="${leftStyle}"
         data-card-id="${c.id}"
         onclick="window.game.inspectCard('${c.id}')">
      ${renderCard({ ...c, deckType: c.deckType || deckType })}
    </div>
  `;
  }).join('');

  const inspectOverlay = renderInspectOverlay({
    selectedCard,
    deckType,
    submitLabel: 'Play This Card',
    onSubmit: `window.game.submitCard('${selectedCard?.id}')`,
    onPrev:   `window.game.prevCard('${selectedCard?.id}')`,
    onNext:   `window.game.nextCard('${selectedCard?.id}')`,
  });

  return `
    <div class="hand${dimmedClass}">
      <div class="hand__fan">
        ${cardEls}
      </div>
      ${footer}
    </div>
    ${inspectOverlay}
  `;
}
