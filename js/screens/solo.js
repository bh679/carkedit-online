// CarkedIt Online — Single Player Screen
//
// Pure render(state) over `state.solo` (see managers/solo-manager.js).
// Two cards, tap your favourite. Three rounds per deck, three decks, then
// a summary of the three picks.
'use strict';

import { render as renderPhaseHeader } from '../components/phase-header.js';
import { render as renderCard } from '../components/card.js';
import { render as renderCardBack } from '../components/cardBack.js';
import { escapeHtml } from '../utils/escape.js';
import { currentDeck, DECK_LABELS, ROUNDS_PER_DECK, SOLO_DECKS } from '../managers/solo-manager.js';

/**
 * @param {object} state
 * @returns {string} HTML string
 */
export function render(state) {
  const solo = state.solo;
  if (!solo) return renderLoading(state);
  if (solo.done) return renderSummary(solo);
  return renderRound(solo);
}

function renderLoading(state) {
  const text = state.preloadComplete ? 'Shuffling…' : 'Loading cards…';
  return `
    <div class="screen screen--phase screen--solo" data-phase="solo">
      ${renderPhaseHeader({ phase: 'solo', label: 'Single Player' })}
      <div class="solo__loading">
        <p id="preload-progress" class="solo__loading-text">${text}</p>
      </div>
    </div>
  `;
}

function renderRound(solo) {
  const deck = currentDeck(solo);
  const meta = DECK_LABELS[deck];
  const isFinal = solo.round === ROUNDS_PER_DECK;
  const roundLabel = isFinal ? 'Final' : `Round ${solo.round} of ${ROUNDS_PER_DECK}`;
  const prompt = isFinal ? 'Your two favourites. Which one wins?' : meta.prompt;
  // A <div role=button> rather than <button>: Chromium flattens 3D transforms
  // inside <button>, which breaks the card flip.
  const cards = solo.pair.map((card, i) => `
    <div class="solo__choice" role="button" tabindex="0" aria-label="Pick card ${i + 1}"
         onclick="window.game.soloPick(${i})"
         onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.game.soloPick(${i}); }">
      <div class="card-flip" data-solo-reveal style="--solo-delay: ${i * 120}ms">
        <div class="card-flip__inner">
          <div class="card-flip__back">${renderCardBack({ deckType: deck })}</div>
          <div class="card-flip__front">${renderCard(card)}</div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="screen screen--phase screen--solo" data-phase="${meta.phase}">
      ${renderPhaseHeader({ phase: meta.phase, label: `${meta.label} - ${roundLabel}` })}
      <p class="phase__prompt solo__prompt">${escapeHtml(prompt)}</p>
      <div class="solo__pair solo__pair--${deck}">
        ${cards}
      </div>
      <p class="solo__hint">Tap your favourite</p>
      ${renderProgress(solo)}
    </div>
  `;
}

function renderProgress(solo) {
  const dots = SOLO_DECKS.map((d, i) => {
    const cls = i < solo.deckIndex ? 'solo__dot--done' : i === solo.deckIndex ? 'solo__dot--active' : '';
    return `<span class="solo__dot solo__dot--${d} ${cls}" aria-label="${d}"></span>`;
  }).join('');
  return `<div class="solo__progress" aria-hidden="true">${dots}</div>`;
}

function renderSummary(solo) {
  const picks = SOLO_DECKS.map((deck) => {
    const card = solo.picks[deck];
    if (!card) return '';
    return `
      <div class="solo__pick solo__pick--${deck}">
        <span class="solo__pick-label">${escapeHtml(DECK_LABELS[deck].pickLabel)}</span>
        ${renderCard(card)}
      </div>
    `;
  }).join('');

  return `
    <div class="screen screen--phase screen--solo" data-phase="solo">
      ${renderPhaseHeader({ phase: 'solo', label: 'Single Player - Your Story' })}
      <p class="phase__prompt solo__prompt">This is how you carked it.</p>
      <div class="solo__summary">
        ${picks}
      </div>
      <div class="phase__actions solo__actions">
        <button class="btn btn--primary" onclick="window.game.soloStart()">Play Again</button>
        <button class="btn btn--secondary" onclick="window.game.showScreen('menu')">Menu</button>
      </div>
    </div>
  `;
}
