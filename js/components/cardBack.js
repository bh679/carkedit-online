// CarkedIt Online — Card Back Component
'use strict';

import { Card } from '../data/card.js';
import { get as registryGet } from '../data/CardRegistry.js';

const DECK_WORDS = ['LIVE', 'DIE', 'BYE!'];

const HIGHLIGHT_MAP = {
  die:  'DIE',
  live: 'LIVE',
  bye:  'BYE!',
};

/**
 * @param {{ deckType: string }} options
 * @returns {string} HTML string
 */
export function render(cardOrIdOrOpts = {}) {
  // CompositeId string — look up from registry.
  if (typeof cardOrIdOrOpts === 'string') {
    const found = registryGet(cardOrIdOrOpts);
    return found ? found.backHtml : '';
  }
  // Card class instances have pre-rendered back HTML — return it directly.
  if (cardOrIdOrOpts instanceof Card) return cardOrIdOrOpts.backHtml;
  // Legacy fallback: { deckType } options object.
  const { deckType = 'die' } = cardOrIdOrOpts;
  const highlighted = HIGHLIGHT_MAP[deckType] ?? 'DIE';

  const words = DECK_WORDS.map(word => {
    const isHighlighted = word === highlighted;
    const cssClass = isHighlighted ? 'card-back__word' : 'card-back__word card-back__word--faded';
    return `<span class="${cssClass}">${word}</span>`;
  }).join('\n      ');

  return `
    <div class="card-back card-back--${deckType}">
      <img class="card-back__image"
           src="assets/card-backs/${deckType}-back.jpg"
           alt="${deckType} deck back"
           draggable="false"
           onload="this.closest('.card-back').querySelector('.card-back__fallback').style.display='none'"
           onerror="this.style.display='none'">
      <div class="card-back__fallback">
        ${words}
      </div>
    </div>
  `;
}
