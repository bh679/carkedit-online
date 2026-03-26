// CarkedIt Online — Gameboard Component
'use strict';

import { render as renderCard } from './card.js';
import { render as renderCardGrid } from './card-grid.js';

/**
 * Seed-based pseudo-random for consistent card positions per player name.
 */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
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

  // Face-down overlay — hidden during pitching (only the active card is shown)
  let playedCardsHtml = '';
  if (hasPlayedCards && !pitchingPlayer) {
    const cardEls = playerNames.map((name, index) => {
      const card = playedCards[name];
      const rng = seededRandom(name + index);
      const rotation = (rng() - 0.5) * 90;
      const offsetX = rng() * 60 - 30;
      const offsetY = rng() * 60 - 30;

      if (revealed) {
        return `
          <div class="gameboard__played-card gameboard__played-card--revealed"
               style="transform: rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px)"
               data-player="${name}">
            ${renderCard({ ...card, deckType: card.deckType || deckType })}
            <span class="gameboard__played-card-player">${name}</span>
          </div>
        `;
      }

      return `
        <div class="gameboard__played-card gameboard__played-card--facedown gameboard__played-card--${deckType}"
             style="transform: rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px)"
             data-player="${name}">
          <span class="gameboard__played-card-label">${name}</span>
        </div>
      `;
    }).join('');

    playedCardsHtml = `<div class="gameboard__played-cards">${cardEls}</div>`;
  }

  // During pitching, show the pitching player's card in the main card area
  let mainCardHtml = promptCard;
  if (pitchingPlayer && playedCards[pitchingPlayer]) {
    const card = playedCards[pitchingPlayer];
    mainCardHtml = renderActiveCard(
      renderCard({ ...card, deckType: card.deckType || deckType }),
      { label: `${pitchingPlayer}'s card` },
    );
  }

  return `
    <div class="gameboard">
      <div class="gameboard__card-area">
        ${mainCardHtml}
        ${playedCardsHtml}
      </div>
      ${hint ? `<p class="gameboard__hint">${hint}</p>` : ''}
    </div>
  `;
}
