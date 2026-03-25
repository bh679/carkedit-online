// CarkedIt Online — Card Test Page
'use strict';

import { loadAllCards } from './data/cardTypes.js';
import { render as renderCard } from './components/card.js';

const DECK_TYPES = ['die', 'live', 'bye'];

const state = {
  decks: {},
  deckType: 'die',
  index: 0,
};

function currentDeck() {
  return state.decks[state.deckType] ?? [];
}

function render() {
  const deck = currentDeck();
  const card = deck[state.index];
  const app = document.getElementById('app');

  const deckButtons = DECK_TYPES.map(type => `
    <button
      class="btn ${state.deckType === type ? 'btn--primary' : 'btn--secondary'}"
      onclick="window.cardTest.switchDeck('${type}')"
    >
      ${type.toUpperCase()}
    </button>
  `).join('');

  const imagePath = card ? `assets/illustrations/${card.typeId}/${card.illustrationKey}.jpg` : '';

  const cardHtml = card
    ? `<div class="card-test__card" style="width:220px">
        ${renderCard({ title: card.title, description: card.description ?? '', prompt: card.prompt ?? '', image: imagePath, deckType: state.deckType })}
      </div>`
    : '<p style="color:var(--color-text-muted)">No cards loaded.</p>';

  const jsonHtml = card
    ? `<pre style="
        background:var(--color-surface);
        color:var(--color-text-muted);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:var(--radius-md);
        padding:1rem;
        font-size:0.75rem;
        text-align:left;
        width:100%;
        max-width:400px;
        overflow-x:auto;
        white-space:pre-wrap;
        word-break:break-word;
      ">${JSON.stringify(card, null, 2)}</pre>`
    : '';

  app.innerHTML = `
    <div class="card-test" style="display:flex;flex-direction:column;align-items:center;gap:1.5rem;padding:2rem;min-height:100vh;background:var(--color-background)">
      <h1 style="color:var(--color-text);font-family:var(--font-display);margin:0">Card Test</h1>

      <div style="display:flex;gap:0.75rem">
        ${deckButtons}
      </div>

      ${cardHtml}

      <div style="display:flex;align-items:center;gap:1rem">
        <button class="btn btn--secondary" onclick="window.cardTest.prevCard()" ${!deck.length ? 'disabled' : ''}>&larr;</button>
        <span style="color:var(--color-text-muted);font-size:0.875rem">
          Card ${deck.length ? state.index + 1 : 0} / ${deck.length}
        </span>
        <button class="btn btn--secondary" onclick="window.cardTest.nextCard()" ${!deck.length ? 'disabled' : ''}>&rarr;</button>
      </div>

      ${jsonHtml}
    </div>
  `;
}

function switchDeck(deckType) {
  state.deckType = deckType;
  state.index = 0;
  render();
}

function nextCard() {
  const deck = currentDeck();
  if (!deck.length) return;
  state.index = (state.index + 1) % deck.length;
  render();
}

function prevCard() {
  const deck = currentDeck();
  if (!deck.length) return;
  state.index = (state.index - 1 + deck.length) % deck.length;
  render();
}

window.cardTest = { switchDeck, nextCard, prevCard };

document.addEventListener('DOMContentLoaded', async () => {
  const allCards = await loadAllCards();
  DECK_TYPES.forEach(type => {
    state.decks[type] = allCards.filter(c => c.typeId === type);
  });
  render();
});
