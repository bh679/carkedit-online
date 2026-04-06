// CarkedIt Online — Gameboard Component
'use strict';

import { render as renderCard } from './card.js';
import { render as renderCardBack } from './cardBack.js';
import { render as renderCardGrid } from './card-grid.js';

/**
 * Renders the standard "active card" layout used whenever one card is the
 * primary focus in the gameboard (Phase 1 die card, Phase 2/3 pitching, etc.)
 *
 * @param {string} cardHtml - rendered .card or .card-back HTML
 * @param {object} options
 * @param {string} options.label - optional label below the card (e.g. "Alice's death")
 * @param {string} options.extraHtml - optional HTML between slot and label (e.g. discussion prompt)
 * @param {string} options.onClick - optional onclick handler string (for clickable card backs)
 * @returns {string} HTML string
 */
export function renderActiveCard(cardHtml, { label = '', extraHtml = '', onClick = '' } = {}) {
  const clickAttr = onClick ? ` onclick="${onClick}"` : '';
  return `
    <div class="gameboard__active-card"${clickAttr}>
      <div class="gameboard__active-card__slot">
        ${cardHtml}
      </div>
      ${extraHtml}
      ${label ? `<span class="gameboard__active-card__label">${label}</span>` : ''}
    </div>
  `;
}

/**
 * @param {string} promptCard - HTML for the prompt card
 * @param {string} hint - hint text shown below the card
 * @param {object} options
 * @param {object} options.playedCards - { [playerName]: card } submitted cards
 * @param {boolean} options.revealed - Whether cards are face-up
 * @param {string} options.deckType - 'live' or 'bye' for card back color
 * @param {string|null} options.pitchingPlayer - Player currently pitching (show their card big)
 * @returns {string} HTML string
 */
export function render(promptCard = '', hint = '', {
  playedCards = {},
  revealed = false,
  deckType = 'live',
  pitchingPlayer = null,
} = {}) {
  const playerNames = Object.keys(playedCards);
  const hasPlayedCards = playerNames.length > 0;

  // Revealed with no active pitcher — show all cards in a grid
  if (hasPlayedCards && revealed && !pitchingPlayer) {
    const entries = playerNames.map(name => ({
      card: { ...playedCards[name], deckType: playedCards[name].deckType || deckType },
      label: name,
    }));
    return `
      <div class="gameboard">
        <div class="gameboard__card-area">
          ${renderCardGrid(entries)}
        </div>
        ${hint ? `<p class="gameboard__hint">${hint}</p>` : ''}
      </div>
    `;
  }

  // Face-down row below prompt card — hidden during pitching
  let playedCardsHtml = '';
  if (hasPlayedCards && !pitchingPlayer) {
    const cardEls = playerNames.map((name) => {
      return `
        <div class="gameboard__played-card" data-player="${name}">
          ${renderCardBack({ deckType })}
          <span class="gameboard__played-card-label">${name}</span>
        </div>
      `;
    }).join('');

    const colClass = playerNames.length >= 4 ? 'gameboard__played-cards--cols-4' : '';
    playedCardsHtml = `<div class="gameboard__played-cards ${colClass}">${cardEls}</div>`;
  }

  // During pitching, show the pitching player's card in the main card area
  // Card starts face-down; flips with CSS transition when pitcher reveals
  let mainCardHtml = promptCard;
  if (pitchingPlayer && playedCards[pitchingPlayer]) {
    const card = playedCards[pitchingPlayer];
    const dt = card.deckType || deckType;
    const flipCard = `
      <div class="card-flip"${card.faceUp ? ' data-pitch-reveal' : ''}>
        <div class="card-flip__inner">
          <div class="card-flip__back">${renderCardBack({ deckType: dt })}</div>
          <div class="card-flip__front">${renderCard({ ...card, deckType: dt })}</div>
        </div>
      </div>`;
    mainCardHtml = renderActiveCard(flipCard, { label: `${pitchingPlayer}'s card` });
  }

  const cardAreaClass = playedCardsHtml
    ? 'gameboard__card-area gameboard__card-area--has-played'
    : 'gameboard__card-area';

  return `
    <div class="gameboard">
      <div class="${cardAreaClass}">
        ${mainCardHtml}
        ${playedCardsHtml}
      </div>
      ${hint ? `<p class="gameboard__hint">${hint}</p>` : ''}
    </div>
  `;
}
